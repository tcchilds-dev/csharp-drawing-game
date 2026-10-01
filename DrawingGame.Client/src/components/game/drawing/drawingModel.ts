// Shared logical coordinates, independent of CSS size and device pixel density.
// These reference dimensions never constrain the panel's layout or aspect ratio.
export const BOARD_WIDTH = 1131;
export const BOARD_HEIGHT = 902;
// Mirrors GameConstants.MaxCoordinate. The API rejects points beyond it.
export const MAX_COORDINATE = 10_000;

export type Point = { x: number; y: number };
export type StrokeInput = { colour: string; width: number; points: Point[] };
export type Stroke = StrokeInput & { isComplete: boolean };
export type CanvasDto = {
  revision: number;
  roomId: string;
  completedStrokes: Stroke[];
  activeStroke: Stroke | null;
};

// Arguments matching GameHub's drawing methods.
export type DrawingCommand =
  | { method: "StartStroke"; args: [StrokeInput] }
  | { method: "ExtendStroke"; args: [Point[]] }
  | { method: "EndStroke" | "UndoStroke" | "ClearCanvas"; args: [] };

function clampCoordinate(value: number) {
  return Math.min(MAX_COORDINATE, Math.max(-MAX_COORDINATE, value));
}

function copyPoint(point: Point): Point {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Invalid drawing point");
  // Off-board points are intentional: the mouse can leave and re-enter in one
  // stroke. Clamping to the board would paint along the edge, so only clamp to the
  // API's far limit, which a captured pointer on a small canvas can still pass.
  return { x: clampCoordinate(point.x), y: clampCoordinate(point.y) };
}

function copyStroke(stroke: Stroke): Stroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}

export class DrawingModel {
  // Chronological internally; the API's Stack enumerates newest first.
  strokes: Stroke[] = [];
  activeStroke: Stroke | null = null;
  completedRevision = 0;
  private revision = 0;
  private listeners = new Set<() => void>();
  private historyListeners = new Set<() => void>();
  private history = { canUndo: false, canClear: false };
  onCommand?: (command: DrawingCommand) => void;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  subscribeHistory = (listener: () => void) => {
    this.historyListeners.add(listener);
    return () => {
      this.historyListeners.delete(listener);
    };
  };

  getHistory = () => this.history;

  private changed() {
    this.revision++;
    this.listeners.forEach((listener) => listener());
    const hasInk = this.strokes.length > 0 || this.activeStroke !== null;
    if (hasInk !== this.history.canUndo) {
      this.history = { canUndo: hasInk, canClear: hasInk };
      this.historyListeners.forEach((listener) => listener());
    }
  }

  start(colour: string, width: number, point: Point) {
    if (!/^#[0-9a-f]{6}$/i.test(colour) || !Number.isInteger(width) || width <= 0) {
      throw new Error("Invalid brush");
    }
    const first = copyPoint(point);
    this.end();
    this.activeStroke = { colour, width, points: [first], isComplete: false };
    this.onCommand?.({
      method: "StartStroke",
      args: [{ colour, width, points: [{ ...first }] }],
    });
    this.changed();
  }

  extend(points: Point[]) {
    if (!this.activeStroke) return;
    const additions: Point[] = [];
    let last = this.activeStroke.points.at(-1)!;
    for (const raw of points) {
      const point = copyPoint(raw);
      if (point.x === last.x && point.y === last.y) continue;
      additions.push(point);
      last = point;
    }
    if (!additions.length) return;
    this.activeStroke.points.push(...additions);
    this.onCommand?.({
      method: "ExtendStroke",
      args: [additions.map((point) => ({ ...point }))],
    });
    this.changed();
  }

  end() {
    if (!this.activeStroke) return;
    this.activeStroke.isComplete = true;
    this.strokes.push(this.activeStroke);
    this.activeStroke = null;
    this.completedRevision++;
    this.onCommand?.({ method: "EndStroke", args: [] });
    this.changed();
  }

  undo() {
    this.end();
    if (!this.strokes.length) return;
    this.strokes.pop();
    this.completedRevision++;
    this.onCommand?.({ method: "UndoStroke", args: [] });
    this.changed();
  }

  clear() {
    // The API clears completed strokes only, so complete any active stroke first.
    this.end();
    if (!this.strokes.length) return;
    this.strokes = [];
    this.completedRevision++;
    this.onCommand?.({ method: "ClearCanvas", args: [] });
    this.changed();
  }

  reset() {
    this.strokes = [];
    this.activeStroke = null;
    this.completedRevision++;
    this.changed();
  }

  snapshot(roomId: string): CanvasDto {
    return {
      revision: this.revision,
      roomId,
      completedStrokes: [...this.strokes].reverse().map(copyStroke),
      activeStroke: this.activeStroke ? copyStroke(this.activeStroke) : null,
    };
  }

  replace(snapshot: CanvasDto) {
    this.strokes = [...snapshot.completedStrokes].reverse().map(copyStroke);
    this.activeStroke = snapshot.activeStroke ? copyStroke(snapshot.activeStroke) : null;
    this.completedRevision++;
    this.changed();
  }

  // Apply server canvas updates without echoing commands. Keep the active object and
  // completedRevision stable on extension so the incremental renderer stays fast.
  applyRemote(
    operation: "Start" | "Extend" | "End" | "Undo" | "Clear",
    stroke: Stroke | null,
    points: Point[] | null,
  ) {
    if (operation === "Start" && stroke) this.activeStroke = copyStroke(stroke);
    else if (operation === "Extend" && this.activeStroke && points) {
      for (const point of points) this.activeStroke.points.push(copyPoint(point));
    } else if (operation === "End" && this.activeStroke) {
      this.activeStroke.isComplete = true;
      this.strokes.push(this.activeStroke);
      this.activeStroke = null;
      this.completedRevision++;
    } else if (operation === "Undo") {
      if (this.activeStroke) this.activeStroke = null;
      else this.strokes.pop();
      this.completedRevision++;
    } else if (operation === "Clear") {
      this.strokes = [];
      this.activeStroke = null;
      this.completedRevision++;
    }
    this.changed();
  }
}
