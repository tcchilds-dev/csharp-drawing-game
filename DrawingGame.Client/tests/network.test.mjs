import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { RoomState } from "../src/network/roomState.ts";
import { DrawingQueue } from "../src/network/drawingQueue.ts";
import { RemotePlayback } from "../src/network/remotePlayback.ts";
import { settingsRequest, timeSpanSeconds } from "../src/network/contracts.ts";
import { DrawingModel } from "../src/components/game/drawing/drawingModel.ts";
const message = (body) => ({
  body,
  playerId: "guest",
  username: "Guest",
  timeStamp: "2026-01-01T00:00:00Z",
  messageType: "StandardMessage",
});
function room(revision, phase = 0, deadline = null) {
  return {
    roomId: "ABC123",
    revision,
    serverTime: "2026-01-01T00:00:00Z",
    hostPlayerId: "host",
    players: [{ playerId: "host", username: "Host" }],
    settings: {
      roomId: "ABC123",
      revision,
      wordSelectionSize: 3,
      maxPlayers: 6,
      wordChoiceTimeLimit: "00:00:30",
      drawTimeLimit: "00:01:20",
      numberOfRounds: 3,
    },
    chatHistory: { roomId: "ABC123", revision, chatHistory: { messages: [] } },
    state: {
      revision,
      currentPhase: phase,
      phaseEndsAt: deadline,
      currentArtist: phase ? "host" : null,
      currentRound: 1,
      currentTurn: 1,
      maskedWord: null,
      revealedWord: null,
      scores: {},
      playersMarkedCorrect: [],
      turnOrder: ["host"],
    },
    canvas: {
      roomId: "ABC123",
      revision: 0,
      completedStrokes: [],
      activeStroke: null,
    },
  };
}
test("separate revision cursors preserve older phase update behind newer chat/settings", () => {
  const state = new RoomState();
  state.acceptRoom(room(1));
  state.acceptMessage({
    roomId: "ABC123",
    revision: 8,
    message: message("newer chat"),
  });
  state.acceptSettings({ ...room(9).settings, numberOfRounds: 10 });
  state.acceptRoom(room(5, 1, "turn-one"));
  state.acceptRoom(room(2));
  assert.equal(state.room.state.currentPhase, 1);
  assert.equal(state.room.settings.numberOfRounds, 10);
  assert.equal(state.chatMessages().at(-1).message.body, "newer chat");
});
test("full history deduplicates old messages and retains newer out-of-order events", () => {
  const state = new RoomState();
  state.acceptRoom(room(1));
  for (const revision of [4, 3, 4, 6])
    state.acceptMessage({
      roomId: "ABC123",
      revision,
      message: message(String(revision)),
    });
  const snapshot = room(4);
  snapshot.chatHistory.chatHistory.messages = [message("3"), message("4")];
  state.acceptRoom(snapshot);
  state.acceptMessage({
    roomId: "ABC123",
    revision: 3,
    message: message("duplicate"),
  });
  assert.deepEqual(
    state.chatMessages().map((item) => item.message.body),
    ["3", "4", "6"],
  );
});
test("private artist updates are only shown to the current artist and never go backwards", () => {
  const state = new RoomState();
  state.acceptRoom(room(1));
  const artist = { revision: 2, wordChoices: ["secret"], currentWord: null };
  state.acceptArtist(artist);
  assert.equal(state.privateArtist("host"), null);
  state.acceptRoom(room(2, 1, "turn-one"));
  assert.deepEqual(state.privateArtist("host").wordChoices, ["secret"]);
  assert.equal(state.privateArtist("guest"), null);
  assert.equal(state.acceptArtist({ ...artist, revision: 1, wordChoices: ["stale"] }), false);
  assert.equal(state.acceptRoom({ ...room(100), roomId: "FOREIGN" }), false);
  assert.equal(state.acceptSettings({ ...room(100).settings, roomId: "FOREIGN" }), false);
  state.reset();
  assert.equal(state.artist, null);
});
test("TimeSpan conversion handles minute boundaries and correct backend field names", () => {
  const request = settingsRequest({
    wordSelectionSize: 5,
    wordChoiceTimeLimit: 60,
    drawingTimeLimit: 180,
    numberOfRounds: 10,
  });
  assert.equal(request.wordChoiceTimeLimit, "00:01:00");
  assert.equal(request.drawTimeLimit, "00:03:00");
  assert.equal(timeSpanSeconds("00:01:20"), 80);
});
const start = {
  method: "StartStroke",
  args: [{ colour: "#000000", width: 8, points: [{ x: 1, y: 1 }] }],
};
test("drawing queue orders commands, batches points and waits for invocation completion", async () => {
  const calls = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new DrawingQueue(
    async (command) => {
      calls.push(command);
      if (calls.length === 1) await blocked;
    },
    (error) => {
      throw error;
    },
  );
  queue.push(start);
  queue.push({
    method: "ExtendStroke",
    args: [Array.from({ length: 300 }, (_, x) => ({ x, y: 0 }))],
  });
  queue.push({ method: "EndStroke", args: [] });
  queue.push({ method: "ClearCanvas", args: [] });
  assert.equal(calls.length, 1);
  release();
  await setImmediate();
  assert.deepEqual(
    calls.map((call) => call.method),
    ["StartStroke", "ExtendStroke", "ExtendStroke", "ExtendStroke", "EndStroke", "ClearCanvas"],
  );
  assert.deepEqual(
    calls.filter((call) => call.method === "ExtendStroke").map((call) => call.args[0].length),
    [128, 128, 44],
  );
  queue.cancel();
});
test("drawing queue merges points into unsent batches while a slow invocation is pending", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new DrawingQueue(
    async (command) => {
      calls.push(command);
      if (calls.length === 1) await blocked;
    },
    (error) => {
      throw error;
    },
  );
  queue.push(start);
  for (let x = 0; x < 10; x++) {
    queue.push({ method: "ExtendStroke", args: [[{ x, y: 0 }]] });
    t.mock.timers.tick(20);
  }
  queue.push({
    method: "ExtendStroke",
    args: [Array.from({ length: 130 }, (_, x) => ({ x, y: 1 }))],
  });
  queue.push({ method: "EndStroke", args: [] });
  assert.equal(calls.length, 1);
  release();
  await setImmediate();
  assert.deepEqual(
    calls.filter((call) => call.method === "ExtendStroke").map((call) => call.args[0].length),
    [128, 12],
  );
  assert.equal(calls.at(-1).method, "EndStroke");
  queue.cancel();
});
class FakeClock {
  time = 0;
  frames = new Map();
  nextHandle = 1;
  now() {
    return this.time;
  }
  schedule(callback) {
    this.frames.set(this.nextHandle, callback);
    return this.nextHandle++;
  }
  cancel(handle) {
    this.frames.delete(handle);
  }
  frame(ms = 5) {
    this.time += ms;
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    callbacks.forEach((callback) => callback());
  }
}
const remote = (operation, points = null, stroke = null) => ({
  roomId: "ABC123",
  revision: 1,
  operation,
  stroke,
  points,
});
const remoteStart = remote("Start", null, {
  colour: "#000000",
  width: 8,
  isComplete: false,
  points: [{ x: 0, y: 0 }],
});
const line = (from, to) => Array.from({ length: to - from }, (_, i) => ({ x: from + i, y: 0 }));
test("remote playback releases each batch gradually over the batch interval", () => {
  const drawing = new DrawingModel();
  const clock = new FakeClock();
  const playback = new RemotePlayback(drawing, clock);
  playback.push(remoteStart);
  assert.equal(drawing.activeStroke.points.length, 1);
  playback.push(remote("Extend", line(1, 21)));
  const counts = [];
  while (clock.frames.size) {
    clock.frame();
    counts.push(drawing.activeStroke.points.length - 1);
  }
  // 20 points over the initial 20ms estimate, in 5ms frames.
  assert.deepEqual(counts, [5, 10, 15, 20]);
  assert.deepEqual(
    drawing.activeStroke.points.map((point) => point.x),
    line(0, 21).map((point) => point.x),
  );
});
test("remote playback keeps operation order and never lags beyond the latest batch", () => {
  const drawing = new DrawingModel();
  const clock = new FakeClock();
  const playback = new RemotePlayback(drawing, clock);
  playback.push(remoteStart);
  playback.push(remote("Extend", line(1, 41)));
  clock.frame();
  playback.push(remote("End"));
  assert.equal(drawing.strokes.length, 0);
  // A frame that arrives after the deadline releases everything still owed.
  clock.frame(100);
  assert.equal(drawing.activeStroke, null);
  assert.equal(drawing.strokes[0].points.length, 41);
  // A backlog is never carried past the newest batch's deadline, even without frames.
  playback.push(remoteStart);
  playback.push(remote("Extend", line(1, 11)));
  clock.time += 200;
  playback.push(remote("Extend", line(11, 21)));
  assert.equal(drawing.activeStroke.points.length, 11);
});
test("remote playback cancellation drops unplayed updates", () => {
  const drawing = new DrawingModel();
  const clock = new FakeClock();
  const playback = new RemotePlayback(drawing, clock);
  playback.push(remoteStart);
  playback.push(remote("Extend", line(1, 21)));
  playback.push(remote("End"));
  playback.cancel();
  assert.equal(clock.frames.size, 0);
  clock.frame(100);
  assert.equal(drawing.activeStroke.points.length, 1);
  assert.equal(drawing.strokes.length, 0);
});
test("failed command discards uncertain dependent commands without replay", async () => {
  const calls = [];
  const errors = [];
  const queue = new DrawingQueue(
    async (command) => {
      calls.push(command);
      throw new Error("lost acknowledgement");
    },
    (error) => errors.push(error),
  );
  queue.push(start);
  queue.push({ method: "ExtendStroke", args: [[{ x: 2, y: 2 }]] });
  queue.push({ method: "EndStroke", args: [] });
  await setImmediate();
  assert.equal(calls.length, 1);
  assert.equal(errors.length, 1);
});
test("slow-connection queue overflow has bounded memory and requests recovery", async () => {
  const errors = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new DrawingQueue(
    () => blocked,
    (error) => errors.push(error),
  );
  queue.push(start);
  queue.push({
    method: "ExtendStroke",
    args: [Array.from({ length: 8193 }, (_, x) => ({ x, y: 0 }))],
  });
  assert.equal(errors.length, 1);
  release();
  await setImmediate();
  queue.cancel();
});
test("remote canvas updates preserve incremental renderer identity and never echo commands", () => {
  const drawing = new DrawingModel();
  const echoed = [];
  drawing.onCommand = (command) => echoed.push(command);
  drawing.applyRemote(
    "Start",
    {
      colour: "#000000",
      width: 8,
      isComplete: false,
      points: [{ x: 1, y: 1 }],
    },
    null,
  );
  const active = drawing.activeStroke;
  const revision = drawing.completedRevision;
  drawing.applyRemote("Extend", null, [
    { x: -1, y: 3 },
    { x: 4, y: 5 },
  ]);
  assert.equal(drawing.activeStroke, active);
  assert.equal(drawing.completedRevision, revision);
  drawing.applyRemote("End", null, null);
  assert.equal(drawing.strokes[0], active);
  assert.deepEqual(echoed, []);
});

