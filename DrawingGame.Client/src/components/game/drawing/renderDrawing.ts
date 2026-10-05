import { BOARD_HEIGHT, BOARD_WIDTH } from "./drawingModel";
import type { Stroke } from "./drawingModel";
import { fillMask } from "./fill";
import { getStrokeSection } from "./strokePath";

// Fixed input boundaries keep simplification bounded and make live ink and replay
// identical regardless of how pointer events are grouped into animation frames.
export const STROKE_SECTION_SIZE = 64;

export type InkBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// Replay the same midpoint quadratics for local ink and received API point arrays.
export function renderStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX = 1,
  scaleY = 1,
) {
  let firstCurve = 1;
  while (firstCurve + STROKE_SECTION_SIZE <= stroke.points.length - 1) {
    renderStrokeSection(
      context,
      stroke,
      scaleX,
      scaleY,
      firstCurve,
      firstCurve + STROKE_SECTION_SIZE,
      false,
    );
    firstCurve += STROKE_SECTION_SIZE;
  }
  renderStrokeSection(context, stroke, scaleX, scaleY, firstCurve, stroke.points.length - 1, true);
}

export function renderStrokeSection(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX: number,
  scaleY: number,
  firstCurve: number,
  endCurve: number,
  includeTail: boolean,
): InkBounds | null {
  const { colour, width } = stroke;
  const points = getStrokeSection(stroke.points, scaleX, scaleY, firstCurve, endCurve, includeTail);
  if (!points.length) return null;
  context.fillStyle = colour;
  context.strokeStyle = colour;
  // Scale coordinates independently to fill the existing panel, but keep the
  // brush round with one diameter, even when the panel has a different aspect ratio.
  const diameter = width * Math.min(scaleX, scaleY);
  context.lineWidth = diameter;
  context.lineCap = "round";
  context.lineJoin = "round";
  let left = points[0].x;
  let top = points[0].y;
  let right = left;
  let bottom = top;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  // Include the round caps and antialiasing fringe when erasing the preview.
  const padding = diameter / 2 + 2;
  const bounds = {
    left: Math.floor(left - padding),
    top: Math.floor(top - padding),
    width: Math.ceil(right + padding) - Math.floor(left - padding),
    height: Math.ceil(bottom + padding) - Math.floor(top - padding),
  };
  context.beginPath();
  if (points.length === 1) {
    context.arc(points[0].x, points[0].y, diameter / 2, 0, Math.PI * 2);
    context.fill();
    return bounds;
  }
  // A single tightly curved outline can leave pale pinholes in the software
  // stroker. Overlapping round-capped segments give solid coverage at the joins.
  // They share one stroke call, and subpixel path simplification keeps it fast.
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
  }
  context.stroke();
  return bounds;
}

type FillImage = { image: HTMLCanvasElement; left: number; top: number };

// A fill only depends on what was drawn before it, and that never changes for the same
// stroke object: undo only removes newer ones, and snapshots make new objects. So each
// fill's area is worked out once and kept until its stroke is garbage collected.
const fills = new WeakMap<Stroke, FillImage>();

// Cropped to the filled area, in board units.
function createFillImage(board: CanvasRenderingContext2D, fill: Stroke): FillImage {
  const { data } = board.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  const mask = fillMask(data, BOARD_WIDTH, BOARD_HEIGHT, fill.points[0]);
  let left = BOARD_WIDTH;
  let top = BOARD_HEIGHT;
  let right = 0;
  let bottom = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % BOARD_WIDTH;
    const y = (i - x) / BOARD_WIDTH;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  const width = right - left + 1;
  const height = bottom - top + 1;
  const pixels = new ImageData(width, height);
  const colour = parseInt(fill.colour.slice(1), 16);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[(top + y) * BOARD_WIDTH + left + x]) continue;
      const pixel = (y * width + x) * 4;
      pixels.data[pixel] = colour >> 16;
      pixels.data[pixel + 1] = (colour >> 8) & 0xff;
      pixels.data[pixel + 2] = colour & 0xff;
      pixels.data[pixel + 3] = 255;
    }
  }
  const image = document.createElement("canvas");
  image.width = width;
  image.height = height;
  image.getContext("2d")!.putImageData(pixels, 0, 0);
  return { image, left, top };
}

function renderEntry(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX: number,
  scaleY: number,
) {
  if (stroke.type !== "Fill") {
    renderStroke(context, stroke, scaleX, scaleY);
    return;
  }
  const { image, left, top } = fills.get(stroke)!;
  context.drawImage(
    image,
    left * scaleX,
    top * scaleY,
    image.width * scaleX,
    image.height * scaleY,
  );
}

// Paint completed strokes and fills in order. Fills are worked out on a board-sized copy of
// the drawing, so every player gets the same area whatever their screen size. That copy is
// only drawn when a fill isn't known yet, and only up to that fill.
export function renderHistory(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
  scaleX: number,
  scaleY: number,
) {
  let board: CanvasRenderingContext2D | undefined;
  let painted = 0;
  strokes.forEach((stroke, index) => {
    if (stroke.type === "Fill" && !fills.has(stroke)) {
      if (!board) {
        const canvas = document.createElement("canvas");
        canvas.width = BOARD_WIDTH;
        canvas.height = BOARD_HEIGHT;
        board = canvas.getContext("2d", { willReadFrequently: true })!;
        board.fillStyle = "white";
        board.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      }
      for (; painted < index; painted++) renderEntry(board, strokes[painted], 1, 1);
      fills.set(stroke, createFillImage(board, stroke));
    }
    renderEntry(context, stroke, scaleX, scaleY);
  });
}
