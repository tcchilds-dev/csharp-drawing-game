import type { CSSProperties } from "react";
import Icon from "./Icon";

const colours = [
  ["Ink", "#253249"],
  ["Slate", "#64748b"],
  ["Brown", "#8b533b"],
  ["Crimson", "#b92f4f"],
  ["Red", "#ef4444"],
  ["Orange", "#f97316"],
  ["Amber", "#f5a623"],
  ["Yellow", "#facc15"],
  ["Lime", "#92c83e"],
  ["Green", "#22a65a"],
  ["Teal", "#149b8d"],
  ["Cyan", "#21b8d5"],
  ["Blue", "#3b82f6"],
  ["Indigo", "#6257d5"],
  ["Purple", "#a855d5"],
  ["Pink", "#e54b9a"],
  ["White", "#ffffff"],
  ["Light grey", "#dce1e8"],
  ["Sand", "#dcc4a4"],
  ["Rose", "#e9a2b0"],
  ["Light red", "#fca5a5"],
  ["Peach", "#fdba74"],
  ["Light amber", "#fbd792"],
  ["Light yellow", "#fef08a"],
  ["Light lime", "#d4e8a7"],
  ["Light green", "#96dfad"],
  ["Mint", "#99e4d5"],
  ["Light cyan", "#a1e3ef"],
  ["Light blue", "#93c5fd"],
  ["Periwinkle", "#b8b6f2"],
  ["Lavender", "#d9b6ed"],
  ["Light pink", "#f5b1d3"],
];

const brushWidths = [4, 8, 14, 22];

function checkColour(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

type PaintControlsProps = {
  colour: string;
  onColourChange: (colour: string) => void;
  brushWidth: number;
  onBrushWidthChange: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canClear: boolean;
  disabled?: boolean;
};

export default function PaintControls({
  colour,
  onColourChange,
  brushWidth,
  onBrushWidthChange,
  onUndo,
  onClear,
  canUndo,
  canClear,
  disabled = false,
}: PaintControlsProps) {
  return (
    <section aria-label="Drawing tools" className="panel paint-toolbar" data-disabled={disabled}>
      <fieldset className="h-full min-h-0 min-w-0">
        <legend className="sr-only">Colours</legend>
        <div className="palette">
          {colours.map(([name, value], index) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-label={name}
              aria-pressed={colour === value}
              title={name}
              onClick={() => onColourChange(value)}
              className="swatch"
              style={
                {
                  backgroundColor: value,
                  "--swatch-index": index,
                } as CSSProperties
              }
            >
              {colour === value && (
                <Icon name="check" size={12} style={{ color: checkColour(value) }} />
              )}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="sr-only">Brush width</legend>
        <div className="brush-selector">
          {brushWidths.map((width) => (
            <button
              key={width}
              type="button"
              disabled={disabled}
              aria-label={`Size ${width} brush`}
              aria-pressed={brushWidth === width}
              title={`Size ${width}`}
              onClick={() => onBrushWidthChange(width)}
              className="brush-button"
            >
              <span
                aria-hidden="true"
                className="shrink-0 rounded-full bg-current"
                style={{ width, height: width }}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="paint-actions flex items-center gap-1.5">
        <button
          type="button"
          className="control tool-button"
          disabled={disabled || !canUndo}
          onClick={onUndo}
          aria-label="Undo"
          title="Undo last stroke (Ctrl/Cmd+Z)"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className="control tool-button"
          disabled={disabled || !canClear}
          onClick={onClear}
          aria-label="Clear canvas"
          title="Clear canvas"
        >
          <Icon name="clear" />
        </button>
      </div>
    </section>
  );
}
