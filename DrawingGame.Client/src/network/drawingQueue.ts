import { MAX_POINTS_PER_EXTENSION } from "../components/game/drawing/drawingModel.ts";
import type {
  CanvasDto,
  DrawingCommand,
  Point,
  Stroke,
} from "../components/game/drawing/drawingModel";
import { DRAWING_BATCH_INTERVAL_MS, DRAWING_MAX_IN_FLIGHT } from "../config.ts";

// Up to DRAWING_MAX_IN_FLIGHT invocations at once. SignalR sends one connection's messages
// in order and the server runs them one at a time, so order holds without waiting for
// each completion. Coalesce pointer samples for DRAWING_BATCH_INTERVAL_MS, and while the
// window is full, grow the waiting batch up to MAX_POINTS_PER_EXTENSION. A slow connection
// only delays commands, never drops them. A failure discards everything not yet sent:
// those commands may depend on the failed one.
// Commands lost to a reconnect are recovered by resyncCommands, never by replaying the
// queue (uncertain commands may already have been accepted by the server).
export class DrawingQueue {
  private queue: DrawingCommand[] = [];
  private points: Point[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private inFlight = 0;
  constructor(
    privateSend: (command: DrawingCommand) => Promise<void>,
    onFailure: (error: unknown) => void,
  ) {
    this.send = privateSend;
    this.onFailure = onFailure;
  }
  private send: (command: DrawingCommand) => Promise<void>;
  private onFailure: (error: unknown) => void;

  cancel() {
    this.generation++;
    this.inFlight = 0;
    this.queue = [];
    this.points = [];
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  push(command: DrawingCommand) {
    if (command.method === "ExtendStroke") {
      this.points.push(...command.args[0]);
      if (!this.timer)
        this.timer = setTimeout(() => {
          this.flush();
          this.drain();
        }, DRAWING_BATCH_INTERVAL_MS);
    } else {
      this.flush();
      this.queue.push(command);
      this.drain();
    }
  }
  private flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    // Top up the newest unsent batch first. While the in-flight window is full,
    // batches grow instead of queueing up behind each other.
    let offset = 0;
    const last = this.queue[this.queue.length - 1];
    if (last?.method === "ExtendStroke") {
      offset = Math.min(this.points.length, MAX_POINTS_PER_EXTENSION - last.args[0].length);
      last.args[0].push(...this.points.slice(0, offset));
    }
    for (; offset < this.points.length; offset += MAX_POINTS_PER_EXTENSION)
      this.queue.push({
        method: "ExtendStroke",
        args: [this.points.slice(offset, offset + MAX_POINTS_PER_EXTENSION)],
      });
    this.points = [];
  }
  private drain() {
    while (this.queue.length && this.inFlight < DRAWING_MAX_IN_FLIGHT) {
      const generation = this.generation;
      this.inFlight++;
      this.send(this.queue.shift()!).then(
        () => {
          if (generation !== this.generation) return;
          this.inFlight--;
          this.drain();
        },
        (error) => {
          if (generation !== this.generation) return;
          this.cancel();
          this.onFailure(error);
        },
      );
    }
  }
}

function samePoints(a: Point[], b: Point[]) {
  return a.every((point, i) => point.x === b[i].x && point.y === b[i].y);
}

// True when `prefix` is the start of `stroke` (or all of it).
function startsWith(stroke: Stroke, prefix: Stroke) {
  return (
    (stroke.type === "Fill") === (prefix.type === "Fill") &&
    stroke.colour === prefix.colour &&
    stroke.width === prefix.width &&
    stroke.points.length >= prefix.points.length &&
    samePoints(prefix.points, stroke.points)
  );
}

// Commands that bring the server's canvas up to date with the artist's local one, keeping
// what the server already has. Both snapshots list completed strokes newest-first.
export function resyncCommands(server: CanvasDto, local: CanvasDto): DrawingCommand[] {
  const theirs = [...server.completedStrokes].reverse();
  const ours = [...local.completedStrokes].reverse();
  if (local.activeStroke) ours.push(local.activeStroke);
  let kept = 0;
  while (
    kept < theirs.length &&
    kept < ours.length &&
    ours[kept].isComplete &&
    theirs[kept].points.length === ours[kept].points.length &&
    startsWith(ours[kept], theirs[kept])
  )
    kept++;

  const commands: DrawingCommand[] = [];
  const active = server.activeStroke;
  if (active && kept === theirs.length && kept < ours.length && startsWith(ours[kept], active)) {
    // The server has the start of this stroke, so only send the rest of it.
    const rest = ours[kept].points.slice(active.points.length);
    if (rest.length) commands.push({ method: "ExtendStroke", args: [rest] });
    if (ours[kept].isComplete) commands.push({ method: "EndStroke", args: [] });
    kept++;
  } else if (kept === 0 && (theirs.length || active)) {
    commands.push({ method: "ClearCanvas", args: [] });
  } else {
    // Each undo removes the server's active stroke first, then its newest completed one.
    for (let i = theirs.length - kept + (active ? 1 : 0); i > 0; i--)
      commands.push({ method: "UndoStroke", args: [] });
  }

  for (const { colour, width, points, type, isComplete } of ours.slice(kept)) {
    if (type === "Fill") {
      commands.push({ method: "FillColour", args: [{ colour, width, points: [points[0]] }] });
      continue;
    }
    commands.push({
      method: "StartStroke",
      args: [{ colour, width, points: [points[0]] }],
    });
    if (points.length > 1) commands.push({ method: "ExtendStroke", args: [points.slice(1)] });
    if (isComplete) commands.push({ method: "EndStroke", args: [] });
  }
  return commands;
}
