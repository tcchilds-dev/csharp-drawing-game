import assert from "node:assert/strict";
import test from "node:test";
import { createStabiliser, STRING_LENGTH } from "../src/components/game/drawing/stabiliser.ts";

test("the brush stays put until the string is tight, then trails the pointer by its length", () => {
  const stabilise = createStabiliser({ x: 0, y: 0 });
  assert.equal(stabilise({ x: STRING_LENGTH, y: 0 }), null);
  assert.deepEqual(stabilise({ x: STRING_LENGTH + 10, y: 0 }), { x: 10, y: 0 });
  assert.deepEqual(stabilise({ x: 10, y: STRING_LENGTH + 10 }), { x: 10, y: 10 });
});

test("a whole-pixel staircase becomes a gradual slope", () => {
  // A shallow mouse stroke reported in whole pixels: flat for 10px, then a 1px jump.
  const stabilise = createStabiliser({ x: 0, y: 0 });
  const brush = [];
  for (let x = 1; x <= 200; x++) {
    const point = stabilise({ x, y: Math.floor(x / 10) });
    if (point) brush.push(point);
  }
  for (let index = 1; index < brush.length; index++) {
    const dx = brush[index].x - brush[index - 1].x;
    const dy = brush[index].y - brush[index - 1].y;
    assert.ok(dy / dx < 0.3, `step at ${brush[index].x} rises ${dy} over ${dx}`);
  }
});
