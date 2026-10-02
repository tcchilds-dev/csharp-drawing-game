import { useRef, useState } from "react";
import type { FormEvent } from "react";
import "./Home.css";

export type RoomEntry = { playerName: string; roomCode?: string };
type EntryError = { field: "name" | "code" | "server"; message: string };
type HomeProps = {
  initialPlayerName?: string;
  onEnterRoom: (entry: RoomEntry) => Promise<void>;
};

export default function Home({ initialPlayerName = "", onEnterRoom }: HomeProps) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initialPlayerName);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<EntryError | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  function reportError(field: EntryError["field"], message: string) {
    setError({ field, message });
    (field === "name" ? nameInput : codeInput).current?.focus();
  }

  async function enterRoom(intent: "create" | "join") {
    if (busy) return;
    const playerName = name.trim();
    // Match RoomRegistry's trimmed username length and RoomIdGenerator's format.
    if (playerName.length < 2 || playerName.length > 16) {
      reportError("name", "Your name must be between 2 and 16 characters long.");
      return;
    }
    const code = roomCode.trim().toUpperCase();
    if (intent === "join" && !code) {
      reportError("code", "Enter a room code to join, or create a room of your own.");
      return;
    }
    if (intent === "join" && !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      reportError(
        "code",
        "That room code isn’t valid. Use the 6-character code shared by your host.",
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onEnterRoom({
        playerName,
        roomCode: intent === "join" ? code : undefined,
      });
    } catch (error) {
      setError({
        field: "server",
        message:
          error instanceof Error
            ? error.message
            : "Could not connect to the game. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter joins when a code is supplied; otherwise it creates a room.
    enterRoom(roomCode.trim() ? "join" : "create");
  }

  return (
    <main className="home-layout" aria-labelledby="home-title">
      <header>
        <h1 id="home-title" className="home-title">
          Tom’s Drawing Game
        </h1>
      </header>

      <form
        aria-busy={busy}
        className="home-form"
        aria-label="Create or join a room"
        autoComplete="off"
        onSubmit={submit}
        noValidate
      >
        <label className="home-field" htmlFor="player-name">
          <span className="home-field-label">Player name</span>
          <input
            ref={nameInput}
            id="player-name"
            name="playerName"
            className="home-input"
            required
            autoComplete="off"
            data-bwignore="true"
            spellCheck={false}
            placeholder="Pick a name"
            value={name}
            aria-invalid={error?.field === "name" || undefined}
            aria-describedby={error?.field === "name" ? "home-error-message" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (error?.field === "name") setError(null);
            }}
          />
        </label>

        <label className="home-field" htmlFor="room-code">
          <span className="home-field-label">Room code</span>
          <input
            ref={codeInput}
            id="room-code"
            name="roomCode"
            className="home-input home-code-input"
            autoComplete="off"
            data-bwignore="true"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="e.g. ABCD23"
            value={roomCode}
            aria-invalid={error?.field === "code" || undefined}
            aria-describedby={error?.field === "code" ? "home-error-message" : undefined}
            onChange={(event) => {
              setRoomCode(event.target.value.toUpperCase());
              if (error?.field === "code") setError(null);
            }}
          />
        </label>

        <div className="home-actions">
          <button
            disabled={busy}
            type="button"
            className="home-button home-create-button"
            onClick={() => enterRoom("create")}
          >
            Create Room
          </button>
          <button
            disabled={busy}
            type="button"
            className="home-button home-join-button"
            onClick={() => enterRoom("join")}
          >
            Join Room
          </button>
        </div>
        {/* Allows native Enter-to-submit with two text fields and explicit action buttons. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      <div className="home-notification-region" aria-live="assertive" aria-atomic="true">
        {error && (
          <div className="home-notification">
            <svg
              className="home-notification-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6m0 3v1" />
            </svg>
            <div className="home-notification-copy">
              <p className="home-notification-title">
                {error.field === "name"
                  ? "Check your name"
                  : error.field === "code"
                    ? "Check the room code"
                    : "Could not enter the room"}
              </p>
              <p id="home-error-message">{error.message}</p>
            </div>
            <button
              type="button"
              className="home-notification-dismiss"
              aria-label="Dismiss notification"
              onClick={() => {
                (error.field === "name" ? nameInput : codeInput).current?.focus();
                setError(null);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
