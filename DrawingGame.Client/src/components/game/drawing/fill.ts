import type { Point } from "./drawingModel";

// Lines with gaps up to this many board units still hold a fill in.
export const FILL_GAP = 16;
// How far a fill overlaps the lines around it, in board units. The fill is worked out at
// board resolution and scaled up, so without this a sliver of background shows between it
// and the line.
const FILL_OVERLAP = 3;
// Pixels within this much of the clicked colour, on every channel, are filled. Fainter
// antialiased line edges are painted over, so the fill meets the line without a pale fringe.
const TOLERANCE = 48;

const STRAIGHT = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
const ALL = [...STRAIGHT, [-1, -1], [1, -1], [-1, 1], [1, 1]];

// Spread the labels in `from` into unlabelled pixels where `open` is true, at most `steps`
// rings out. Each pixel takes the label of whichever neighbour reaches it first, plus
// `increment`, so an increment of 1 labels each ring with its distance. Bounded
// spreads alternate 4- and 8-connected rings, which grows an octagon close to a circle.
// Unbounded ones stay 4-connected, so a fill can't slip through the corner between two
// diagonal pixels.
function spread(
  from: Uint8Array,
  open: (i: number) => boolean,
  width: number,
  steps = Infinity,
  increment = 0,
) {
  const height = from.length / width;
  const out = from.slice();
  let frontier: number[] = [];
  for (let i = 0; i < out.length; i++) if (out[i]) frontier.push(i);
  for (let ring = 0; ring < steps && frontier.length; ring++) {
    const offsets = steps !== Infinity && ring % 2 ? ALL : STRAIGHT;
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width;
      const y = (i - x) / width;
      for (const [dx, dy] of offsets) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const j = i + dy * width + dx;
        if (!out[j] && open(j)) {
          out[j] = out[i] + increment;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  return out;
}

// The pixels a fill clicked at `seed` covers, as 1s in a width × height mask of the RGBA
// `pixels`. Lines are thickened by half the gap, so gaps up to `gap` wide close, and the
// clicked area is flood filled. The strip the thickening covered is then shared out to
// whichever area is nearest, so the fill reaches into corners and stops halfway across a gap.
// Finally it overlaps the lines slightly.
export function fillMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  seed: Point,
  gap = FILL_GAP,
) {
  const x = Math.min(width - 1, Math.max(0, Math.floor(seed.x)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(seed.y)));
  const start = y * width + x;
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) {
    const difference = Math.max(
      Math.abs(pixels[i * 4] - pixels[start * 4]),
      Math.abs(pixels[i * 4 + 1] - pixels[start * 4 + 1]),
      Math.abs(pixels[i * 4 + 2] - pixels[start * 4 + 2]),
    );
    if (difference > TOLERANCE) ink[i] = 1;
  }
  // 1 for ink, then 2 for pixels one ring away from it, 3 for two rings, and so on.
  const rings = spread(ink, () => true, width, Math.floor(gap / 2), 1);
  // Somewhere narrower than the gap, like the inside of a small letter, would disappear
  // under fully thickened lines, so only thicken them as far as the click allows.
  const radius = rings[start] ? rings[start] - 2 : Math.floor(gap / 2);
  const closed = (i: number) => rings[i] !== 0 && rings[i] <= radius + 1;
  const seedMask = new Uint8Array(ink.length);
  seedMask[start] = 1;
  const areas = spread(seedMask, (i) => !closed(i), width);
  for (let i = 0; i < areas.length; i++) if (!closed(i) && !areas[i]) areas[i] = 2;
  const fill = spread(areas, (i) => !ink[i], width).map((area) => (area === 1 ? 1 : 0));
  return spread(fill, (i) => ink[i] === 1, width, FILL_OVERLAP);
}
