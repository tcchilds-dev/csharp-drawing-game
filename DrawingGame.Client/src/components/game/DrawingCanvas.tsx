import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SUPPORTED_SCREEN_QUERY } from "../../config";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./drawing/drawingModel";
import type { DrawingModel, Point } from "./drawing/drawingModel";
import { DrawingRenderer } from "./drawing/drawingRenderer";
import "./DrawingCanvas.css";

type DrawingCanvasProps = {
  model: DrawingModel;
  colour: string;
  brushWidth: number;
  editable: boolean;
  showDrawing: boolean;
  children: ReactNode;
};

export default function DrawingCanvas({ model, colour, brushWidth, editable, showDrawing, children }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const brushRef = useRef({ colour, width: brushWidth });
  const updateBrushRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    brushRef.current = { colour, width: brushWidth };
    updateBrushRef.current?.();
  }, [colour, brushWidth]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const liveCanvas = liveCanvasRef.current!;
    const cursor = cursorRef.current!;
    // Request software-backed surfaces as a workaround for the reported GPU
    // canvas flashing during strokes and clear. Keep the live layer transparent.
    const contextOptions: CanvasRenderingContext2DSettings = { willReadFrequently: true };
    const context = canvas.getContext("2d", contextOptions)!;
    const liveContext = liveCanvas.getContext("2d", contextOptions)!;
    const renderer = new DrawingRenderer(context, liveContext);
    const supported = window.matchMedia(SUPPORTED_SCREEN_QUERY);
    let pointer: number | null = null;
    let frame = 0;
    let displayScaleX = 1;
    let displayScaleY = 1;
    let lastSize = "";
    let resolution: MediaQueryList;

    function paint() {
      frame = 0;
      renderer.paint(model, showDrawing);
    }

    function requestPaint() {
      if (!frame) frame = requestAnimationFrame(paint);
    }

    function finish() {
      const captured = pointer;
      pointer = null;
      if (captured !== null) {
        model.end();
        if (canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
      }
    }

    function hideCursor() { cursor.hidden = true; }

    function updateBrush() {
      const brush = brushRef.current;
      cursor.style.width = cursor.style.height = `${brush.width * Math.min(displayScaleX, displayScaleY)}px`;
      cursor.style.backgroundColor = brush.colour;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const size = `${rect.width}:${rect.height}:${window.devicePixelRatio}`;
      if (size === lastSize) return;
      finish();
      hideCursor();
      lastSize = size;
      displayScaleX = rect.width / BOARD_WIDTH;
      displayScaleY = rect.height / BOARD_HEIGHT;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      for (const layer of [canvas, liveCanvas]) {
        // Even assigning the same dimensions clears a canvas and resets its context.
        if (layer.width !== width) layer.width = width;
        if (layer.height !== height) layer.height = height;
      }
      updateBrush();
      renderer.invalidate();
      cancelAnimationFrame(frame);
      paint();
    }

    function watchResolution() {
      resolution?.removeEventListener("change", watchResolution);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener("change", watchResolution);
      resize();
    }

    function position(event: PointerEvent, rect: DOMRect): Point {
      return { x: (event.clientX - rect.left) / rect.width * BOARD_WIDTH,
        y: (event.clientY - rect.top) / rect.height * BOARD_HEIGHT };
    }

    function inside(point: Point) {
      return point.x >= 0 && point.x <= BOARD_WIDTH && point.y >= 0 && point.y <= BOARD_HEIGHT;
    }

    function moveCursor(point: Point) {
      cursor.hidden = !editable || !supported.matches || !inside(point);
      cursor.style.transform = `translate(${point.x * displayScaleX}px, ${point.y * displayScaleY}px) translate(-50%, -50%)`;
    }

    function start(event: PointerEvent) {
      if (!editable || !supported.matches || !event.isPrimary || event.button !== 0 || pointer !== null) return;
      const point = position(event, canvas.getBoundingClientRect());
      if (!inside(point)) return;
      event.preventDefault();
      pointer = event.pointerId;
      canvas.setPointerCapture(pointer);
      const brush = brushRef.current;
      model.start(brush.colour, brush.width, point);
      moveCursor(point);
    }

    function append(event: PointerEvent, rect: DOMRect) {
      const samples = [...(event.getCoalescedEvents?.() ?? []), event];
      // Retain the actual path outside the board instead of ending the gesture or
      // clamping it onto an edge. Canvas clips the ink and re-entry stays continuous.
      model.extend(samples.map(sample => position(sample, rect)));
    }

    function move(event: PointerEvent) {
      if (!event.isPrimary) return;
      if (!editable || !supported.matches) { finish(); hideCursor(); return; }
      // Read layout once, before writing cursor styles, and share the result with
      // every coalesced sample instead of forcing another read for each point.
      const rect = canvas.getBoundingClientRect();
      moveCursor(position(event, rect));
      if (pointer !== event.pointerId) return;
      if (!(event.buttons & 1)) { finish(); return; }
      event.preventDefault();
      append(event, rect);
    }

    function end(event: PointerEvent) {
      if (event.pointerId !== pointer) return;
      if (event.type === "pointerup" && supported.matches) append(event, canvas.getBoundingClientRect());
      finish();
    }

    function blur() { finish(); hideCursor(); }
    function visibility() { if (document.hidden) blur(); }
    function supportChanged() { if (!supported.matches) blur(); }
    function restoreContext() { renderer.invalidate(); requestPaint(); }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    updateBrushRef.current = updateBrush;
    watchResolution();
    const unsubscribe = model.subscribe(requestPaint);
    canvas.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    canvas.addEventListener("pointerleave", hideCursor);
    canvas.addEventListener("contextrestored", restoreContext);
    liveCanvas.addEventListener("contextrestored", restoreContext);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    supported.addEventListener("change", supportChanged);
    return () => {
      finish();
      hideCursor();
      unsubscribe();
      cancelAnimationFrame(frame);
      updateBrushRef.current = null;
      observer.disconnect();
      resolution.removeEventListener("change", watchResolution);
      canvas.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      canvas.removeEventListener("pointerleave", hideCursor);
      canvas.removeEventListener("contextrestored", restoreContext);
      liveCanvas.removeEventListener("contextrestored", restoreContext);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      supported.removeEventListener("change", supportChanged);
    };
  }, [model, editable, showDrawing]);

  return (
    <div className="panel drawing-panel" data-drawable={editable}>
      <canvas ref={canvasRef} className="drawing-canvas" aria-label={editable ? "Drawing canvas" : "Game canvas"}>
        {editable ? "Draw with your mouse or pen. Use the toolbar to choose a colour and brush width." : "The current game drawing."}
      </canvas>
      <canvas ref={liveCanvasRef} className="drawing-live-canvas" aria-hidden="true" />
      <div ref={cursorRef} className="brush-cursor" aria-hidden="true" hidden />
      {children}
    </div>
  );
}
