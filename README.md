<h1 align="center">Tom’s Drawing Game</h1>

<p align="center">
  <em>A real-time multiplayer drawing and guessing game.</em>
</p>

<p align="center">
  <img alt=".NET 10" src="https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white">
  <img alt="ASP.NET Core SignalR" src="https://img.shields.io/badge/SignalR-realtime-512BD4?logo=dotnet&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="#how-to-play">How to play</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#testing">Testing</a> ·
  <a href="#project-structure">Project structure</a>
</p>

## About

> [!NOTE]
> Contains information about AI usage.

This project is a rewrite of one of my first projects. I rewrote the backend in
C# using the ASP.NET Core framework as a learning experience in using the language.

For the frontend I used agentic coding, a mix of Codex and Claude Code. The UI
layout, look, and animations were designed entirely by myself, but the implementation
was done by coding agents. I chose this set up for two reasons:

1. I wanted to focus primarily on the backend implementation and have it be
   entirely my own, written from scratch, without any AI help, because the backend
   is my targeted area of competence.
2. It's becoming clear that many roles are looking for familiarity with
   coding agents. This was a way to keep my backend code a demonstration of my
   ability only, whilst using coding agents in the project to show my familiarity
   with those tools along side it.

There was a lot of back and forth with the agents trying to get my design dialed
in properly, and to remove typical vibe coding hiccups and rough edges. Hopefully
I've accomplished that. Though frontend design is not my area of expertise.

As for the backend, I tried to keep the implementation as simple as possible,
taking a pragmatic approach to balancing guarantees with simplicity.

## Features

- **Real-Time Drawing:** Brush strokes stream to other players as they're drawn.
- **Private Rooms:** Create a room and share its six-character code with friends.
- **In-Game Chat:** Used for chatting and guessing!
- **Game Settings:** Change the game options to play how you enjoy.
- **Drop-In Reconnection:** Players have a 30 second grace period when disconnected.
- **Line Smoothing:** Curve smoothing and incremental rendering keep long strokes
  smooth.

## Getting started

### Prerequisites

