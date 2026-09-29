import { useState } from "react";
import type { GameView } from "../../config";

type GameTransition = "lobby-to-word-choice" | "turn-end-to-results" | "results-to-lobby" | null;
type TransitionTrack = "header" | "canvas";

type TransitionState = {
  view: GameView;
  transition: GameTransition;
  completedTracks: TransitionTrack[];
};

export default function useGameTransition(view: GameView) {
  const [state, setState] = useState<TransitionState>({
    view,
    transition: null,
    completedTracks: [],
  });

  if (state.view !== view) {
    // Derive the transition before painting the new phase, avoiding an active-state flash.
    // Other phase pairs can be added here as their animations are designed.
    setState({
      view,
      completedTracks: [],
      transition:
        state.view === "lobby" && view === "word-choice"
          ? "lobby-to-word-choice"
          : state.view === "turn-end" && view === "results"
            ? "turn-end-to-results"
            : state.view === "results" && view === "lobby"
              ? "results-to-lobby"
              : null,
    });
  }

  function finishTransition(track: TransitionTrack = "header") {
    setState((current) => {
      if (current.view !== view || !current.transition || current.completedTracks.includes(track)) {
        return current;
      }

      const completedTracks = [...current.completedTracks, track];
      // A returning lobby stays in transition until both the header and canvas have finished.
      const complete =
        completedTracks.includes("header") &&
        (current.transition !== "results-to-lobby" || completedTracks.includes("canvas"));

      return {
        ...current,
        completedTracks,
        transition: complete ? null : current.transition,
      };
    });
  }

  return { transition: state.transition, finishTransition };
}
