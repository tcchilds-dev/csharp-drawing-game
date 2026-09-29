import type { ReactNode } from "react";

type GameHeaderProps = {
  muted: boolean;
  revealing: boolean;
  collapsing?: boolean;
  onRevealComplete: () => void;
  previousContent?: ReactNode;
  children: ReactNode;
};

export default function GameHeader({
  muted,
  revealing,
  collapsing = false,
  onRevealComplete,
  previousContent,
  children,
}: GameHeaderProps) {
  return (
    <header className="game-header" aria-hidden={muted || undefined}>
      {(muted || revealing) && (
        <div className="game-header-layer game-header-previous" aria-hidden="true" inert>
          {previousContent ?? (
            <>
              <div className="panel round-card lobby-placeholder" />
              <div className="panel word-card lobby-placeholder col-span-2" />
              <div className="panel timer-card lobby-placeholder" />
            </>
          )}
        </div>
      )}
      {(!muted || collapsing) && (
        <div
          className="game-header-layer game-header-active"
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.animationName === "game-header-reveal" ||
                event.animationName === "game-header-collapse")
            ) {
              onRevealComplete();
            }
          }}
        >
          {children}
        </div>
      )}
    </header>
  );
}
