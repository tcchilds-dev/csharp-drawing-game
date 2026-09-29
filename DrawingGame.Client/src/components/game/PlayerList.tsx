import type { Player } from "./mockGame";
import Icon from "./Icon";

export default function PlayerList({
  players,
  showScores = true,
}: {
  players: Player[];
  showScores?: boolean;
}) {
  return (
    <section aria-label="Players" className="row-span-4 flex min-h-0 flex-col overflow-hidden">
      <ol className="scroll-area min-h-0 space-y-1 overflow-y-auto p-2">
        {players.map((player) => (
          <li
            key={player.id}
            aria-current={player.isDrawing ? "true" : undefined}
            className="player-row"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: player.avatarColour }}
            >
              {player.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-semibold ${player.isYou ? "text-accent" : ""}`}
                title={player.name}
              >
                {player.name}
              </p>
              {player.isDrawing && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-accent">
                  <Icon name="pencil" size={11} /> Drawing
                </p>
              )}
            </div>
            <span
              className="shrink-0 text-sm font-semibold tabular-nums"
              aria-label={showScores ? `${player.score} points` : "No score yet"}
            >
              {showScores ? player.score.toLocaleString("en-GB") : "-"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
