import type { CanvasDto, Point, Stroke } from "../components/game/drawing/drawingModel";
import type { GameSettings } from "../components/game/lobbySettings";

// Wire names, numeric enums and TimeSpan strings match System.Text.Json / GameHub.
export type Phase = 0 | 1 | 2 | 3 | 4;
export type SessionDto = { playerId: string; membershipToken: string };
export type SettingsDto = {
  roomId: string;
  revision: number;
  maxPlayers: number;
  wordSelectionSize: 3 | 5;
  wordChoiceTimeLimit: string;
  drawTimeLimit: string;
  numberOfRounds: number;
};
export type Message = {
  playerId: string | null;
  username: string | null;
  body: string | null;
  timeStamp: string;
  messageType: "StandardMessage" | "CorrectGuessNotification" | "SystemMessage";
};
export type MessageDto = { revision: number; roomId: string; message: Message };
export type StateDto = {
  revision: number;
  currentPhase: Phase;
  currentArtist: string | null;
  currentTurn: number | null;
  currentRound: number | null;
  maskedWord: string | null;
  revealedWord: string | null;
  phaseEndsAt: string | null;
  turnOrder: string[];
  scores: Record<string, number>;
  playersMarkedCorrect: string[];
};
export type ArtistDto = {
  revision: number;
  currentWord: string | null;
  wordChoices: string[] | null;
};
export type RoomDto = {
  roomId: string;
  hostPlayerId: string;
  revision: number;
  serverTime: string;
  players: { playerId: string; username: string }[];
  chatHistory: {
    revision: number;
    roomId: string;
    chatHistory: { messages: Message[] };
  };
  settings: SettingsDto;
  state: StateDto;
  canvas: CanvasDto;
};
export type RoomEntryDto = { session: SessionDto; room: RoomDto };
export type CanvasOperation = "Start" | "Extend" | "End" | "Undo" | "Clear";
export type CanvasUpdateDto = {
  revision: number;
  roomId: string;
  operation: CanvasOperation;
  stroke: Stroke | null;
  points: Point[] | null;
};

export function timeSpanSeconds(value: string): number {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}
export function toSettings(value: SettingsDto): GameSettings {
  return {
    wordSelectionSize: value.wordSelectionSize,
    wordChoiceTimeLimit: timeSpanSeconds(value.wordChoiceTimeLimit),
    drawingTimeLimit: timeSpanSeconds(value.drawTimeLimit),
    numberOfRounds: value.numberOfRounds,
  };
}
export function settingsRequest(value: GameSettings) {
  const duration = (seconds: number) =>
    `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return {
    wordSelectionSize: value.wordSelectionSize,
    wordChoiceTimeLimit: duration(value.wordChoiceTimeLimit),
    drawTimeLimit: duration(value.drawingTimeLimit),
    numberOfRounds: value.numberOfRounds,
  };
}
