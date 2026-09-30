import type { DrawingModel } from "../components/game/drawing/drawingModel";
import type { CanvasUpdateDto } from "./contracts";
import { DRAWING_BATCH_INTERVAL_MS } from "../config.ts";

type Clock = {
  now(): number;
  schedule(callback: () => void): number;
  cancel(handle: number): void;
};

// Browsers pace playback with animation frames. Node (tests) has neither
// requestAnimationFrame nor mockable performance.now, so use timers and Date.
const defaultClock: Clock =
  typeof requestAnimationFrame === "function"
    ? {
        now: () => performance.now(),
        schedule: (callback) => requestAnimationFrame(callback),
        cancel: (handle) => cancelAnimationFrame(handle),
      }
    : {
        now: () => Date.now(),
        schedule: (callback) => setTimeout(callback, 16) as unknown as number,
        cancel: (handle) => clearTimeout(handle),
      };

// Longer gaps than this are pauses in drawing, not the artist's batch interval.
const PAUSE_MS = 250;
// Upper bound on the added latency when a slow artist sends large, infrequent batches.
const MAX_INTERVAL_MS = 150;

// Received points arrive in batches. Release them linearly over the measured gap
// between batches so the stroke grows continuously, like local drawing, instead of
// jumping once per batch. Other operations wait for earlier points to be released.
export class RemotePlayback {
  private queue: CanvasUpdateDto[] = [];
  private pending = 0;
  private deadline = 0;
  private last = 0;
  private lastArrival = -Infinity;
  private interval = DRAWING_BATCH_INTERVAL_MS;
  private frame: number | undefined;
  private model: DrawingModel;
  private clock: Clock;

  constructor(model: DrawingModel, clock = defaultClock) {
    this.model = model;
    this.clock = clock;
  }

  push(update: CanvasUpdateDto) {
    const now = this.clock.now();
    this.release(now);
    if (update.operation === "Extend") {
      if (!update.points?.length) return;
      update = { ...update, points: [...update.points] };
      const gap = now - this.lastArrival;
      if (gap < PAUSE_MS) this.interval += (Math.min(gap, MAX_INTERVAL_MS) - this.interval) / 4;
      this.lastArrival = now;
      this.pending += update.points!.length;
      this.deadline = now + this.interval;
    }
    this.queue.push(update);
    this.release(now);
    this.schedule();
  }

  // Snapshots replace everything still waiting to be played.
  cancel() {
    this.queue = [];
    this.pending = 0;
    if (this.frame !== undefined) this.clock.cancel(this.frame);
    this.frame = undefined;
  }

  private schedule() {
    if (this.frame !== undefined || !this.queue.length) return;
    this.frame = this.clock.schedule(() => {
      this.frame = undefined;
      this.release(this.clock.now());
      this.schedule();
    });
  }

  private release(now: number) {
    let budget =
      now >= this.deadline
        ? this.pending
        : Math.ceil((this.pending * (now - this.last)) / (this.deadline - this.last));
    this.last = now;
    while (this.queue.length) {
      const { operation, stroke, points } = this.queue[0];
      if (operation !== "Extend") {
        this.queue.shift();
        this.model.applyRemote(operation, stroke, points);
        continue;
      }
      if (budget <= 0) break;
      const released = points!.splice(0, budget);
      if (!points!.length) this.queue.shift();
      budget -= released.length;
      this.pending -= released.length;
      this.model.applyRemote("Extend", null, released);
    }
  }
}
