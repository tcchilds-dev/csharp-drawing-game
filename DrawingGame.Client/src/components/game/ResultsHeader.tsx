function LaurelBranch({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g className="victory-laurel" transform={mirrored ? "translate(240 0) scale(-1 1)" : undefined}>
      <path className="laurel-stem" d="M 105 51 Q 73 42 82 13" />
      <path d="M 98 48 Q 82 50 79 39 Q 92 37 98 48 Z" />
      <path d="M 88 40 Q 73 40 70 28 Q 83 28 88 40 Z" />
      <path d="M 81 30 Q 67 25 70 15 Q 82 19 81 30 Z" />
      <path d="M 80 21 Q 73 9 83 5 Q 89 15 80 21 Z" />
      <path d="M 98 48 Q 95 35 105 32 Q 110 43 98 48 Z" />
      <path d="M 88 40 Q 87 27 97 24 Q 101 35 88 40 Z" />
      <path d="M 81 30 Q 82 17 92 16 Q 95 27 81 30 Z" />
    </g>
  );
}

function VictoryEmblem({ side }: { side: "left" | "right" }) {
  return (
    <div className="panel victory-emblem" data-side={side} aria-hidden="true">
      <svg className="victory-emblem-art" viewBox="0 0 240 64" preserveAspectRatio="xMidYMid slice">
        <LaurelBranch />
        <LaurelBranch mirrored />
        <g className="victory-star victory-star-main">
          <path d="M 120 15 L 124 27 L 136 32 L 124 37 L 120 49 L 116 37 L 104 32 L 116 27 Z" />
          <path className="victory-star-facet" d="M 120 15 L 120 32 L 104 32 L 116 27 Z" />
        </g>
        <path className="victory-star victory-star-small" d="M 35 15 L 37 21 L 43 23 L 37 25 L 35 31 L 33 25 L 27 23 L 33 21 Z" />
        <path className="victory-star victory-star-small" d="M 205 34 L 207 40 L 213 42 L 207 44 L 205 50 L 203 44 L 197 42 L 203 40 Z" />
        <g className="victory-flecks">
          <path transform="translate(49 44)" d="M 0 -5 L 1.25 -1.25 L 5 0 L 1.25 1.25 L 0 5 L -1.25 1.25 L -5 0 L -1.25 -1.25 Z" />
          <path transform="translate(185 19)" d="M 0 -5 L 1.25 -1.25 L 5 0 L 1.25 1.25 L 0 5 L -1.25 1.25 L -5 0 L -1.25 -1.25 Z" />
          <path transform="translate(19 42)" d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" />
          <path transform="translate(223 21)" d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" />
        </g>
      </svg>
    </div>
  );
}

export default function ResultsHeader({ winnerName }: { winnerName: string }) {
  return (
    <>
      <VictoryEmblem side="left" />
      <div className="panel word-card winner-card col-span-2">
        <span className="winner-crown" aria-hidden="true">👑</span>
        <h1 className="current-word" title={winnerName} aria-label={`${winnerName} wins`}>
          {winnerName}
        </h1>
        <span className="winner-crown" aria-hidden="true">👑</span>
      </div>
      <VictoryEmblem side="right" />
    </>
  );
}
