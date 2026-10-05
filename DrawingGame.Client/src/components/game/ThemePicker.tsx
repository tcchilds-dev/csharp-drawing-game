import type { GameTheme } from "../../config";
import Icon from "./Icon";

const THEMES = [
  { theme: "light", label: "Light theme", icon: "sun" },
  { theme: "cozy", label: "Cozy theme", icon: "coffee" },
  { theme: "dark", label: "Dark theme", icon: "moon" },
] as const;

export default function ThemePicker({
  theme,
  onChange,
}: {
  theme: GameTheme;
  onChange: (theme: GameTheme) => void;
}) {
  return (
    <div className="theme-picker" role="group" aria-label="Theme">
      {THEMES.map((option) => (
        <button
          key={option.theme}
          type="button"
          className="theme-button"
          aria-label={option.label}
          aria-pressed={theme === option.theme}
          title={option.label}
          onClick={() => onChange(option.theme)}
        >
          <Icon name={option.icon} size={18} />
        </button>
      ))}
    </div>
  );
}