| Tool                                                          | Version              | Check with         |
| ------------------------------------------------------------- | -------------------- | ------------------ |
| [.NET SDK](https://dotnet.microsoft.com/download/dotnet/10.0) | 10.0                 | `dotnet --version` |
| [Node.js](https://nodejs.org/)                                | 22.18 or newer       | `node --version`   |
| npm                                                           | Bundled with Node.js | `npm --version`    |

> [!NOTE]
> The game is built for desktop and laptop screens. It needs a mouse or trackpad and a
> browser window at least **1200 × 600** CSS pixels. On anything smaller, an overlay asks
> you to resize the window or use a bigger screen.

### 1. Clone the repository

```bash
git clone https://github.com/tcchilds-dev/csharp-drawing-game.git
cd csharp-drawing-game
```

### 2. Start the backend

```bash
dotnet run --project DrawingGame.Api
```

The API listens on **<http://localhost:5266>**. Leave it running. You can check it's up with:

```bash
curl http://localhost:5266/healthz
```

### 3. Start the frontend

In a second terminal:

```bash
cd DrawingGame.Client
npm install
npm run dev
```

Open the URL Vite prints (normally **<http://localhost:5173>**).

### 4. Play

Enter a name and create a room. To try multiplayer on your own machine, open a second
browser window, enter a different name and join with the room code.

> [!NOTE]
> The app will be publicly hosted soon, allowing true multiplayer with
> friends.

**Custom word lists:** Put one word or phrase on each line. Blank lines and duplicates
(ignoring case) are skipped. The list needs at least as many words as the largest
selection size (five). Restart the API after editing it.

## How to play

1. One player **creates a room** and shares the room code. Up to **6 players** can play together.
2. The host can adjust the match settings and **start the game**.
3. Each turn, one player is the **artist**. They choose a word from a random selection, then draw it.
4. Everyone else tries to **guess the word**. Points are awarded for correct guesses.
5. The turn ends when the timer runs out or everyone has guessed correctly. Then the word is revealed.
6. Every player draws once per round. After the final round, the results screen shows the
   final scores, then everyone returns to the lobby for a rematch.

### Scoring

> [!NOTE]
> Scoring system is subject to change.

| Who     | Points                                                                  |
| ------- | ----------------------------------------------------------------------- |
| Guesser | **150** for an instant guess, dropping steadily to **50** at the buzzer |
| Artist  | **25** for each player who guesses correctly                            |

### Match settings

The host can change these in the lobby:

| Setting              | Default | Range   |
| -------------------- | ------- | ------- |
| Rounds               | 3       | 1–10    |
| Draw time            | 80s     | 60–180s |
| Word-choice time     | 30s     | 10–60s  |
| Words to choose from | 3       | 3 or 5  |

## How it works

The backend is an ASP.NET Core app with a single [SignalR](https://learn.microsoft.com/aspnet/core/signalr/introduction)
hub at `/game`. The React frontend opens one WebSocket connection to that hub. During
development, the Vite dev server proxies the hub, so the browser only talks to one origin.

**The server is the source of truth.** Clients send commands such as `SendMessage`,
`ChooseWord` and `StartStroke`. `GameRoom` validates each command against the current
phase, the player's role and the game limits, then broadcasts the updated state to the
room. Rejected drawing commands trigger a full canvas resync to the artist.

**A clock drives each match.** `GameClock` is a hosted background service that advances
rooms through their phases when deadlines pass. Tests replace it with a fake
`TimeProvider`, so they can reach any moment in a match without waiting.

**Drawing is sent as vectors, not pixels.** Strokes use a shared 1131 × 902 logical
coordinate space, so they scale to any window size. Pointer samples are coalesced every
40 ms and sent in batches of up to 128 points. Guessers render each new segment
incrementally as it arrives.

**State is in memory.** Rooms live in memory and are removed when the last player
leaves. Restarting the API ends every match in progress. This is acceptable
because the rooms and players are ephemeral in nature anyway.

## Testing

### Backend

```bash
dotnet test DrawingGame.slnx
```

The xUnit suite focuses on edge cases that are hard to reach through normal play: invalid
input, concurrent joins, commands that arrive exactly at a deadline, reconnection, etc.

### Frontend

```bash
cd DrawingGame.Client
npm test          # stroke lifecycle, point validation and wire-format tests
npm run lint      # oxlint
npm run build     # type-checks, then produces a production build in dist/
```

Pixel-level rendering checks run in a real browser. With `npm run dev` running, open
**<http://localhost:5173/tests/rendering.html>**.

## Project structure

```
.
├── DrawingGame.slnx                 # .NET solution (API + tests)
├── DrawingGame.Api/                 # ASP.NET Core backend
│   ├── Program.cs                   # Service registration and endpoints
│   ├── word-list.txt                # Words the artist chooses from
│   └── Game/
│       ├── GameHub.cs               # SignalR hub: the client-facing API
│       ├── IGameClient.cs           # Messages the server pushes to clients
│       ├── RoomRegistry.cs          # Creates, finds and cleans up rooms
│       ├── GameRoom.cs              # Rules, phases and scoring for one room
│       ├── GameClock.cs             # Background service that advances phases
│       ├── GameInternals/           # Canvas, chat, players, settings, state
│       ├── DataTransferObjects/     # Request and response contracts
│       └── Utilities/               # Constants, room codes, word list
├── DrawingGame.Api.Tests/           # xUnit edge-case testing suite
└── DrawingGame.Client/              # React + Vite frontend
    ├── public/                      # Fonts and background images
    ├── tests/                       # Node tests and browser rendering checks
    └── src/
        ├── App.tsx                  # Chooses between the home and game views
        ├── config.ts                # Frontend settings
        ├── components/
        │   ├── Home.tsx             # Name entry and create/join room
        │   ├── Game.tsx             # In-game layout
        │   ├── ScreenGuard.tsx      # Overlay for unsupported screen sizes
        │   └── game/                # Canvas, chat, timer, lobby, results...
        │       └── drawing/         # Stroke model, smoothing and rendering
        └── network/                 # SignalR client, contracts, drawing queue
```

## Roadmap

I intend to do the following before I consider the project's first version complete:

- Public deployment.
- Sound effects for the game.
- A better thought out scoring system.
- A discussion in the README about the various decisions I've made in the process
  of designing this application.
- A gif of gameplay for the README.
- Possibly speed up the batches to one every ~20ms to improve smoothness.

## Credits

- **Pacifico** font by [The Pacifico Project Authors](https://github.com/googlefonts/Pacifico), licensed under the [SIL Open Font License 1.1](DrawingGame.Client/public/fonts/Pacifico-OFL.txt).
- **Placeholder background photo** by [Anni Roenkae](https://www.pexels.com/@anniroenkae/) on [Pexels](https://www.pexels.com/photo/photo-of-abstract-painting-2693212/) (currently unused).
- Inspired by [Skribbl.io](https://skribbl.io/).

## License

Released under the GNU GPLv3 license. See [LICENSE](./LICENSE) for details.
