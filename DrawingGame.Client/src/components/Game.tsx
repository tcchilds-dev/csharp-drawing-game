import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BRUSH_WIDTHS,
  DEFAULT_GAME_THEME,
  SUPPORTED_SCREEN_QUERY,
  USE_IMAGE_BACKGROUND,
} from "../config";
import type { GameTheme, GameView } from "../config";
import Chat from "./game/Chat";
import PaintControls from "./game/PaintControls";
import PlayerList from "./game/PlayerList";
import type { Player } from "./game/mockGame";
import type { GameClient, ClientSnapshot } from "../network/gameClient";
import { toSettings } from "../network/contracts";
import Icon from "./game/Icon";
import RoundHeader from "./game/RoundHeader";
import LobbySettings from "./game/LobbySettings";
import WordChoices from "./game/WordChoices";
import MatchResults from "./game/MatchResults";
import ResultsHeader from "./game/ResultsHeader";
import GameHeader from "./game/GameHeader";
import useGameTransition from "./game/useGameTransition";
import DrawingCanvas from "./game/DrawingCanvas";
import ThemePicker from "./game/ThemePicker";
import "./game/GameTransitions.css";
import "../themes/cozy.css";
import "../themes/dark.css";

type GameProps = { client: GameClient; snapshot: ClientSnapshot };

// One per seat; the server gives each player a unique index into this list.
const AVATAR_COLOURS: Record<GameTheme, string[]> = {
  light: ["#f83f81", "#00b96d", "#2587ec", "#8538e5", "#ff9b14", "#149b8d"],
  dark: ["#f83f81", "#00b96d", "#2587ec", "#8538e5", "#ff9b14", "#149b8d"],
  cozy: ["#6f4a36", "#b9783d", "#3f2a20", "#c99a62", "#9a5a36", "#8c7461"],
};

const THEME_STORAGE_KEY = "game-theme";

// Matches the White paint, which the canvas is filled with.
const ERASER_COLOUR = "#ffffff";

function savedTheme(): GameTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && saved in AVATAR_COLOURS) return saved as GameTheme;
  } catch {
    /* Storage can be unavailable, e.g. in private windows. */
  }
  return DEFAULT_GAME_THEME;
}

