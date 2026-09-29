// false: original solid background; true: image from public/backgrounds.
export const USE_IMAGE_BACKGROUND = false;

// Desktop/laptop requirements, measured in CSS pixels (including browser zoom).
export const SUPPORTED_SCREEN_QUERY = [
  "(min-width: 1200px)",
  "(min-height: 600px)",
  "(min-aspect-ratio: 4/3)",
  "(hover: hover)",
  "(pointer: fine)",
].join(" and ");

export type GameView = "lobby" | "word-choice" | "artist" | "guesser" | "turn-end" | "results";
