import type { CSSProperties } from "react";
import Icon from "./Icon";

// Each column is a pair: the top row holds the deeper colour and the bottom row its partner.
const pairs = [
  [
    ["Black", "#1a1a1a"],
    ["White", "#ffffff"],
  ],
  [
    ["Graphite", "#62666d"],
    ["Silver", "#c3c6cc"],
  ],
  [
    ["Crimson", "#c8163a"],
    ["Scarlet", "#ff4d3a"],
  ],
  [
    ["Tangerine", "#f26a10"],
    ["Apricot", "#ffb46e"],
  ],
  [
    ["Marigold", "#ffac00"],
    ["Lemon", "#ffe83a"],
  ],
  [
    ["Light Green", "#21c254"],
    ["Lime", "#9ae23c"],
  ],
  [
    ["Forest", "#16733d"],
    ["Aquamarine", "#35dcc4"],
  ],
  [
    ["Cerulean", "#0a8bd4"],
    ["Sky blue", "#7dd3fb"],
  ],
  [
    ["Royal blue", "#2447d6"],
    ["Cornflower", "#7a9bff"],
  ],
  [
    ["Violet", "#6a2ed6"],
    ["Lilac", "#a67ff3"],
  ],
  [
    ["Purple", "#981db0"],
    ["Orchid", "#d965ec"],
  ],
  [
    ["Magenta", "#e01f7c"],
    ["Bubblegum", "#ff8dc7"],
  ],
  [
    ["Chocolate", "#6d391d"],
    ["Caramel", "#c27634"],
  ],
  [
    ["Tan", "#c98e5e"],
    ["Pale", "#f9dac2"],
  ],
];

// The palette grid fills row by row, so list the whole top row before the bottom row.
const colours = [...pairs.map(([top]) => top), ...pairs.map(([, bottom]) => bottom)];

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
        <div className="palette" style={{ "--palette-columns": pairs.length } as CSSProperties}>
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
