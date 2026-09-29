import type { Point } from "./drawingModel";

// Split the error budget between curve approximation and removal of redundant
// vertices. The final path stays within 0.1 device pixel of the quadratic curve.
const CURVE_ERROR = 0.05;
const SIMPLIFY_ERROR = 0.05;

function simplifyPath(points: Point[]): Point[] {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const pending = [0, points.length - 1];

  // Iterative Ramer–Douglas–Peucker: avoid deep recursion on long mouse gestures.
  while (pending.length) {
    const end = pending.pop()!;
    const start = pending.pop()!;
    const from = points[start];
    const to = points[end];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    let largestError = SIMPLIFY_ERROR * SIMPLIFY_ERROR;
    let split = -1;

    for (let index = start + 1; index < end; index++) {
      const point = points[index];
      const t = lengthSquared
        ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared))
        : 0;
      const offsetX = point.x - from.x - t * dx;
      const offsetY = point.y - from.y - t * dy;
      const error = offsetX * offsetX + offsetY * offsetY;
      if (error > largestError) {
        largestError = error;
        split = index;
      }
    }

    if (split !== -1) {
      keep[split] = 1;
      pending.push(start, split, split, end);
    }
  }

  const simplified: Point[] = [];
  for (let index = 0; index < points.length; index++) {
    if (!keep[index]) continue;
    const point = points[index];
    const previous = simplified.at(-1);
    if (!previous || point.x !== previous.x || point.y !== previous.y) simplified.push(point);
  }
  return simplified;
}

export function getStrokePath(points: readonly Point[], scaleX = 1, scaleY = 1): Point[] {
  return getStrokeSection(points, scaleX, scaleY, 1, points.length - 1, true);
}

// Curve i becomes permanent once point i + 1 arrives. Sections meet at the
// original quadratic midpoints, so they can be cached without changing the curve.
export function getStrokeSection(points: readonly Point[], scaleX: number, scaleY: number,
  firstCurve: number, endCurve: number, includeTail: boolean): Point[] {
  if (!points.length) return [];
  let start = firstCurve === 1
    ? { x: points[0].x * scaleX, y: points[0].y * scaleY }
    : { x: (points[firstCurve - 1].x + points[firstCurve].x) / 2 * scaleX,
      y: (points[firstCurve - 1].y + points[firstCurve].y) / 2 * scaleY };
  const path = [start];

  for (let index = firstCurve; index < endCurve; index++) {
    const point = points[index];
    const next = points[index + 1];
    const controlX = point.x * scaleX;
    const controlY = point.y * scaleY;
    const end = { x: (point.x + next.x) / 2 * scaleX, y: (point.y + next.y) / 2 * scaleY };
    const deviation = Math.hypot(start.x - 2 * controlX + end.x, start.y - 2 * controlY + end.y) / 4;
    const steps = Math.max(1, Math.ceil(Math.sqrt(deviation / CURVE_ERROR)));

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const u = 1 - t;
      path.push({
        x: u * u * start.x + 2 * u * t * controlX + t * t * end.x,
        y: u * u * start.y + 2 * u * t * controlY + t * t * end.y,
      });
    }
    start = end;
  }

  if (includeTail && points.length > 1) {
    const last = points.at(-1)!;
    path.push({ x: last.x * scaleX, y: last.y * scaleY });
  }
  return simplifyPath(path);
}
