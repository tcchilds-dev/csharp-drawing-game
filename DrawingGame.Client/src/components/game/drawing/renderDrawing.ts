import type { Stroke } from "./drawingModel";

// Replay the same midpoint quadratics for local ink and received API point arrays.
export function renderStroke(context: CanvasRenderingContext2D, stroke: Stroke, scaleX = 1, scaleY = 1) {
  const { points, colour, width } = stroke;
  if (!points.length) return;
  context.fillStyle = colour;
  context.strokeStyle = colour;
  // Scale coordinates independently to fill the existing panel, but keep the
  // brush round with one diameter, even when the panel has a different aspect ratio.
  const diameter = width * Math.min(scaleX, scaleY);
  context.lineWidth = diameter;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (points.length === 1) {
    context.arc(points[0].x * scaleX, points[0].y * scaleY, diameter / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.moveTo(points[0].x * scaleX, points[0].y * scaleY);
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(point.x * scaleX, point.y * scaleY,
      (point.x + next.x) / 2 * scaleX, (point.y + next.y) / 2 * scaleY);
  }
  const last = points.at(-1)!;
  context.lineTo(last.x * scaleX, last.y * scaleY);
  context.stroke();
}
