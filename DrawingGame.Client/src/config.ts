// false: original solid background; true: image from public/backgrounds.
export const USE_IMAGE_BACKGROUND = false;

export type GameView = "lobby" | "word-choice" | "artist" | "guesser" | "turn-end" | "results";

// Initial preview phase. Reload to replay the results → lobby transition.
export const GAME_VIEW: GameView = "results";

// Matches GameConstants.MatchEndDuration; live phase deadlines will replace this preview timer.
export const MATCH_RESULTS_DURATION_SECONDS = 15;

// Local preview state until these values come from live game events.
export const PREVIEW_GUESSED_CORRECTLY = true;
export const PREVIEW_IS_FINAL_TURN = true;
