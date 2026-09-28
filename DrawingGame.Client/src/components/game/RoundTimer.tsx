import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type RoundTimerProps = {
  initialSeconds: number;
};

export default function RoundTimer({ initialSeconds }: RoundTimerProps) {
  const initialMs = Math.max(0, initialSeconds * 1000);
  const [remainingMs, setRemainingMs] = useState(initialMs);

  useEffect(() => {
    // Local preview clock. Elapsed time prevents drift when a tab is inactive.
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      // A frame timestamp can precede an effect that starts during that frame.
      const elapsed = Math.max(0, now - startedAt);
      const remaining = Math.max(0, initialMs - elapsed);
      setRemainingMs(remaining);
      if (remaining > 0) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [initialMs]);

  const seconds = Math.ceil(remainingMs / 1000);
  const secondProgress = remainingMs > 0 ? (remainingMs % 1000 || 1000) / 1000 : 0;
  const roundProgress = initialMs > 0 ? Math.min(1, remainingMs / initialMs) : 0;
  const colourPhase = remainingMs > 10000 ? "warning" : "danger";
  const transitionStart = colourPhase === "warning" ? 15000 : 10000;
  // Follow the same clock as the countdown, including after an inactive tab resumes.
  const colourProgress = Math.min(1, Math.max(0, (transitionStart - remainingMs) / 5000));

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
