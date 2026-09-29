import { useEffect, useState, useSyncExternalStore } from "react";
import "./App.css";
import Game from "./components/Game";
import Home from "./components/Home";
import { GameClient } from "./network/gameClient";

function App() {
  const [client] = useState(() => new GameClient());
  const [playerName, setPlayerName] = useState("");
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(() => () => client.dispose(), [client]);

  if (!snapshot.room)
    return (
      <Home
        initialPlayerName={playerName}
        onEnterRoom={async (entry) => {
          await client.enter(entry.playerName, entry.roomCode);
          setPlayerName(entry.playerName);
        }}
      />
    );

  return <Game client={client} snapshot={snapshot} />;
}
export default App;