// Exercise transport races with the same public hub event/invocation surface,
// without a real server, wall-clock round waits, or testing routine phase delivery.
const { GameClient } = await import("../src/network/gameClient.ts");
class FakeConnection {
  state = "Disconnected";
  connectionId = "socket";
  handlers = new Map();
  calls = [];
  on(name, callback) {
    this.handlers.set(name, callback);
  }
  onreconnecting(callback) {
    this.reconnecting = callback;
  }
  onreconnected(callback) {
    this.reconnected = callback;
  }
  onclose(callback) {
    this.closed = callback;
  }
  async start() {
    this.state = "Connected";
  }
  async stop() {
    this.state = "Disconnected";
    this.closed?.();
  }
  async invoke(method, ...args) {
    this.calls.push({ method, args });
    return this.respond(method, ...args);
  }
  emit(name, value) {
    this.handlers.get(name)?.(value);
  }
}
const stroke = (points) => ({
  colour: "#000000",
  width: 8,
  isComplete: false,
  points: points.map((x) => ({ x, y: x })),
});
function drawingEntry(playerId = "guest", revision = 10, points = [1]) {
  const value = room(revision, 2, "2026-01-01T00:02:00Z");
  value.canvas = { ...value.canvas, revision, activeStroke: stroke(points) };
  return { session: { playerId, membershipToken: "secret" }, room: value };
}
const canvasUpdate = (revision, operation, points = null) => ({
  roomId: "ABC123",
  revision,
  operation,
  stroke: null,
  points,
});

