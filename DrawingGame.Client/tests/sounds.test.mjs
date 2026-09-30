import test from "node:test";
import assert from "node:assert/strict";
import { roomSounds, timedOut } from "../src/network/roomSounds.ts";

const players = (...ids) =>
  ids.map((playerId, colourIndex) => ({ playerId, username: playerId, colourIndex }));
function room({
  phase = 0,
  deadline = null,
  serverTime = "2026-01-01T00:00:00Z",
  ids = ["host", "guest"],
  correct = [],
  scores = {},
} = {}) {
  return {
    roomId: "ABC123",
    serverTime,
    players: players(...ids),
    state: {
      currentPhase: phase,
      phaseEndsAt: deadline,
      playersMarkedCorrect: correct,
      scores,
    },
  };
}

test("entering or restoring a room plays nothing", () => {
  assert.deepEqual(roomSounds(null, room({ phase: 2 }), "guest"), []);
});

test("players joining or leaving play for everyone", () => {
  const before = room();
  assert.deepEqual(roomSounds(before, room({ ids: ["host", "guest", "third"] }), "host"), [
    "player-enters-leaves",
  ]);
  assert.deepEqual(roomSounds(before, room({ ids: ["host"] }), "host"), ["player-enters-leaves"]);
  // Reordering alone isn't a change in who is present.
  assert.deepEqual(roomSounds(before, room({ ids: ["guest", "host"] }), "host"), []);
});

test("a correct guess only plays for the guesser", () => {
  const before = room({ phase: 2, deadline: "2026-01-01T00:01:00Z", correct: ["other"] });
  const after = room({ phase: 2, deadline: "2026-01-01T00:01:00Z", correct: ["other", "guest"] });
  assert.deepEqual(roomSounds(before, after, "guest"), ["correct-guess"]);
  assert.deepEqual(roomSounds(before, after, "host"), []);
  // The final guess ends the turn early, which isn't a time-out.
  const ended = room({ phase: 3, deadline: "2026-01-01T00:00:05Z", correct: ["other", "guest"] });
  assert.deepEqual(roomSounds(before, ended, "guest"), ["correct-guess"]);
});

test("phase changes past the old deadline count as timing out", () => {
  const choosing = room({ phase: 1, deadline: "2026-01-01T00:00:30Z" });
  const drawing = room({ phase: 2, deadline: "2026-01-01T00:01:00Z" });
  const expired = { serverTime: "2026-01-01T00:01:00.100Z" };
  assert.equal(timedOut(choosing, room({ phase: 2, ...expired })), true);
  assert.equal(timedOut(drawing, room({ phase: 3, ...expired })), true);
  // The sound itself is scheduled ahead of the deadline, not played on the phase change.
  assert.deepEqual(roomSounds(drawing, room({ phase: 3, ...expired }), "guest"), []);
  // Choosing a word or everyone guessing ends the phase before its deadline.
  assert.equal(timedOut(choosing, room({ phase: 2 })), false);
  assert.equal(timedOut(drawing, room({ phase: 3 })), false);
  // Dropping below two players returns to the lobby rather than timing out.
  assert.equal(timedOut(drawing, room({ phase: 0, ...expired })), false);
  assert.equal(timedOut(null, room({ phase: 3, ...expired })), false);
});

test("starting the game and each new turn play the word choice sound", () => {
  assert.deepEqual(roomSounds(room(), room({ phase: 1 }), "guest"), ["turn-end-to-choose-word"]);
  const turnEnd = room({ phase: 3, deadline: "2026-01-01T00:00:05Z" });
  const next = { serverTime: "2026-01-01T00:00:05.100Z" };
  assert.deepEqual(roomSounds(turnEnd, room({ phase: 1, ...next }), "guest"), [
    "turn-end-to-choose-word",
  ]);
  // Not when the turn that ended was the last one.
  assert.ok(
    !roomSounds(turnEnd, room({ phase: 4, ...next }), "guest").includes("turn-end-to-choose-word"),
  );
});

test("match results play the winner sound only for players with the top score", () => {
  const ids = ["host", "guest", "third"];
  const turnEnd = room({ phase: 3, ids });
  const end = (scores) => room({ phase: 4, ids, scores });
  const scores = { host: 300, guest: 500, third: 500 };
  assert.deepEqual(roomSounds(turnEnd, end(scores), "guest"), ["match-results-winner"]);
  assert.deepEqual(roomSounds(turnEnd, end(scores), "third"), ["match-results-winner"]);
  assert.deepEqual(roomSounds(turnEnd, end(scores), "host"), ["match-results-loser"]);
});
