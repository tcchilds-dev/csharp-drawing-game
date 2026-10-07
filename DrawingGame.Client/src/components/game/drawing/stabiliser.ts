import type { Point } from "./drawingModel";

// Some browsers (Firefox) report mouse positions in whole CSS pixels. A slow or shallow
// stroke then follows a staircase, and its edges run flat along pixel rows with 1px
// jumps that antialiasing can't hide. The brush trails the pointer on a string this many
// CSS pixels long, spreading each step over a few pixels of travel.
export const STRING_LENGTH = 4;

// Works in viewport pixels, so the smoothing matches the input's pixel steps whatever
// the board's scale. Returns null until the pointer pulls the string tight.
export function createStabiliser(start: Point) {
  let brush = start;
  return (pointer: Point): Point | null => {
    const dx = pointer.x - brush.x;
    const dy = pointer.y - brush.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= STRING_LENGTH) return null;
    const pull = (distance - STRING_LENGTH) / distance;
    brush = { x: brush.x + dx * pull, y: brush.y + dy * pull };
    return brush;
  };
}