test("canvas updates are applied in place, and stale ones are ignored", async (t) => {
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  await client.enter("Guest");
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  connection.emit("SyncCanvasUpdate", canvasUpdate(11, "Extend", [{ x: 2, y: 2 }]));
  connection.emit("SyncCanvasUpdate", canvasUpdate(11, "Extend", [{ x: 9, y: 9 }]));
  connection.emit("SyncCanvasUpdate", canvasUpdate(12, "End"));
  for (let frame = 0; frame < 10; frame++) t.mock.timers.tick(16);
  assert.deepEqual(
    client.drawing.strokes[0].points.map((p) => p.x),
    [1, 2],
  );
  client.dispose();
});

test("leaving during restoration prevents late response and events from resurrecting the room", async () => {
  const connection = new FakeConnection();
  let restore;
  connection.respond = (method) =>
    method === "CreateRoom"
      ? drawingEntry()
      : new Promise((resolve) => {
          restore = resolve;
        });
  const client = new GameClient("/game", connection);
  await client.enter("Guest");
  connection.reconnecting();
  const reconnecting = connection.reconnected();
  await client.leave();
  restore(drawingEntry());
  await reconnecting;
  connection.emit("SyncRoom", room(100));
  assert.equal(client.getSnapshot().room, null);
  assert.equal(client.getSnapshot().playerId, null);
  client.dispose();
});

