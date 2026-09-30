import { useEffect, useState, useSyncExternalStore } from "react";
import "./App.css";
import Game from "./components/Game";
import Home from "./components/Home";
import { GameClient } from "./network/gameClient";
import { preloadSounds, soundPlayer } from "./sounds";

function App() {
  const [client] = useState(() => {
    const client = new GameClient();
    client.sounds = soundPlayer;
    return client;
  });
  const [playerName, setPlayerName] = useState("");
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(() => {
    preloadSounds();
    void client.restore();
    return () => client.dispose();
  }, [client]);

  // Remember the name the room knows us by, so it's prefilled after leaving a restored game.
  const username = snapshot.room?.players.find(
    (player) => player.playerId === snapshot.playerId,
  )?.username;
  if (username && username !== playerName) setPlayerName(username);

  // Render nothing rather than flashing the home page while a refreshed tab rejoins its room.
  if (snapshot.restoring) return null;

  if (!snapshot.room)
    return (
      <Home
        initialPlayerName={playerName}
        onEnterRoom={(entry) => client.enter(entry.playerName, entry.roomCode)}
      />
    );

  return <Game client={client} snapshot={snapshot} />;
}
export default App;
