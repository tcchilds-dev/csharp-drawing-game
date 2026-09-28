import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  DEFAULT_GAME_SETTINGS,
  NUMERIC_SETTINGS,
  loadSettings,
  settingsMatch,
  settingsStorageKey,
} from "./lobbySettings";
import type { GameSettings } from "./lobbySettings";

export default function LobbySettings({ roomCode }: { roomCode: string }) {
  const [savedSettings, setSavedSettings] = useState(() => loadSettings(roomCode));
  const [draft, setDraft] = useState<GameSettings>(savedSettings);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState(false);
  const hasChanges = !settingsMatch(draft, savedSettings);

  function updateDraft(settings: GameSettings) {
    setDraft(settings);
    setStatus("");
    setSaveError(false);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      // Local preview only, until room settings are connected to the backend.
      localStorage.setItem(settingsStorageKey(roomCode), JSON.stringify(draft));
      setSavedSettings({ ...draft });
      setStatus("Changes saved.");
      setSaveError(false);
    } catch {
      setStatus("Couldn’t save changes. Please try again.");
      setSaveError(true);
    }
  }

  return (
    <div className="lobby-settings-overlay scroll-area">
      <form
        className="lobby-settings"
        aria-labelledby="lobby-settings-heading"
        onSubmit={saveSettings}
      >
        <div className="lobby-settings-heading">
          <h1 id="lobby-settings-heading">Game settings</h1>
        </div>

        <div className="lobby-setting lobby-word-selection">
          <div>
            <p id="word-selection-label" className="lobby-setting-label">
              Word selection size
            </p>
          </div>
          <fieldset className="word-selection-options" aria-labelledby="word-selection-label">
            {([3, 5] as const).map((size) => (
              <label key={size} className="word-selection-option">
                <input
                  type="radio"
                  name="word-selection-size"
                  value={size}
                  checked={draft.wordSelectionSize === size}
                  onChange={() => updateDraft({ ...draft, wordSelectionSize: size })}
                />
                <span>{size}</span>
              </label>
            ))}
          </fieldset>
        </div>

        {NUMERIC_SETTINGS.map(({ key, label, min, max, unit }) => (
          <div className="lobby-setting" key={key}>
            <div className="lobby-setting-header">
              <label htmlFor={`setting-${key}`} className="lobby-setting-label">
                {label}
              </label>
              <output htmlFor={`setting-${key}`} className="lobby-setting-value">
                {draft[key]}
              </output>
            </div>
            <input
              id={`setting-${key}`}
              type="range"
              className="lobby-setting-range"
              min={min}
              max={max}
              step={1}
              value={draft[key]}
              aria-valuetext={`${draft[key]} ${unit ? "seconds" : "rounds"}`}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  [key]: event.currentTarget.valueAsNumber,
                })
              }
              style={
                {
                  "--range-progress": `${((draft[key] - min) / (max - min)) * 100}%`,
                } as CSSProperties
              }
            />
            <div className="lobby-range-limits" aria-hidden="true">
              <span>
                {min}
                {unit}
              </span>
              <span>
                {max}
                {unit}
              </span>
            </div>
          </div>
        ))}

        <div className="lobby-settings-footer">
          <p className="lobby-settings-status" role="status" data-error={saveError}>
            {status || (hasChanges ? "Unsaved changes" : "")}
          </p>
          <div className="lobby-settings-actions">
            <button
              className="control"
              type="button"
              onClick={() => updateDraft({ ...DEFAULT_GAME_SETTINGS })}
            >
              Default
            </button>
            <button className="control lobby-save-button" type="submit" disabled={!hasChanges}>
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
