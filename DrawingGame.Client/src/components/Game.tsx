import { useState } from "react";
import { USE_IMAGE_BACKGROUND } from "../config";
import Chat from "./game/Chat";
import PaintControls from "./game/PaintControls";
import PlayerList from "./game/PlayerList";
import { mockGame, mockGuessingGame, mockLobby } from "./game/mockGame";
import Icon from "./game/Icon";
import RoundTimer from "./game/RoundTimer";
import WordDisplay from "./game/WordDisplay";
import LobbySettings from "./game/LobbySettings";

type GameProps = {
  onLeave?: () => void;
  view?: "lobby" | "artist" | "guesser";
};

export default function Game({ onLeave, view = "artist" }: GameProps) {
  const isGuessing = view === "guesser";
  const isLobby = view === "lobby";
  const game = isLobby ? mockLobby : isGuessing ? mockGuessingGame : mockGame;
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
      aria-label={isLobby ? "Game lobby" : "Drawing game"}
      className="game-layout"
      data-image-background={USE_IMAGE_BACKGROUND}
      data-view={view}
    >
      <aside
        aria-label="Players and room"
        className="panel grid min-h-0 min-w-0 grid-rows-5 overflow-hidden"
      >
        <PlayerList players={game.players} showScores={!isLobby} />

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

      <section aria-label="Gameplay" className="gameplay">
        <header className="grid min-h-0 grid-cols-4 gap-2" aria-hidden={isLobby || undefined}>
          {isLobby ? (
            <>
              <div className="panel round-card lobby-placeholder" />
              <div className="panel word-card lobby-placeholder col-span-2" />
              <div className="panel timer-card lobby-placeholder" />
            </>
          ) : (
            <>
              <div className="panel round-card">
                <div className="round-caption">
                  <h2>Round</h2>
                  <div className="round-progress" aria-hidden="true">
                    {Array.from({ length: game.totalRounds }, (_, index) => (
                      <span key={index} className={index < game.round ? "is-complete" : ""} />
                    ))}
                  </div>
                </div>
                <p
                  className="round-count"
                  aria-label={`Round ${game.round} of ${game.totalRounds}`}
                >
                  {game.round}
                  <span className="round-total">/ {game.totalRounds}</span>
                </p>
              </div>
              <WordDisplay word={game.word} isGuessing={isGuessing} />
              <RoundTimer initialSeconds={game.secondsLeft} />
            </>
          )}
        </header>

        <div className="panel relative row-span-12 min-h-0 min-w-0 overflow-hidden">
          <canvas className="block h-full w-full" aria-label="Drawing canvas preview">
            Drawing canvas. Drawing interactions will be added in a later iteration.
          </canvas>
          {isLobby && <LobbySettings key={game.roomCode} roomCode={game.roomCode} />}
        </div>

        <PaintControls
          colour={colour}
          onColourChange={setColour}
          brushWidth={brushWidth}
          onBrushWidthChange={setBrushWidth}
          disabled={isGuessing || isLobby}
        />
      </section>

      <Chat key={view} initialMessages={game.messages} currentUserId={game.currentUserId} />
    </main>
  );
}
