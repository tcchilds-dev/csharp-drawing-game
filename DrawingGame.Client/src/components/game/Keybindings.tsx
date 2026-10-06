import Icon from "./Icon";

// Keep in sync with the artist shortcuts in Game.tsx.
const SHORTCUTS = [
  { keys: ["B"], action: "Brush" },
  { keys: ["F"], action: "Fill" },
  { keys: ["Ctrl"], action: "Hold to fill" },
  { keys: ["Shift"], action: "Hold to paint white" },
  { keys: ["R", "Ctrl+Z"], action: "Undo" },
  { keys: ["C"], action: "Clear canvas" },
  { keys: ["Ctrl+Scroll"], action: "Brush size" },
];

export default function Keybindings() {
  return (
    <div className="keybindings">
      <button
        type="button"
        className="keybindings-button"
        aria-label="Keyboard shortcuts"
        aria-describedby="keybindings-card"
      >
        <Icon name="keyboard" size={14} />
      </button>
      <div id="keybindings-card" role="tooltip" className="keybindings-card">
        <p className="keybindings-title">Drawing shortcuts</p>
        <dl className="keybindings-list">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action}>
              <dt>
                {keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
