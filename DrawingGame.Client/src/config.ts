import type { Sound } from "./network/roomSounds";

// Game view background. false: original solid background; true: image from public/backgrounds.
export const USE_IMAGE_BACKGROUND = false;

// Game view colour scheme until a player picks one. The home view is unaffected.
export const DEFAULT_GAME_THEME: GameTheme = "cozy";

// Desktop/laptop requirements, measured in CSS pixels (including browser zoom).
export const SUPPORTED_SCREEN_QUERY = [
  "(min-width: 1200px)",
  "(min-height: 600px)",
  "(min-aspect-ratio: 4/3)",
  "(hover: hover)",
  "(pointer: fine)",
].join(" and ");

// Volume of each sound effect in public/sounds, from 0 (silent) to 1 (the file's own level).
export const SOUND_VOLUMES: Record<Sound, number> = {
  "correct-guess": 0.25,
  "match-results-loser": 0.25,
  "match-results-winner": 0.25,
  "player-enters-leaves": 1,
  "time-out": 0.1,
  "turn-end-to-choose-word": 0.1,
};

// How often the artist sends batches of stroke points. Guessers play each batch
// back gradually over the measured gap, starting from this estimate.
export const DRAWING_BATCH_INTERVAL_MS = 20;

// How many drawing invocations may await the server at once. Throughput is about this many
// full batches per round trip, so slow connections keep up without waiting on each reply.
export const DRAWING_MAX_IN_FLIGHT = 4;

// How long before a word choice or drawing timer hits zero the time-out sound starts.
export const TIME_OUT_SOUND_LEAD_SECONDS = 2;

export type GameTheme = "light" | "cozy" | "dark";

export type GameView = "lobby" | "word-choice" | "artist" | "guesser" | "turn-end" | "results";
