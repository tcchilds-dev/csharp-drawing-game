import { useState } from "react";
import { MATCH_RESULTS_DURATION_SECONDS, USE_IMAGE_BACKGROUND } from "../config";
import type { GameView } from "../config";
import Chat from "./game/Chat";
import PaintControls from "./game/PaintControls";
import PlayerList from "./game/PlayerList";
import { mockGame, mockGuessingGame, mockLobby, mockResults, mockWordChoices } from "./game/mockGame";
import Icon from "./game/Icon";
import RoundHeader from "./game/RoundHeader";
import LobbySettings from "./game/LobbySettings";
import { loadSettings } from "./game/lobbySettings";
import WordChoices from "./game/WordChoices";
import MatchResults from "./game/MatchResults";
import ResultsHeader from "./game/ResultsHeader";
import GameHeader from "./game/GameHeader";
import useGameTransition from "./game/useGameTransition";
import "./game/GameTransitions.css";

type GameProps = {
  onLeave?: () => void;
  onStartGame?: () => void;
  onCorrectGuess?: () => void;
  onTurnEnd?: () => void;
  hasGuessedCorrectly?: boolean;
  isFinalTurn?: boolean;
  view?: GameView;
};

export default function Game({
  onLeave,
  onStartGame,
  onCorrectGuess,
  onTurnEnd,
  hasGuessedCorrectly = false,
  isFinalTurn = false,
  view = "artist",
}: GameProps) {
  const isGuessing = view === "guesser";
  const isLobby = view === "lobby";
  const isChoosing = view === "word-choice";
  const isResults = view === "results";
  const isTurnEnd = view === "turn-end";
  const game = isLobby ? mockLobby : isResults ? mockResults : isGuessing || isTurnEnd ? mockGuessingGame : mockGame;
  // The local player's identity stays the same across all phases of this room.
  const [currentUserId] = useState(game.currentUserId);
  const players = game.players.map((player) => ({ ...player, isYou: player.id === currentUserId }));
  const standings = [...game.players].sort((left, right) => right.score - left.score);
  const [settings, setSettings] = useState(() => loadSettings(game.roomCode));
  const { transition, finishTransition } = useGameTransition(view);
  const isActivating = transition === "lobby-to-word-choice";
  const isRevealingResults = transition === "turn-end-to-results";
  const isReturningToLobby = transition === "results-to-lobby";
  const round = isFinalTurn && !isLobby && !isChoosing ? game.totalRounds : game.round;
  const outcome = hasGuessedCorrectly ? "correct" : isTurnEnd ? "missed" : "pending";
  const [colour, setColour] = useState("#253249");
  const [brushWidth, setBrushWidth] = useState(8);
  const [copyStatus, setCopyStatus] = useState("");

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
    // Small viewports can scroll rather than rearranging the game regions.
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
            disabled={!onLeave}
            onClick={onLeave}
            title={
              onLeave
                ? "Leave this game"
                : "Leaving a room will be available when rooms are connected"
            }
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
          previousContent={isRevealingResults ? (
            <RoundHeader
              round={round}
              totalRounds={game.totalRounds}
              word={game.word}
              outcome={hasGuessedCorrectly ? "correct" : "missed"}
              seconds={0}
              timerRunning={false}
            />
          ) : undefined}
        >
          {isResults || isReturningToLobby ? (
            <ResultsHeader winnerName={standings[0]?.name ?? "Winner"} />
          ) : (
            <RoundHeader
              key={view}
              round={round}
              totalRounds={game.totalRounds}
              word={isChoosing ? "Choosing..." : game.word}
              isGuessing={isGuessing}
              outcome={isChoosing ? "pending" : outcome}
              seconds={isTurnEnd ? 0 : isChoosing ? settings.wordChoiceTimeLimit : game.secondsLeft}
              timerRunning={!isActivating && !isTurnEnd}
              onTimeUp={isChoosing ? undefined : onTurnEnd}
            />
          )}
        </GameHeader>

        <div className="panel relative row-span-12 min-h-0 min-w-0 overflow-hidden">
          <canvas className="block h-full w-full" aria-label="Drawing canvas preview">
            Drawing canvas. Drawing interactions will be added in a later iteration.
          </canvas>
          {isLobby && (
            <div
              className="canvas-lobby-layer"
              aria-hidden={isReturningToLobby || undefined}
              inert={isReturningToLobby}
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && event.animationName === "canvas-lobby-reveal") {
                  finishTransition("canvas");
                }
              }}
            >
              <LobbySettings
                key={game.roomCode}
                roomCode={game.roomCode}
                onSave={setSettings}
                onStartGame={onStartGame}
              />
            </div>
          )}
          {isChoosing && (
            <WordChoices
              words={mockWordChoices.slice(0, settings.wordSelectionSize)}
              autoFocus={isActivating}
            />
          )}
          {(isResults || isReturningToLobby) && (
            <div
              className="canvas-results-layer"
              aria-hidden={isReturningToLobby || undefined}
              inert={isReturningToLobby}
            >
              <MatchResults leaders={standings.slice(0, 3)} />
            </div>
          )}
        </div>

        <PaintControls
          colour={colour}
          onColourChange={setColour}
          brushWidth={brushWidth}
          onBrushWidthChange={setBrushWidth}
          disabled={isGuessing || isLobby || isTurnEnd || isResults}
        />
      </section>

      <Chat
        initialMessages={game.messages}
        currentUserId={currentUserId}
        systemMessage={isResults ? `Returning to the lobby in ${MATCH_RESULTS_DURATION_SECONDS} seconds.` : undefined}
        onMessage={(text) => {
          // Local preview only; the server will validate guesses once connected.
          if (isGuessing && !hasGuessedCorrectly && text.toLowerCase() === game.word.toLowerCase()) {
            onCorrectGuess?.();
          }
        }}
      />
    </main>
  );
}
