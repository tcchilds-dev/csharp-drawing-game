import "./App.css";
import Game from "./components/Game";
import { GAME_VIEW } from "./config";

function App() {
  return <Game view={GAME_VIEW} />;
}

export default App;
