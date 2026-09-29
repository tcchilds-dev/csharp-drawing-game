import { renderStroke } from "../src/components/game/drawing/renderDrawing.ts";
import { DrawingModel } from "../src/components/game/drawing/drawingModel.ts";
import { DrawingRenderer } from "../src/components/game/drawing/drawingRenderer.ts";

function makeContext(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d", { willReadFrequently: true });
}

// Compare the actual two-layer live renderer with independent replay, including
// section boundaries, irregular event batches, mouse-up, and history changes.
export function checkIncrementalRendering() {
  const failures = [];
  let cases = 0;
  for (const [width, height] of [
    [792, 631],
    [1131, 902],
    [2262, 1500],
  ]) {
    const base = makeContext(width, height),
      live = makeContext(width, height);
    const merged = makeContext(width, height),
      reference = makeContext(width, height);
    const model = new DrawingModel();
    const renderer = new DrawingRenderer(base, live);
    function compare(label, showDrawing = true) {
      renderer.paint(model, showDrawing);
      merged.clearRect(0, 0, width, height);
      merged.drawImage(base.canvas, 0, 0);
      merged.drawImage(live.canvas, 0, 0);
      reference.fillStyle = "white";
      reference.fillRect(0, 0, width, height);
      if (showDrawing) {
        for (const stroke of [...model.strokes, model.activeStroke].filter(Boolean)) {
          renderStroke(reference, stroke, width / 1131, height / 902);
        }
      }
      const actual = merged.getImageData(0, 0, width, height).data;
      const expected = reference.getImageData(0, 0, width, height).data;
      let mismatches = 0;
      // Transparent-layer compositing can round edge channels by one unit.
      for (let i = 0; i < actual.length; i++)
        if (Math.abs(actual[i] - expected[i]) > 2) mismatches++;
      cases++;
      if (mismatches) failures.push({ width, height, label, mismatches });
    }
    const spiral = (i) => ({
      x: 565 + (120 + i / 20) * Math.cos(i / 19),
      y: 451 + (120 + i / 20) * Math.sin(i / 19),
    });
    model.start("#253249", 22, spiral(0));
    compare("dot");
    let count = 1;
    for (const total of [2, 64, 65, 66, 67, 128, 129, 130, 600, 4096]) {
      model.extend(Array.from({ length: total - count }, (_, i) => spiral(count + i)));
      count = total;
      compare(`active spiral ${total}`);
    }
    // Extra samples arriving with pointer-up must be included in the commit.
    model.extend([spiral(count), spiral(count + 1)]);
    model.end();
    compare("commit spiral");
    model.start("#fa4371", 8, { x: 100, y: 100 });
    model.extend(
      Array.from({ length: 800 }, (_, i) => ({
        x: 100 + i * 0.2,
        y: 100 + 0.1 * Math.sin(i * 2.33),
      })),
    );
    compare("dense slow stroke over existing ink");
    model.end();
    compare("commit second stroke");
    model.start("#327cf1", 14, { x: 1100, y: 200 });
    model.extend([
      { x: 1160, y: 300 },
      { x: 1200, y: 500 },
      { x: 1080, y: 550 },
    ]);
    compare("leave and re-enter");
    model.end();
    compare("commit re-entry");
    renderer.invalidate();
    compare("redraw after resize or context restore");
    model.undo();
    compare("undo");
    const snapshot = model.snapshot("test-room");
    model.start("#111111", 4, { x: 20, y: 20 });
    model.extend(Array.from({ length: 200 }, (_, i) => ({ x: 20 + i, y: 20 + i })));
    compare("active before replacement");
    model.replace(snapshot);
    compare("replace discards cached active prefix");
    model.clear();
    compare("clear");
    model.start("#ffffff", 22, { x: 100, y: 100 });
    model.end();
    model.start("#123456", 4, { x: 200, y: 200 });
    model.end();
    compare("multiple strokes completed between frames");
    model.reset();
    compare("reset");
    model.replace(snapshot);
    renderer.invalidate();
    compare("hidden phase", false);
    renderer.invalidate();
    compare("restore visible phase");
  }

  // Count input reads rather than wall-clock time: extending a long stroke must
  // never rescan its history, including the last frame on mouse-up.
  for (const count of [512, 60032]) {
    const base = makeContext(1131, 902),
      live = makeContext(1131, 902);
    const model = new DrawingModel(),
      renderer = new DrawingRenderer(base, live);
    model.start("#253249", 14, { x: 200, y: 300 });
    let reads = 0;
    model.activeStroke.points = new Proxy(
      Array.from({ length: count }, (_, i) => ({
        x: 500 + 200 * Math.cos(i / 100),
        y: 450 + 200 * Math.sin(i / 100),
      })),
      {
        get(target, property, receiver) {
          if (typeof property === "string" && /^\d+$/.test(property)) reads++;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    renderer.paint(model, true);
    reads = 0;
    model.extend(Array.from({ length: 8 }, (_, i) => ({ x: 300 + i, y: 400 + i })));
    renderer.paint(model, true);
    const extendReads = reads;
    reads = 0;
    model.end();
    renderer.paint(model, true);
    cases++;
    if (extendReads > 300 || reads > 150) failures.push({ count, extendReads, commitReads: reads });
  }
  return { cases, failures };
}

// These pixel checks require a real Canvas2D implementation. Open rendering.html
// through Vite; the body reports data-status="passed" or "failed" for automation.
export function checkStrokeCoverage(render = renderStroke) {
  const failures = [];
  let cases = 0;
  for (const scale of [0.7, 1, 1.25, 2]) {
    for (const width of [4, 8, 14, 22]) {
      for (const spacing of [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8]) {
        for (const jitter of [0, 0.1, 0.4]) {
          for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = Math.ceil(256 * scale);
            const context = canvas.getContext("2d", {
              willReadFrequently: true,
            });
            context.fillStyle = "white";
            context.fillRect(0, 0, canvas.width, canvas.height);
            const cos = Math.cos(angle),
              sin = Math.sin(angle);
            const points = Array.from({ length: Math.ceil(180 / spacing) + 1 }, (_, index) => {
              const along = 30 + index * spacing - 128;
              const across = jitter * Math.sin(index * 2.33);
              return {
                x: 128 + along * cos - across * sin,
                y: 128 + along * sin + across * cos,
              };
            });
            render(context, { colour: "#253249", width, points, isComplete: true }, scale, scale);
            const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
            let gaps = 0;
            let checkedPixels = 0;
            // Only inspect pixels safely inside the brush, excluding normal edge
            // antialiasing, all possible jitter, and the two endpoint caps.
            const coreRadius = (width / 2 - jitter) * scale - 1;
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const dx = x + 0.5 - 128 * scale,
                  dy = y + 0.5 - 128 * scale;
                const along = (dx * cos + dy * sin) / scale + 128;
                const across = -dx * sin + dy * cos;
                if (along < 40 || along > 200 || Math.abs(across) > coreRadius) continue;
                checkedPixels++;
                const offset = (y * canvas.width + x) * 4;
                if (data[offset] > 42 || data[offset + 1] > 55 || data[offset + 2] > 78) gaps++;
              }
            }
            cases++;
            if (gaps || !checkedPixels)
              failures.push({
                scale,
                width,
                spacing,
                jitter,
                angle,
                gaps,
                checkedPixels,
              });
          }
        }
      }
    }
  }
  return { cases, failures };
}
