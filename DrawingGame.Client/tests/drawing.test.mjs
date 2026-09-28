import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_WIDTH, BOARD_HEIGHT, DrawingModel } from "../src/components/game/drawing/drawingModel.ts";

test("stroke commands can be serialized directly into the existing hub argument shapes", () => {
  const model = new DrawingModel();
  const commands = [];
  model.onCommand = command => commands.push(command);
  const start = { x: 15.25, y: 30.5 };
  model.start("#3b82f6", 14, start);
  model.extend([start, { x: 50.125, y: 75.25 }, { x: 50.125, y: 75.25 }]);
  model.end();
  start.x = -100;
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [
    { method: "StartStroke", args: [{ colour: "#3b82f6", width: 14, points: [{ x: 15.25, y: 30.5 }] }] },
    { method: "ExtendStroke", args: [[{ x: 50.125, y: 75.25 }]] },
    { method: "EndStroke", args: [] },
  ]);
  assert.equal(model.strokes[0].points.length, 2);
  assert.equal(model.strokes[0].isComplete, true);
  assert.equal(model.activeStroke, null);
});

test("API snapshots replay newest-first stack data in correct paint order without sharing mutable points", () => {
  const artist = new DrawingModel();
  artist.start("#ef4444", 4, { x: 100, y: 100 });
  artist.end();
  artist.start("#ffffff", 22, { x: 100, y: 100 });
  artist.end();
  artist.start("#253249", 8, { x: 200, y: 200 });
  const snapshot = artist.snapshot("ROOM");
  assert.deepEqual(snapshot.completedStrokes.map(stroke => stroke.colour), ["#ffffff", "#ef4444"]);
  const guesser = new DrawingModel();
  guesser.replace(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(guesser.strokes, artist.strokes);
  assert.deepEqual(guesser.activeStroke, artist.activeStroke);
  snapshot.completedStrokes[1].points[0].x = 999;
  snapshot.activeStroke.points[0].x = 999;
  guesser.extend([{ x: 300, y: 300 }]);
  assert.equal(artist.strokes[0].points[0].x, 100);
  assert.equal(artist.activeStroke.points.length, 1);
  assert.equal(guesser.activeStroke.points[0].x, 200);
});

test("undo and clear finish active strokes first, matching the API's completed-stroke operations", () => {
  const model = new DrawingModel();
  const commands = [];
  model.onCommand = command => commands.push(command.method);
  model.start("#253249", 8, { x: 10, y: 20 });
  model.undo();
  assert.deepEqual(commands, ["StartStroke", "EndStroke", "UndoStroke"]);
  assert.deepEqual(model.getHistory(), { canUndo: false, canClear: false });
  commands.length = 0;
  model.start("#253249", 8, { x: 10, y: 20 });
  model.clear();
  assert.deepEqual(commands, ["StartStroke", "EndStroke", "ClearCanvas"]);
  assert.equal(model.strokes.length, 0);
  assert.equal(model.activeStroke, null);
  model.undo();
  model.clear();
  assert.equal(commands.length, 3);
});

test("a new turn silently resets ink and history, and undo removes only the most recent stroke", () => {
  const model = new DrawingModel();
  model.start("#253249", 8, { x: 10, y: 20 });
  model.start("#ef4444", 22, { x: 40, y: 50 });
  model.end();
  model.undo();
  assert.equal(model.strokes.length, 1);
  assert.equal(model.strokes[0].colour, "#253249");
  const commands = [];
  model.onCommand = command => commands.push(command);
  model.reset();
  assert.deepEqual(commands, []);
  assert.deepEqual(model.getHistory(), { canUndo: false, canClear: false });
});

test("off-board movement is retained in one API stroke and one undo removes the whole gesture", () => {
  const model = new DrawingModel();
  const commands = [];
  model.onCommand = command => commands.push(command);
  const outside = [
    { x: -50, y: 100 }, { x: -50, y: -50 },
    { x: BOARD_WIDTH + 50, y: -50 }, { x: BOARD_WIDTH + 50, y: BOARD_HEIGHT + 50 },
    { x: 300, y: BOARD_HEIGHT + 50 },
  ];
  model.start("#253249", 8, { x: 100, y: 100 });
  model.extend(outside);
  assert.equal(model.strokes.length, 0);
  assert.deepEqual(model.activeStroke.points.slice(1), outside);
  assert.deepEqual(JSON.parse(JSON.stringify(commands[1])), { method: "ExtendStroke", args: [outside] });
  model.extend([{ x: 300, y: 700 }]);
  model.end();
  assert.equal(model.strokes.length, 1);
  const guesser = new DrawingModel();
  guesser.replace(JSON.parse(JSON.stringify(model.snapshot("ROOM"))));
  assert.deepEqual(guesser.strokes, model.strokes);
  model.undo();
  assert.deepEqual(model.getHistory(), { canUndo: false, canClear: false });
  assert.deepEqual(commands.map(command => command.method), ["StartStroke", "ExtendStroke", "ExtendStroke", "EndStroke", "UndoStroke"]);
});

test("invalid points and brushes are rejected without changing the active stroke", () => {
  const model = new DrawingModel();
  model.start("#253249", 8, { x: 10, y: 10 });
  assert.throws(() => model.extend([{ x: NaN, y: 0 }]));
  assert.throws(() => model.extend([{ x: 0, y: Infinity }]));
  assert.throws(() => model.start("#253249", 0.5, { x: 0, y: 0 }));
  assert.throws(() => model.start("invalid", 8, { x: 0, y: 0 }));
  assert.deepEqual(model.activeStroke.points, [{ x: 10, y: 10 }]);
});