export default function Game({ client, snapshot }: GameProps) {
  const room = snapshot.room!;
  const currentUserId = snapshot.playerId!;
  const state = room.state;
  const isArtist = state.currentArtist === currentUserId;
  const view: GameView =
    state.currentPhase === 0
      ? "lobby"
      : state.currentPhase === 1
        ? "word-choice"
        : state.currentPhase === 2
          ? isArtist
            ? "artist"
            : "guesser"
          : state.currentPhase === 3
            ? "turn-end"
            : "results";
  const isGuessing = view === "guesser";
  const isLobby = view === "lobby";
  const isChoosing = view === "word-choice";
  const isResults = view === "results";
  const isTurnEnd = view === "turn-end";
  const connected = snapshot.status === "connected";
  const [busy, setBusy] = useState(false);
  const settings = useMemo(() => toSettings(room.settings), [room.settings]);
  const game = { roomCode: room.roomId, totalRounds: settings.numberOfRounds };
  const [theme, setTheme] = useState(savedTheme);
  const colours = AVATAR_COLOURS[theme];
  const players: Player[] = room.players
    .map((player) => ({
      id: player.playerId,
      name: player.username,
      score: state.scores[player.playerId] ?? 0,
      isYou: player.playerId === currentUserId,
      isDrawing:
        (isChoosing || state.currentPhase === 2) && player.playerId === state.currentArtist,
      avatarColour: colours[player.colourIndex % colours.length],
    }))
    .sort(
      (a, b) => b.score - a.score || state.turnOrder.indexOf(a.id) - state.turnOrder.indexOf(b.id),
    );
  const standings = players;
  // Retain the completed match while the established return-to-lobby wipe plays.
  const [resultsSnapshot, setResultsSnapshot] = useState({ room, players });
  if (isResults && resultsSnapshot.room !== room) setResultsSnapshot({ room, players });
  const lastResults = resultsSnapshot.players;
  const hasGuessedCorrectly =
    state.playersMarkedCorrect.includes(currentUserId) ||
    (isArtist && state.playersMarkedCorrect.length > 0);
  const word = isChoosing
    ? "Choosing..."
    : isTurnEnd
      ? (state.revealedWord ?? "")
      : isArtist
        ? (snapshot.artist?.currentWord ?? "")
        : (state.maskedWord ?? "");
  const [lastTurn, setLastTurn] = useState({
    source: state,
    word,
    round: state.currentRound ?? 1,
    correct: hasGuessedCorrectly,
  });
  if (isTurnEnd && lastTurn.source !== state)
    setLastTurn({
      source: state,
      word,
      round: state.currentRound ?? 1,
      correct: hasGuessedCorrectly,
    });
  const drawing = client.drawing;
  // The artist keeps drawing through a reconnect. The client resyncs their ink afterwards.
  const editable = view === "artist" && (connected || snapshot.status === "reconnecting");
  const chatAllowed = isLobby || (isGuessing && !hasGuessedCorrectly);
  async function startGame() {
    if (busy) return;
    setBusy(true);
    try {
      await client.action("StartGame");
    } finally {
      setBusy(false);
    }
  }
  const { transition, finishTransition } = useGameTransition(view);
  const isActivating = transition === "lobby-to-word-choice";
  const isStartingTurn = transition === "turn-end-to-word-choice";
  const isRevealingResults = transition === "turn-end-to-results";
  const isReturningToLobby = transition === "results-to-lobby";
  const round = state.currentRound ?? 1;
  const outcome = hasGuessedCorrectly ? "correct" : isTurnEnd ? "missed" : "pending";
  const [colour, setColour] = useState("#1a1a1a");
  const [brushWidth, setBrushWidth] = useState(8);
  // While Shift is held the brush paints white, then returns to the chosen colour.
  const [erasing, setErasing] = useState(false);
  const brushColour = erasing ? ERASER_COLOUR : colour;
  const [copyStatus, setCopyStatus] = useState("");
  const { canUndo, canClear } = useSyncExternalStore(drawing.subscribeHistory, drawing.getHistory);

  useEffect(() => {
    if (!snapshot.error) return;
    const timeout = setTimeout(client.dismissError, 5000);
    return () => clearTimeout(timeout);
  }, [client, snapshot.error]);

  // Artist shortcuts: hold Shift to paint white, R or Ctrl/Cmd+Z to undo, C to clear,
  // Ctrl+scroll to change brush size.
  useEffect(() => {
    if (!editable) return;
    const supported = window.matchMedia(SUPPORTED_SCREEN_QUERY);
    function shortcut(event: KeyboardEvent) {
      const target = event.target;
      if (
        !supported.matches ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input, textarea, select")))
      )
        return;
      if (event.key === "Shift") {
        setErasing(true);
        return;
      }
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      const modified = event.ctrlKey || event.metaKey;
      if (modified ? key === "z" && !event.shiftKey : key === "r") {
        event.preventDefault();
        drawing.undo();
      } else if (!modified && key === "c") {
        event.preventDefault();
        drawing.clear();
      }
    }
    function release(event: KeyboardEvent) {
      if (event.key === "Shift") setErasing(false);
    }
    // The Shift release is missed if it happens while the window is unfocused.
    function stopErasing() {
      setErasing(false);
    }
    function changeBrushSize(event: WheelEvent) {
      if (!event.ctrlKey || !event.deltaY || !supported.matches) return;
      // Also stops the browser zooming.
      event.preventDefault();
      setBrushWidth((width) => {
        const index = BRUSH_WIDTHS.indexOf(width) + (event.deltaY < 0 ? 1 : -1);
        return BRUSH_WIDTHS[Math.min(BRUSH_WIDTHS.length - 1, Math.max(0, index))];
      });
    }
    window.addEventListener("keydown", shortcut);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", stopErasing);
    window.addEventListener("wheel", changeBrushSize, { passive: false });
    return () => {
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", stopErasing);
      window.removeEventListener("wheel", changeBrushSize);
      setErasing(false);
    };
  }, [drawing, editable]);

  function chooseTheme(next: GameTheme) {
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* The choice still applies for this visit. */
    }
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(game.roomCode);
      setCopyStatus("Room code copied.");
    } catch {
      setCopyStatus("Could not copy. Select the code to copy it manually.");
    }
  }

  return (
    // Preserve five equal columns and the requested row proportions at all sizes.
    // ScreenGuard covers unsupported viewports without rearranging these regions.
    <main
      aria-label={isLobby ? "Game lobby" : isResults ? "Match results" : "Drawing game"}
      className="game-layout"
      data-image-background={USE_IMAGE_BACKGROUND}
      data-theme={theme}
      data-view={view}
    >
      <aside
        aria-label="Players and room"
        className="panel grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
      >
        <PlayerList players={players} showScores={!isLobby} />

        <section
          aria-label="Room controls"
          className="flex min-h-0 flex-col justify-end gap-3 overflow-y-auto p-4"
        >
          <ThemePicker theme={theme} onChange={chooseTheme} />
          <button
            className="room-code"
            type="button"
            onClick={copyRoomCode}
            aria-label={`Copy room code ${game.roomCode}`}
            title="Copy room code"
          >
            <span className="min-w-0 text-left">
              <span className="room-code-label">
                {copyStatus === "Room code copied." ? "Copied!" : "Room code"}
              </span>
              <span className="room-code-value select-all">{game.roomCode}</span>
            </span>
            <Icon name={copyStatus === "Room code copied." ? "check" : "copy"} size={18} />
          </button>
          <p
            role="status"
            className={
              copyStatus && copyStatus !== "Room code copied." ? "text-xs text-muted" : "sr-only"
            }
          >
            {copyStatus}
          </p>
          <button
            className="control leave-button w-full"
            disabled={busy}
            onClick={() => {
              void client.leave().catch(() => {});
            }}
            title="Leave this game"
          >
            Leave game
          </button>
        </section>
      </aside>

      <section aria-label="Gameplay" className="gameplay" data-transition={transition ?? undefined}>
        <GameHeader
          muted={isLobby}
          revealing={isActivating || isStartingTurn || isRevealingResults}
          collapsing={isReturningToLobby}
          onRevealComplete={finishTransition}
          previousContent={
            isStartingTurn || isRevealingResults ? (
              <RoundHeader
                round={lastTurn.round}
                totalRounds={game.totalRounds}
                word={lastTurn.word}
                outcome={lastTurn.correct ? "correct" : "missed"}
                seconds={0}
                timerRunning={false}
              />
            ) : undefined
          }
        >
          {isResults || isReturningToLobby ? (
            <ResultsHeader />
          ) : (
            <RoundHeader
              key={`${state.currentPhase}:${state.phaseEndsAt}`}
              round={round}
              totalRounds={game.totalRounds}
              word={isChoosing ? "Choosing..." : word}
              isGuessing={isGuessing}
              outcome={isChoosing ? "pending" : outcome}
              seconds={
                isTurnEnd
                  ? 0
                  : isChoosing
                    ? settings.wordChoiceTimeLimit
                    : settings.drawingTimeLimit
              }
              deadline={state.phaseEndsAt ? Date.parse(state.phaseEndsAt) : null}
              serverOffset={snapshot.serverOffset}
              timerRunning={!isLobby && !isTurnEnd}
            />
          )}
        </GameHeader>

        <DrawingCanvas
          model={drawing}
          colour={brushColour}
          brushWidth={brushWidth}
          editable={editable}
          showDrawing={view === "artist" || isGuessing || isTurnEnd}
        >
          {isLobby && (
            <div
              className="canvas-lobby-layer"
              aria-hidden={isReturningToLobby || undefined}
              inert={isReturningToLobby}
              onAnimationEnd={(event) => {
                if (
                  event.target === event.currentTarget &&
                  event.animationName === "canvas-lobby-reveal"
                ) {
                  finishTransition("canvas");
                }
              }}
            >
              <LobbySettings
                settings={settings}
                isHost={room.hostPlayerId === currentUserId}
                busy={!connected || busy}
                onSave={(value) => client.saveSettings(value)}
                onStartGame={startGame}
              />
            </div>
          )}
          {isChoosing && isArtist && (
            <WordChoices
              key={state.phaseEndsAt}
              words={snapshot.artist?.wordChoices ?? []}
              disabled={!connected}
              autoFocus={isActivating}
              onChoose={(word) => client.action("ChooseWord", word)}
            />
          )}
          {(isResults || isReturningToLobby) && (
            <div
              className="canvas-results-layer"
              aria-hidden={isReturningToLobby || undefined}
              inert={isReturningToLobby}
            >
              <MatchResults leaders={(isReturningToLobby ? lastResults : standings).slice(0, 3)} />
            </div>
          )}
        </DrawingCanvas>

        <PaintControls
          colour={brushColour}
          onColourChange={setColour}
          brushWidth={brushWidth}
          onBrushWidthChange={setBrushWidth}
          onUndo={() => drawing.undo()}
          onClear={() => drawing.clear()}
          canUndo={editable && canUndo}
          canClear={editable && canClear}
          disabled={!editable && !(connected && isChoosing && isArtist)}
        />
      </section>

      <Chat
        messages={snapshot.messages.map(({ id, message }) => ({
          id,
          authorId: message.playerId ?? undefined,
          author: message.username ?? undefined,
          text: message.body ?? "",
          isCorrectGuess: message.messageType === "CorrectGuessNotification",
        }))}
        currentUserId={currentUserId}
        disabled={!connected || !chatAllowed}
        placeholder={
          !connected
            ? "Reconnecting…"
            : isArtist && !isLobby
              ? "You’re drawing this turn"
              : hasGuessedCorrectly
                ? "You guessed it!"
                : !chatAllowed
                  ? "Chat resumes in the lobby"
                  : "Type a message…"
        }
        systemMessage={
          isResults
            ? `Returning to the lobby in ${Math.max(0, Math.ceil((Date.parse(state.phaseEndsAt!) - Date.parse(room.serverTime)) / 1000))} seconds.`
            : undefined
        }
        onMessage={(text) => client.action("SendMessage", text)}
      />
      {(snapshot.error || !connected) && (
        <div className="connection-notification" role="alert">
          <span>
            {snapshot.error ||
              (snapshot.status === "reconnecting"
                ? "Connection interrupted. Reconnecting to your room…"
                : "Disconnected from the room. Leave and rejoin to continue.")}
          </span>
          {snapshot.error && (
            <button type="button" onClick={client.dismissError} aria-label="Dismiss notification">
              ×
            </button>
          )}
        </div>
      )}
    </main>
  );
}
