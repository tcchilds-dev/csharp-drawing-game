import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Game from "./components/Game";
import { GAME_VIEW, MATCH_RESULTS_DURATION_SECONDS, PREVIEW_GUESSED_CORRECTLY, PREVIEW_IS_FINAL_TURN } from "./config";
import type { GameView } from "./config";

function App() {
  // One mounted game shell; live room events can drive this same phase state later.
  const [view, setView] = useState<GameView>(GAME_VIEW);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(PREVIEW_GUESSED_CORRECTLY);
  const [isFinalTurn, setIsFinalTurn] = useState(PREVIEW_IS_FINAL_TURN);

  useEffect(() => {
    if (view !== "turn-end") return;

    const timeout = window.setTimeout(() => {
      if (!isFinalTurn) setHasGuessedCorrectly(false);
      setView(isFinalTurn ? "results" : "word-choice");
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [view, isFinalTurn]);

  useEffect(() => {
    if (view !== "results") return;

    const timeout = window.setTimeout(() => {
      setHasGuessedCorrectly(false);
      setIsFinalTurn(false);
      setView("lobby");
    }, MATCH_RESULTS_DURATION_SECONDS * 1000);

    return () => window.clearTimeout(timeout);
  }, [view]);

  const endTurn = useCallback(() => {
    setView((current) => current === "artist" || current === "guesser" ? "turn-end" : current);
  }, []);

  return (
    <Game
      view={view}
      hasGuessedCorrectly={hasGuessedCorrectly}
      isFinalTurn={isFinalTurn}
      onCorrectGuess={() => setHasGuessedCorrectly(true)}
      onTurnEnd={endTurn}
      onStartGame={() => {
        setHasGuessedCorrectly(false);
        setIsFinalTurn(false);
        setView("word-choice");
      }}
    />
  );
}

export default App;
