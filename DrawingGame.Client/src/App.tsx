import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Game from "./components/Game";
import Home from "./components/Home";
import type { RoomEntry } from "./components/Home";
import { INITIAL_VIEW, MATCH_RESULTS_DURATION_SECONDS, PREVIEW_GUESSED_CORRECTLY, PREVIEW_IS_FINAL_TURN } from "./config";
import type { AppView } from "./config";
import { mockGame } from "./components/game/mockGame";

function App() {
  // One mounted game shell; live room events can drive this same phase state later.
  const [view, setView] = useState<AppView>(INITIAL_VIEW);
  const [roomEntry, setRoomEntry] = useState<RoomEntry | null>(null);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(PREVIEW_GUESSED_CORRECTLY);
  const [isFinalTurn, setIsFinalTurn] = useState(PREVIEW_IS_FINAL_TURN);
  const [word, setWord] = useState(mockGame.word);

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

  if (view === "home") {
    return <Home initialPlayerName={roomEntry?.playerName} onEnterRoom={(entry) => {
      // Local room preview until CreateRoom / JoinRoom are connected to the API.
      setRoomEntry(entry);
      setHasGuessedCorrectly(false);
      setIsFinalTurn(false);
      setWord(mockGame.word);
      setView("lobby");
    }} />;
  }

  return (
    <Game
      view={view}
      playerName={roomEntry?.playerName}
      roomCode={roomEntry?.roomCode}
      onLeave={() => setView("home")}
      word={word}
      hasGuessedCorrectly={hasGuessedCorrectly}
      isFinalTurn={isFinalTurn}
      onCorrectGuess={() => setHasGuessedCorrectly(true)}
      onTurnEnd={endTurn}
      onChooseWord={(chosenWord) => {
        setWord(chosenWord);
        setHasGuessedCorrectly(false);
        setView("artist");
      }}
      onStartGame={() => {
        setHasGuessedCorrectly(false);
        setIsFinalTurn(false);
        setView("word-choice");
      }}
    />
  );
}

export default App;
