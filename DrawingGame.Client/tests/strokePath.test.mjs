import assert from "node:assert/strict";
import test from "node:test";
import { getStrokePath } from "../src/components/game/drawing/strokePath.ts";

function distanceToPath(point, path) {
  let nearest = Infinity;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1],
      to = path[index];
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
        )
      : 0;
    nearest = Math.min(nearest, Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy));
  }
  return nearest;
}

test("rendering path preserves endpoints, empty strokes, and single-point dots", () => {
  assert.deepEqual(getStrokePath([]), []);
  assert.deepEqual(getStrokePath([{ x: 10, y: 20 }], 2, 3), [{ x: 20, y: 60 }]);
  assert.deepEqual(
    getStrokePath([
      { x: 10, y: 20 },
      { x: 10, y: 20 },
    ]),
    [{ x: 10, y: 20 }],
  );
  const input = [
    { x: 10, y: 20 },
    { x: 100, y: 200 },
    { x: 300, y: 40 },
  ];
  const path = getStrokePath(input, 2, 3);
  assert.deepEqual(path[0], { x: 20, y: 60 });
  assert.deepEqual(path.at(-1), { x: 600, y: 120 });
  assert.deepEqual(
    getStrokePath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
    ]),
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  );
});

test("dense straight strokes simplify without changing stored input points", () => {
  const points = Array.from({ length: 4000 }, (_, index) => ({
    x: index / 10,
    y: 100,
  }));
  const before = structuredClone(points);
  assert.deepEqual(getStrokePath(points), [points[0], points.at(-1)]);
  assert.deepEqual(points, before);
});

test("rendering stays within a tenth of a device pixel of the smoothed curve at different screen scales", () => {
  const points = [
    { x: 200, y: 100 },
    { x: -60, y: 400 },
    { x: 400, y: -50 },
    { x: 900, y: 400 },
    { x: 200, y: 100 },
  ];
  for (const [scaleX, scaleY] of [
    [0.7, 0.7],
    [1, 1],
    [1.25, 0.8],
    [2, 2],
    [3, 2],
  ]) {
    const path = getStrokePath(points, scaleX, scaleY);
    let start = points[0];
    for (let index = 1; index < points.length - 1; index++) {
      const control = points[index],
        next = points[index + 1];
      const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
      for (let step = 0; step <= 1000; step++) {
        const t = step / 1000,
          u = 1 - t;
        const point = {
          x: (u * u * start.x + 2 * u * t * control.x + t * t * end.x) * scaleX,
          y: (u * u * start.y + 2 * u * t * control.y + t * t * end.y) * scaleY,
        };
        assert.ok(distanceToPath(point, path) <= 0.100001);
      }
      start = end;
    }
  }
});
