import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { DEFAULT_GAME_SETTINGS, NUMERIC_SETTINGS, settingsMatch } from "./lobbySettings";
import type { GameSettings } from "./lobbySettings";

type LobbySettingsProps = {
  settings: GameSettings;
  isHost: boolean;
  busy?: boolean;
  onSave?: (settings: GameSettings) => Promise<void>;
  onStartGame?: () => Promise<void>;
};

export default function LobbySettings({
  settings,
  isHost,
  busy = false,
  onSave,
  onStartGame,
}: LobbySettingsProps) {
  const savedSettings = settings;
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<GameSettings>(savedSettings);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [previousSettings, setPreviousSettings] = useState(settings);
  if (!settingsMatch(settings, previousSettings)) {
    setPreviousSettings(settings);
    setDraft(settings);
    setStatus("");
  }
  const locked = !isHost || busy || saving;
  const hasChanges = !settingsMatch(draft, savedSettings);

  function updateDraft(settings: GameSettings) {
    setDraft(settings);
    setStatus("");
    setSaveError(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setSaving(true);
    try {
      await onSave?.({ ...draft });
      setStatus("Changes saved.");
      setSaveError(false);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save changes. Please try again.",
      );
      setSaveError(true);
    } finally {
      setSaving(false);
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
                  disabled={locked}
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
              disabled={locked}
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
            {!isHost
              ? "Waiting for the room owner to start the game."
              : status || (hasChanges ? "Unsaved changes" : "")}
          </p>
          {isHost && (
            <div className="lobby-settings-actions">
              <button
                disabled={locked}
                className="control"
                type="button"
                onClick={() => updateDraft({ ...DEFAULT_GAME_SETTINGS })}
              >
                Default
              </button>
              <button
                className="control lobby-save-button"
                type="submit"
                disabled={locked || !hasChanges}
              >
                Save
              </button>
              {onStartGame && (
                <button
                  className="control lobby-save-button"
                  type="button"
                  disabled={locked || hasChanges}
                  title={hasChanges ? "Save your changes before starting" : undefined}
                  onClick={() => {
                    void onStartGame?.().catch(() => {});
                  }}
                >
                  Start game
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
