export type GameSettings = {
  wordSelectionSize: 3 | 5;
  wordChoiceTimeLimit: number;
  drawingTimeLimit: number;
  numberOfRounds: number;
};

// Match the defaults in the API's GameSettings; times here are in seconds.
export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = {
  wordSelectionSize: 3,
  wordChoiceTimeLimit: 30,
  drawingTimeLimit: 80,
  numberOfRounds: 3,
};

export const NUMERIC_SETTINGS = [
  {
    key: "wordChoiceTimeLimit",
    label: "Word choice time limit",
    min: 10,
    max: 60,
    unit: "s",
  },
  {
    key: "drawingTimeLimit",
    label: "Drawing time limit",
    min: 60,
    max: 180,
    unit: "s",
  },
  {
    key: "numberOfRounds",
    label: "Number of rounds",
    min: 1,
    max: 10,
    unit: "",
  },
] as const;

export function isGameSettings(value: unknown): value is GameSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  return (
    (settings.wordSelectionSize === 3 || settings.wordSelectionSize === 5) &&
    NUMERIC_SETTINGS.every(({ key, min, max }) => {
      const number = settings[key];
      return (
        typeof number === "number" && Number.isInteger(number) && number >= min && number <= max
      );
    })
  );
}

export function settingsMatch(left: GameSettings, right: GameSettings) {
  return (
    left.wordSelectionSize === right.wordSelectionSize &&
    NUMERIC_SETTINGS.every(({ key }) => left[key] === right[key])
  );
}

export function settingsStorageKey(roomCode: string) {
  return `drawing-game:lobby-settings:${roomCode}`;
}

export function loadSettings(roomCode: string): GameSettings {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(settingsStorageKey(roomCode)) ?? "null",
    );
    if (isGameSettings(stored)) return stored;
  } catch {
    // A missing, invalid or unavailable local preview falls back to API defaults.
  }
  return { ...DEFAULT_GAME_SETTINGS };
}
