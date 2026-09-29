import type { CSSProperties } from "react";
import type { Player } from "./mockGame";
import "./MatchResults.css";

// Staggered, deterministic bursts keep the celebration gentle and repeatable.
const FIREWORKS = [
  { x: "23%", y: "27%", colour: "#1976ff", delay: "0s", size: "160px" },
  { x: "78%", y: "29%", colour: "#a078e3", delay: "0.7s", size: "144px" },
  { x: "13%", y: "55%", colour: "#edb53b", delay: "1.5s", size: "128px" },
  { x: "86%", y: "56%", colour: "#ef729d", delay: "2.2s", size: "152px" },
  { x: "30%", y: "78%", colour: "#38bca6", delay: "2.9s", size: "144px" },
  { x: "72%", y: "77%", colour: "#1976ff", delay: "3.7s", size: "128px" },
];

function ResultsFireworks() {
  return (
    <div className="results-fireworks" aria-hidden="true">
      {FIREWORKS.map((firework, index) => (
        <svg
          key={index}
          className="results-firework"
          viewBox="0 0 160 160"
          style={
            {
              left: firework.x,
              top: firework.y,
              color: firework.colour,
              "--burst-delay": firework.delay,
              "--burst-size": firework.size,
            } as CSSProperties
          }
        >
          <g className="firework-burst">
            {Array.from({ length: 12 }, (_, ray) => (
              <g key={ray} transform={`rotate(${ray * 30} 80 80)`}>
                <line className="firework-ray" x1="80" y1="80" x2="80" y2="16" />
              </g>
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}

export default function MatchResults({ leaders }: { leaders: readonly Player[] }) {
  return (
    <div className="match-results-overlay scroll-area">
      <ResultsFireworks />
      <section className="results-card" aria-labelledby="match-results-title">
        <div className="results-card-heading">
          <h2 id="match-results-title">Match Results</h2>
        </div>
        <ol className="results-standings">
          {leaders.map((player, index) => (
            <li key={player.id} className="results-player">
              <span className="results-rank" data-place={index + 1}>
                {index + 1}
              </span>
              <span className="results-player-name" title={player.name}>
                {player.name}
              </span>
              <span className="results-score" aria-label={`${player.score} points`}>
                {player.score.toLocaleString("en-GB")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
