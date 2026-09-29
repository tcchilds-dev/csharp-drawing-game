export type Player = {
  id: string;
  name: string;
  score: number;
  isDrawing?: boolean;
  isYou?: boolean;
  avatarColour: string;
};

export type ChatMessage = {
  id: string;
  authorId?: string;
  author?: string;
  text: string;
  // Only messages without an author are notifications.
  isCorrectGuess?: boolean;
};

// Deliberately local preview data; no API or live game state is connected yet.
export const mockWordChoices = ["Mountain", "Octopus", "Lighthouse", "Bicycle", "Volcano"];

export const mockGame = {
  currentUserId: "2",
  roomCode: "ABCD12",
  round: 2,
  totalRounds: 5,
  word: "Mountain",
  secondsLeft: 45,
  players: [
    { id: "1", name: "Sophie", score: 1250, avatarColour: "#f83f81" },
    {
      id: "2",
      name: "Alex",
      score: 980,
      isYou: true,
      isDrawing: true,
      avatarColour: "#00b96d",
    },
    { id: "3", name: "Jamie", score: 850, avatarColour: "#2587ec" },
    { id: "4", name: "Morgan", score: 720, avatarColour: "#8538e5" },
    { id: "5", name: "Sam", score: 640, avatarColour: "#ff9b14" },
  ] satisfies Player[],
  messages: [
    { id: "1", text: "Welcome to the room! Say hello." },
    { id: "2", authorId: "1", author: "Sophie", text: "Hey everyone 👋" },
    { id: "3", authorId: "3", author: "Jamie", text: "Ready when you are!" },
    {
      id: "4",
      authorId: "4",
      author: "Morgan",
      text: "That last drawing was so good",
    },
    { id: "5", text: "Round 2 has started. Alex is drawing." },
    { id: "6", authorId: "5", author: "Sam", text: "Let’s do this!" },
    { id: "7", authorId: "2", author: "Alex", text: "My turn. No promises!" },
  ] satisfies ChatMessage[],
};

// The same round seen by Sophie, while Alex remains the artist.
export const mockGuessingGame = {
  ...mockGame,
  currentUserId: "1",
  players: mockGame.players.map((player) => ({
    ...player,
    isYou: player.id === "1",
  })),
};

// Alex owns the room and is configuring the next game.
export const mockLobby = {
  ...mockGame,
  players: mockGame.players.map((player) => ({ ...player, isDrawing: false })),
  messages: [
    { id: "1", text: "Welcome to the room! Invite your friends to join." },
    { id: "2", authorId: "1", author: "Sophie", text: "Hey everyone 👋" },
    { id: "3", authorId: "3", author: "Jamie", text: "Ready when you are!" },
    { id: "4", authorId: "5", author: "Sam", text: "Let’s do this!" },
    { id: "5", authorId: "2", author: "Alex", text: "Just setting things up!" },
  ] satisfies ChatMessage[],
};

export const mockResults = {
  ...mockGame,
  round: mockGame.totalRounds,
  secondsLeft: 0,
  players: mockGame.players.map((player) => ({ ...player, isDrawing: false })),
  messages: [
    ...mockGame.messages,
    { id: "8", text: "The match has finished. Thanks for playing!" },
    { id: "9", authorId: "1", author: "Sophie", text: "That was fun!" },
    { id: "10", authorId: "2", author: "Alex", text: "gg everyone!" },
  ] satisfies ChatMessage[],
};