test("stale and foreign canvas packets cannot erase current ink", async () => {
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  await client.enter("Guest");
  connection.emit("SyncCanvas", {
    roomId: "ABC123",
    revision: 9,
    completedStrokes: [],
    activeStroke: null,
  });
  connection.emit("SyncCanvas", {
    roomId: "FOREIGN",
    revision: 100,
    completedStrokes: [],
    activeStroke: null,
  });
  connection.emit("SyncCanvasUpdate", {
    ...canvasUpdate(11, "Clear"),
    roomId: "FOREIGN",
  });
  connection.emit("SyncCanvasUpdate", canvasUpdate(9, "Clear"));
  assert.equal(client.drawing.activeStroke.points.length, 1);
  client.dispose();
});

function installSessionStorage() {
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test("a refreshed page reclaims its seat from the saved session", async (t) => {
  installSessionStorage();
  t.after(() => delete globalThis.sessionStorage);
  const before = new FakeConnection();
  before.respond = () => drawingEntry();
  const original = new GameClient("/game", before);
  await original.enter("Guest");
  original.dispose();

  const after = new FakeConnection();
  after.respond = () => drawingEntry();
  const refreshed = new GameClient("/game", after);
  assert.equal(refreshed.getSnapshot().restoring, true);
  await refreshed.restore();
  assert.deepEqual(after.calls[0], {
    method: "ReconnectToRoom",
    args: [{ roomId: "ABC123", playerId: "guest", membershipToken: "secret" }],
  });
  assert.equal(refreshed.getSnapshot().restoring, false);
  assert.equal(refreshed.getSnapshot().status, "connected");
  assert.equal(refreshed.getSnapshot().playerId, "guest");
  assert.equal(refreshed.drawing.activeStroke.points.length, 1);

  await refreshed.leave();
  assert.equal(new GameClient("/game", new FakeConnection()).getSnapshot().restoring, false);
});

test("an expired saved session falls back to the home page", async (t) => {
  const values = installSessionStorage();
  t.after(() => delete globalThis.sessionStorage);
  values.set(
    "drawing-game-session",
    JSON.stringify({ roomId: "ABC123", playerId: "guest", membershipToken: "secret" }),
  );
  const connection = new FakeConnection();
  connection.respond = async () => {
    throw new Error("Your session could not be restored.");
  };
  const client = new GameClient("/game", connection);
  await client.restore();
  assert.equal(client.getSnapshot().restoring, false);
  assert.equal(client.getSnapshot().room, null);
  assert.equal(values.size, 0);
  client.dispose();
});

test("a dispose during restoration lets the next mount restore the seat", async (t) => {
  installSessionStorage();
  t.after(() => delete globalThis.sessionStorage);
  const before = new FakeConnection();
  before.respond = () => drawingEntry();
  const original = new GameClient("/game", before);
  await original.enter("Guest");
  original.dispose();

  // React StrictMode mounts, unmounts and remounts effects in development.
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  const abandoned = client.restore();
  client.dispose();
  await Promise.all([abandoned, client.restore()]);
  assert.equal(connection.calls.length, 1);
  assert.equal(client.getSnapshot().restoring, false);
  assert.equal(client.getSnapshot().status, "connected");
  assert.equal(client.getSnapshot().playerId, "guest");
  client.dispose();
});

test("server canvas sent after a rejected command replaces the artist's local ink", async () => {
  const connection = new FakeConnection();
  connection.respond = (method) => (method === "CreateRoom" ? drawingEntry("host") : undefined);
  const client = new GameClient("/game", connection);
  await client.enter("Artist");
  client.drawing.extend([{ x: 2, y: 2 }]);
  connection.emit("SyncCanvas", drawingEntry("host", 11, [1]).room.canvas);
  assert.deepEqual(
    client.drawing.activeStroke.points.map((point) => point.x),
    [1],
  );
  client.dispose();
});

function recordSounds(client) {
  const sounds = [];
  client.sounds = {
    play: (sound, fromSeconds = 0) => sounds.push(fromSeconds ? [sound, fromSeconds] : sound),
    stop: (sound) => sounds.push(["stop", sound]),
  };
  return sounds;
}

test("sounds play for room changes after entry, but not for the entry itself", async () => {
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  const sounds = recordSounds(client);
  await client.enter("Guest");
  assert.deepEqual(sounds, []);
  const joined = room(11, 2, "2026-01-01T00:02:00Z");
  joined.players = [...joined.players, { playerId: "guest", username: "Guest" }];
  connection.emit("SyncRoom", joined);
  assert.deepEqual(sounds, ["player-enters-leaves"]);
  client.dispose();
});

test("the time-out sound starts ahead of the deadline and carries on when it expires", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-01-01T00:00:00Z") });
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  const sounds = recordSounds(client);
  await client.enter("Guest");
  t.mock.timers.tick(117_999);
  assert.deepEqual(sounds, []);
  t.mock.timers.tick(1);
  assert.deepEqual(sounds, ["time-out"]);
  const expired = room(11, 3, "2026-01-01T00:02:05Z");
  expired.serverTime = "2026-01-01T00:02:00.100Z";
  connection.emit("SyncRoom", expired);
  assert.deepEqual(sounds, ["time-out"]);
  client.dispose();
});

test("the time-out sound stops when the phase ends early", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-01-01T00:00:00Z") });
  const connection = new FakeConnection();
  connection.respond = () => drawingEntry();
  const client = new GameClient("/game", connection);
  const sounds = recordSounds(client);
  await client.enter("Guest");
  t.mock.timers.tick(119_000);
  const early = room(11, 3, "2026-01-01T00:02:05Z");
  early.serverTime = "2026-01-01T00:01:59Z";
  connection.emit("SyncRoom", early);
  assert.deepEqual(sounds, ["time-out", ["stop", "time-out"]]);
  client.dispose();
});

test("joining during the time-out lead starts the sound partway through", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-01-01T00:01:59Z") });
  const connection = new FakeConnection();
  connection.respond = () => {
    const entry = drawingEntry();
    entry.room.serverTime = "2026-01-01T00:01:59Z";
    return entry;
  };
  const client = new GameClient("/game", connection);
  const sounds = recordSounds(client);
  await client.enter("Guest");
  t.mock.timers.tick(0);
  assert.deepEqual(sounds, [["time-out", 1]]);
  client.dispose();
});
