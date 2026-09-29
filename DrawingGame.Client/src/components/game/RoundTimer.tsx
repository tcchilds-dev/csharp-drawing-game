import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type RoundTimerProps = {
  initialSeconds: number;
  deadline?: number | null;
  serverOffset?: number;
  running?: boolean;
  onTimeUp?: () => void;
};

export default function RoundTimer({
  initialSeconds,
  running = true,
  onTimeUp,
  deadline,
  serverOffset = 0,
}: RoundTimerProps) {
  const initialMs = Math.max(0, initialSeconds * 1000);
  const [remainingMs, setRemainingMs] = useState(initialMs);

  useEffect(() => {
    if (!running) return;

    // Deadlines come from the server. This clock only paints; it never advances a phase.
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      // A frame timestamp can precede an effect that starts during that frame.
      const elapsed = Math.max(0, now - startedAt);
      const remaining = Math.max(
        0,
        deadline == null ? initialMs - elapsed : deadline - Date.now() - serverOffset,
      );
      setRemainingMs(remaining);
      if (remaining > 0) frameId = requestAnimationFrame(tick);
      else onTimeUp?.();
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [initialMs, running, onTimeUp, deadline, serverOffset]);

  const displayedMs = running ? remainingMs : initialMs;
  const seconds = Math.ceil(displayedMs / 1000);
  const secondProgress = displayedMs > 0 ? (displayedMs % 1000 || 1000) / 1000 : 0;
  const roundProgress = initialMs > 0 ? Math.min(1, displayedMs / initialMs) : 0;
  const colourPhase = displayedMs > 10000 ? "warning" : "danger";
  const transitionStart = colourPhase === "warning" ? 15000 : 10000;
  // Follow the same clock as the countdown, including after an inactive tab resumes.
  const colourProgress = Math.min(1, Math.max(0, (transitionStart - displayedMs) / 5000));

  return (
    <div
      className="panel timer-card"
      role="timer"
      aria-label={`${seconds} seconds remaining`}
      data-colour-phase={colourPhase}
      style={
        {
          "--timer-colour-progress": `${colourProgress * 100}%`,
        } as CSSProperties
      }
    >
      <p className="timer-count">{seconds}</p>
      <div className="timer-bars" aria-hidden="true">
        <div className="timer-track" title="Current second">
          <div className="timer-fill timer-second" style={{ width: `${secondProgress * 100}%` }} />
        </div>
        <div className="timer-track" title="Time remaining in the round">
          <div className="timer-fill timer-round" style={{ width: `${roundProgress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
