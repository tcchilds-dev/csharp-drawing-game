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
  <strong><a href="https://toms-drawing-game.fly.dev">Play it live</a></strong>
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="#how-to-play">How to play</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#testing">Testing</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="#project-structure">Project structure</a>
</p>

<https://github.com/user-attachments/assets/9e5f4a25-0a4b-480b-aa7c-9f2286e1d673>

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

> [!TIP]
> To play with friends, use the hosted version at
> **<https://toms-drawing-game.fly.dev>** instead.

> [!NOTE]
> The site may take a little while to start up as it scales down to zero
> when not in use.

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
development, the Vite dev server proxies the hub. In production, the API serves the built
client itself. Either way, the browser only talks to one origin.

**The server is the source of truth.** Clients send commands such as `SendMessage`,
`ChooseWord` and `StartStroke`. `GameRoom` validates each command against the current
phase, the player's role and the game limits, then broadcasts the updated state to the
room. Rejected drawing commands trigger a full canvas resync to the artist.

**A clock drives each match.** `GameClock` is a hosted background service that advances
rooms through their phases when deadlines pass. Tests replace it with a fake
`TimeProvider`, so they can reach any moment in a match without waiting.

**Drawing is sent as vectors, not pixels.** Strokes use a shared 1131 × 902 logical
coordinate space, so they scale to any window size. Points are rounded to hundredths of a
unit, samples less than a unit apart are skipped, and the rest are coalesced every 20 ms
into batches of up to 1024 points. Up to four batches are in flight at once, so slow
connections keep up. Guessers render each new segment incrementally as it arrives.

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

## Deployment

The live game runs on [Fly.io](https://fly.io) in London, deployed from this repository.

- **`Dockerfile`** builds the client with Node, publishes the API with the .NET SDK, then
  copies both into a slim ASP.NET runtime image. The client goes in the API's `wwwroot`,
  so one process serves the page, the static files and the SignalR hub.
- **`fly.toml`** sets the region, HTTPS, the VM size, a `/healthz` health check and the
  connection limits.

Because rooms live in memory, the app runs on **exactly one machine**. A second machine
would split players between two separate sets of rooms. The machine stops when nobody is
connected and starts again on the next visit, so the first page load after a quiet
spell can take a few seconds. Each deploy restarts the machine and ends any matches in
progress.

To build and run the production image locally:

```bash
docker build -t drawing-game .
docker run --rm -p 8080:8080 drawing-game
```

Then open **<http://localhost:8080>**.

## Project structure

```
.
├── DrawingGame.slnx                 # .NET solution (API + tests)
├── Dockerfile                       # Production image (client + API)
├── fly.toml                         # Fly.io app configuration
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
    ├── public/                      # Fonts, sounds and background images
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

- Add rate limiting to room creation, room joining attempts, strokes, and chat messages.
- Implement a letter hint system.

## Decisions & Rationale

A lot of my decisions come down to **KISS**. To _"Maximise the amount of work not done."_
I'll try to keep explanations to things that might not be obvious in light of that.

### Error Handling

#### Why do some expected failures throw `GameException` and others return `null`?

I use null for things that are harmless in normal play and should just be ignored, like a stroke arriving after the deadline, or an unauthorized player trying to chat. Exceptions are for bugs, or invalid states that the user should know about.

#### Why have a dedicated `DrawingRejectedException` that carries a canvas snapshot?

The artist's stroke appears on their screen immediately before the server has accepted it. This needs to be the case so that drawing doesn't feel laggy. But it means that if the stroke gets rejected, the artist's canvas is no longer in agreement with the backend, so we need to send the 'true' canvas to the artist to correct theirs.

### Concurrency

#### Why are DTOs deep-copied inside the lock instead of sending the live objects?

SignalR serialises messages when it writes to each connection after the room lock is released. If I sent the live Canvas or Chat they could be modified outside the lock before serialisation. Copying under lock means the DTOs are a snapshot of a particular moment in the game.

#### Why does joining an empty room fail with "Room not found"?

There's a gap between looking a room up in the registry and taking its lock, and the last player could leave in that gap, which would effectively mean the room is to be removed. So because it's no longer a valid room, we do the same as when it doesn't exist.

#### Why are most broadcasts fire-and-forget?

We don't want a player with a slow connection holding up a hub method or a clock tick for everyone else. When a write fails, SignalR aborts the connection, the client reconnects automatically and calls `ReconnectToRoom` which returns a full room snapshot, repairing anything that was missed.

#### Why use a revision counter instead of relying on message order?

Broadcasts happen after the room's lock is released, and different players' hub calls run in parallel, so changes can be sent in a different order to the order in which they happened. Every change increments the room's revision counter, which the client can use to ignore outdated updates.

### Time

The deadline is sent as a timestamp, along with the server's current time. The client uses the difference to correct its own clock if it's wrong. The downside is that the timer can run slightly behind by however long the message took to arrive, typically <100ms. This is acceptable because the server decides when the transitions happen, not the client.

### Security

#### Why do players need a separate membership token to reconnect?

Player IDs are sent to everyone in the room, because the scoreboard and turn order use them. If we just used the IDs, any player could take over someone else's seat.

#### Why is the session saved in `sessionStorage` instead of `localStorage`?

`sessionStorage` is per tab, so it means I can have two tabs open as two separate players to help me test quickly.

### Drawing

#### Why can strokes go off the board?

I want you to be able to draw a line that leaves the canvas and is still there when your cursor comes back on. Having a stroke cut off can be jarring so I try to minimise the cases where that can happen.

### Game Design

#### Why are points calculated the way they are?

I wanted good guessing to be rewarded but also good artistry. So both guesser and artist points are calculated on remaining time, with the artist getting points for how fast the guessers guessed their drawing. The artist also gets a points multiplier, so drawing well is crucial to scoring highly.

#### Why a maximum of 6 players?

It's quite an opinionated setting, arguably you could allow players to decide. But the rationale was for pacing. With 6 players, if we assume an average turn time of ~60 seconds, each player will have to wait 5 minutes for their next turn. That's around the upper limit of what I'd consider acceptable.

The average turn time would also go up the more players you had, because for the turn to move on, either everyone guesses, or it times out, which means you have to wait for the slowest person to have guessed correctly. More players gives more chances for someone being slow.

## Credits

- **Pacifico** font by [The Pacifico Project Authors](https://github.com/googlefonts/Pacifico), licensed under the [SIL Open Font License 1.1](DrawingGame.Client/public/fonts/Pacifico-OFL.txt).
- **Placeholder background photo** by [Anni Roenkae](https://www.pexels.com/@anniroenkae/) on [Pexels](https://www.pexels.com/photo/photo-of-abstract-painting-2693212/) (currently unused).
- Inspired by [Skribbl.io](https://skribbl.io/).

## License

Released under the GNU GPLv3 license. See [LICENSE](./LICENSE) for details.
