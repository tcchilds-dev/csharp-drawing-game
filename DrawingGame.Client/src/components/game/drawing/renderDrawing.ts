import type { Stroke } from "./drawingModel";
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
