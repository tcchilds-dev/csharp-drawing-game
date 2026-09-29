import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SUPPORTED_SCREEN_QUERY, USE_IMAGE_BACKGROUND } from "../config";
import type { GameView } from "../config";
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
import "./game/GameTransitions.css";

type GameProps = { client: GameClient; snapshot: ClientSnapshot };

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
  const colours = ["#f83f81", "#00b96d", "#2587ec", "#8538e5", "#ff9b14", "#149b8d"];
  const players: Player[] = room.players
    .map((player) => ({
      id: player.playerId,
      name: player.username,
      score: state.scores[player.playerId] ?? 0,
      isYou: player.playerId === currentUserId,
      isDrawing:
        (isChoosing || state.currentPhase === 2) && player.playerId === state.currentArtist,
      avatarColour:
        colours[parseInt(player.playerId.replace(/-/g, "").slice(0, 6), 16) % colours.length],
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
  const editable = view === "artist" && connected && !snapshot.drawingBlocked;
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
  const isRevealingResults = transition === "turn-end-to-results";
  const isReturningToLobby = transition === "results-to-lobby";
  const round = state.currentRound ?? 1;
  const outcome = hasGuessedCorrectly ? "correct" : isTurnEnd ? "missed" : "pending";
  const [colour, setColour] = useState("#253249");
  const [brushWidth, setBrushWidth] = useState(8);
  const [copyStatus, setCopyStatus] = useState("");
  const { canUndo, canClear } = useSyncExternalStore(drawing.subscribeHistory, drawing.getHistory);

  useEffect(() => {
    if (!editable) return;
    function undo(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "z" &&
        window.matchMedia(SUPPORTED_SCREEN_QUERY).matches
      ) {
        event.preventDefault();
        drawing.undo();
      }
    }
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  }, [drawing, editable]);

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
      data-view={view}
    >
      <aside
        aria-label="Players and room"
        className="panel grid min-h-0 min-w-0 grid-rows-5 overflow-hidden"
      >
        <PlayerList players={players} showScores={!isLobby} />

        <section
          aria-label="Room controls"
          className="flex min-h-0 flex-col justify-end gap-3 overflow-y-auto p-4"
        >
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
          revealing={isActivating || isRevealingResults}
          collapsing={isReturningToLobby}
          onRevealComplete={finishTransition}
          previousContent={
            isRevealingResults ? (
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
            <ResultsHeader
              winnerName={(isReturningToLobby ? lastResults : standings)[0]?.name ?? "Winner"}
            />
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
          colour={colour}
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
          colour={colour}
          onColourChange={setColour}
          brushWidth={brushWidth}
          onBrushWidthChange={setBrushWidth}
          onUndo={() => drawing.undo()}
          onClear={() => drawing.clear()}
          canUndo={editable && canUndo}
          canClear={editable && canClear}
          disabled={
            !connected || snapshot.drawingBlocked || (!editable && !(isChoosing && isArtist))
          }
        />
      </section>

      <Chat
        messages={snapshot.messages.map(({ id, message }) => ({
          id,
          authorId: message.playerId ?? undefined,
          author: message.username ?? undefined,
          text: message.body ?? "",
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
