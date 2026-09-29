import type { DrawingCommand, Point } from "../components/game/drawing/drawingModel";

// One invocation at a time: SignalR completion is the ordering barrier. Coalesce
// pointer samples for 40ms, cap each payload below SignalR's default 32KB limit,
// and bound memory when a slow connection cannot keep up. Never replay uncertain
// commands after reconnect (they may already have been accepted by the server).
export class DrawingQueue {
  private queue: DrawingCommand[] = [];
  private points: Point[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private running = false;
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
          void this.drain();
        }, 40);
    } else {
      this.flush();
      this.queue.push(command);
      void this.drain();
    }
    if (
      this.points.length +
        this.queue.reduce(
          (n, item) => n + (item.method === "ExtendStroke" ? item.args[0].length : 1),
          0,
        ) >
      8192
    ) {
      this.cancel();
      this.onFailure(
        new Error("The connection cannot keep up with drawing. Some of your stroke was not sent."),
      );
    }
  }
  private flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    for (let offset = 0; offset < this.points.length; offset += 128)
      this.queue.push({
        method: "ExtendStroke",
        args: [this.points.slice(offset, offset + 128)],
      });
    this.points = [];
  }
  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const generation = this.generation;
        try {
          await this.send(this.queue.shift()!);
        } catch (error) {
          if (generation === this.generation) {
            this.cancel();
            this.onFailure(error);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
