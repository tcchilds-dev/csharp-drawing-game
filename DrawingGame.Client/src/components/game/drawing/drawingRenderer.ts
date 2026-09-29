import { BOARD_HEIGHT, BOARD_WIDTH } from "./drawingModel";
import type { DrawingModel, Stroke } from "./drawingModel";
import { renderStroke, renderStrokeSection, STROKE_SECTION_SIZE } from "./renderDrawing";
import type { InkBounds } from "./renderDrawing";

// The base holds completed strokes AND the settled prefix of the active stroke.
// Only its last (at most 64) curves are repainted on the transparent live layer.
export class DrawingRenderer {
  private base: CanvasRenderingContext2D;
  private live: CanvasRenderingContext2D;
  private revision = -1;
  private active: Stroke | null = null;
  private nextCurve = 1;
  private preview: InkBounds | null = null;

  constructor(base: CanvasRenderingContext2D, live: CanvasRenderingContext2D) {
    this.base = base;
    this.live = live;
  }

  invalidate() {
    this.revision = -1;
    this.active = null;
    this.nextCurve = 1;
    this.preview = null;
    this.live.clearRect(0, 0, this.live.canvas.width, this.live.canvas.height);
  }

  private clearPreview() {
    if (!this.preview) return;
    const { left, top, width, height } = this.preview;
    this.live.clearRect(left, top, width, height);
    this.preview = null;
  }

  private drawActive(stroke: Stroke, complete: boolean, scaleX: number, scaleY: number) {
    this.clearPreview();
    while (this.nextCurve + STROKE_SECTION_SIZE <= stroke.points.length - 1) {
      renderStrokeSection(
        this.base,
        stroke,
        scaleX,
        scaleY,
        this.nextCurve,
        this.nextCurve + STROKE_SECTION_SIZE,
        false,
      );
      this.nextCurve += STROKE_SECTION_SIZE;
    }
    const bounds = renderStrokeSection(
      complete ? this.base : this.live,
      stroke,
      scaleX,
      scaleY,
      this.nextCurve,
      stroke.points.length - 1,
      true,
    );
    if (!complete) this.preview = bounds;
  }

  paint(model: DrawingModel, showDrawing: boolean) {
    const { width, height } = this.base.canvas;
    const scaleX = width / BOARD_WIDTH;
    const scaleY = height / BOARD_HEIGHT;
    if (this.revision !== model.completedRevision) {
      if (
        showDrawing &&
        this.active &&
        model.completedRevision === this.revision + 1 &&
        model.strokes.at(-1) === this.active
      ) {
        // Mouse-up only commits the remaining tail, even after a very long stroke.
        this.drawActive(this.active, true, scaleX, scaleY);
      } else {
        // Undo, clear, snapshot replacement, resize, or a fresh renderer.
        this.clearPreview();
        this.base.fillStyle = "white";
        this.base.fillRect(0, 0, width, height);
        if (showDrawing) {
          for (const stroke of model.strokes) renderStroke(this.base, stroke, scaleX, scaleY);
        }
      }
      this.active = null;
      this.nextCurve = 1;
      this.revision = model.completedRevision;
    }

    if (showDrawing && model.activeStroke) {
      if (this.active !== model.activeStroke) {
        this.active = model.activeStroke;
        this.nextCurve = 1;
      }
      this.drawActive(this.active, false, scaleX, scaleY);
    } else {
      this.clearPreview();
    }
  }
}
