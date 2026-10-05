import type { Phase, RoomDto } from "./contracts";

// Each name matches a file in public/sounds, with the extension listed in sounds.ts.
export const SOUNDS = [
  "chat-message",
  "correct-guess",
  "match-results-loser",
  "match-results-winner",
  "other-correct-guess",
  "player-enters-leaves",
  "time-out",
  "turn-end-to-choose-word",
] as const;
export type Sound = (typeof SOUNDS)[number];
export type SoundPlayer = {
  // fromSeconds starts partway through, for a sound that should already be playing.
  play(sound: Sound, fromSeconds?: number): void;
  stop(sound: Sound): void;
};

// Sounds are derived from consecutive accepted room snapshots rather than individual hub
// events, so a freshly entered or restored room (no previous snapshot) stays silent.
// The time-out sound is scheduled ahead of the deadline by GameClient instead.
export function roomSounds(previous: RoomDto | null, current: RoomDto, playerId: string): Sound[] {
  if (!previous || previous.roomId !== current.roomId) return [];
  const sounds: Sound[] = [];
  const before = previous.state;
  const after = current.state;

  const ids = (room: RoomDto) =>
    room.players
      .map((player) => player.playerId)
      .sort()
      .join();
  if (ids(previous) !== ids(current)) sounds.push("player-enters-leaves");

  // The guesser hears their own sound; everyone else, including the artist, hears the other.
  const newlyCorrect = after.playersMarkedCorrect.filter(
    (id) => !before.playersMarkedCorrect.includes(id),
  );
  if (newlyCorrect.includes(playerId)) sounds.push("correct-guess");
  else if (newlyCorrect.length) sounds.push("other-correct-guess");

  if (before.currentPhase !== after.currentPhase) {
    // Covers both the game starting and a turn ending with another turn to play.
    if (after.currentPhase === 1) sounds.push("turn-end-to-choose-word");

    if (after.currentPhase === 4) {
      // Sharing the top score counts as coming first.
      const scores = current.players.map((player) => after.scores[player.playerId] ?? 0);
      const won = (after.scores[playerId] ?? 0) >= Math.max(...scores);
      sounds.push(won ? "match-results-winner" : "match-results-loser");
    }
  }
  return sounds;
}

// The server stamps serverTime in the same step as the phase change, so it is only past the
// old deadline when the timer ran out, not when a word was chosen or everyone guessed.
// Moving to the lobby means too few players remain, which isn't a time-out.
export function timedOut(previous: RoomDto | null, current: RoomDto) {
  const before = previous?.state;
  return (
    !!before?.phaseEndsAt &&
    isTimedPhase(before.currentPhase) &&
    before.currentPhase !== current.state.currentPhase &&
    current.state.currentPhase !== 0 &&
    Date.parse(current.serverTime) >= Date.parse(before.phaseEndsAt)
  );
}

// The phases where the time-out sound plays as the timer runs out.
export function isTimedPhase(phase: Phase) {
  return phase === 1 || phase === 2;
}
