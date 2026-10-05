import assert from "node:assert/strict";
import test from "node:test";
import { fillMask } from "../src/components/game/drawing/fill.ts";

const SIZE = 60;
// A white image with black pixels wherever `isInk(x, y)` is true.
function image(isInk) {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4).fill(255);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (isInk(x, y)) pixels.fill(0, (y * SIZE + x) * 4, (y * SIZE + x) * 4 + 3);
  return pixels;
}
// A 3 pixel thick square outline from 10 to 49, with an opening in its right side.
const square = (opening) =>
  image((x, y) => {
    const onEdge =
      (x >= 10 && x <= 49 && (y <= 12 || y >= 47) && y >= 10 && y <= 49) ||
      (y >= 10 && y <= 49 && (x <= 12 || x >= 47) && x >= 10 && x <= 49);
    return onEdge && !(x >= 47 && y >= 30 && y < 30 + opening);
  });
const at = (mask, x, y) => mask[y * SIZE + x];

test("a fill covers the whole area and overlaps the lines around it by a pixel", () => {
  const mask = fillMask(square(0), SIZE, SIZE, { x: 30, y: 30 });
  assert.equal(at(mask, 13, 13), 1);
  assert.equal(at(mask, 46, 46), 1);
  assert.equal(at(mask, 12, 30), 1);
  assert.equal(at(mask, 11, 30), 0);
  assert.equal(at(mask, 5, 5), 0);
});

test("a fill doesn't leak through a gap smaller than the gap size", () => {
  const mask = fillMask(square(6), SIZE, SIZE, { x: 30, y: 30 }, 8);
  assert.equal(at(mask, 13, 13), 1);
  assert.equal(at(mask, 46, 46), 1);
  assert.equal(at(mask, 55, 5), 0);
  assert.equal(at(mask, 5, 55), 0);
  // It reaches into the gap but doesn't bulge out of it.
  assert.equal(at(mask, 47, 32), 1);
  assert.equal(at(mask, 50, 32), 0);
  // Without gap closing the same click fills the outside too.
  assert.equal(at(fillMask(square(6), SIZE, SIZE, { x: 30, y: 30 }, 0), 5, 55), 1);
});

test("a fill goes through a gap wider than the gap size", () => {
  const mask = fillMask(square(12), SIZE, SIZE, { x: 30, y: 30 }, 8);
  assert.equal(at(mask, 5, 55), 1);
});

test("an area narrower than the gap size is filled, still closing the gaps it can", () => {
  // A 6 pixel wide channel between two 2 pixel lines, with a 2 pixel gap in the right one.
  const pixels = image(
    (x, y) => x === 19 || x === 20 || ((x === 27 || x === 28) && y !== 30 && y !== 31),
  );
  const mask = fillMask(pixels, SIZE, SIZE, { x: 23, y: 10 }, 16);
  assert.equal(at(mask, 21, 0), 1);
  assert.equal(at(mask, 26, 59), 1);
  assert.equal(at(mask, 18, 30), 0);
  assert.equal(at(mask, 40, 30), 0);
  // With no gap closing at all it would leak through.
  assert.equal(at(fillMask(pixels, SIZE, SIZE, { x: 23, y: 10 }, 0), 40, 30), 1);
});
