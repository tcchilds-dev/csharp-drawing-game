import RoundTimer from "./RoundTimer";
import WordDisplay from "./WordDisplay";
import type { WordOutcome } from "./WordDisplay";

type RoundHeaderProps = {
  round: number;
  totalRounds: number;
  word: string;
  isGuessing?: boolean;
  outcome?: WordOutcome;
  seconds: number;
  deadline?: number | null;
  serverOffset?: number;
  timerRunning?: boolean;
  onTimeUp?: () => void;
};

export default function RoundHeader({
  round,
  totalRounds,
  word,
  isGuessing = false,
  outcome = "pending",
  seconds,
  timerRunning = true,
  onTimeUp,
  deadline,
  serverOffset,
}: RoundHeaderProps) {
  return (
    <>
      <div className="panel round-card">
        <div className="round-caption">
          <h2>Round</h2>
          <div className="round-progress" aria-hidden="true">
            {Array.from({ length: totalRounds }, (_, index) => (
              <span key={index} className={index < round ? "is-complete" : ""} />
            ))}
          </div>
        </div>
        <p className="round-count" aria-label={`Round ${round} of ${totalRounds}`}>
          {round}
          <span className="round-total">/ {totalRounds}</span>
        </p>
      </div>
      <WordDisplay word={word} isGuessing={isGuessing} outcome={outcome} />
      <RoundTimer
        deadline={deadline}
        serverOffset={serverOffset}
        initialSeconds={seconds}
        running={timerRunning}
        onTimeUp={onTimeUp}
      />
    </>
  );
}
