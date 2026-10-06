import type { CSSProperties } from "react";
import { BRUSH_WIDTHS } from "../../config";
import type { DrawingTool } from "../../config";
import Icon from "./Icon";

const TOOLS = [
  { tool: "brush", label: "Brush", icon: "brush" },
  { tool: "fill", label: "Fill", icon: "fill" },
] as const;

// Each column is a pair: the top row holds the deeper colour and the bottom row its partner.
const pairs = [
  [
    ["Coal", "#1a1a1a"],
    ["White", "#ffffff"],
  ],
  [
    ["Steel", "#7c7b7a"],
    ["Grey", "#afbcc8"],
  ],
  [
    ["Byzantium", "#702963"],
    ["Rose", "#f64a8a"],
  ],
  [
    ["Ron", "#800020"],
    ["Carnation", "#ffa6c9"],
  ],
  [
    ["Red", "#eb212e"],
    ["Wisteria", "#c9a0dc"],
  ],
  [
    ["Orange", "#ff4500"],
    ["Grape", "#6a5acd"],
  ],
  [
    ["Papaya", "#fd9600"],
    ["Lightning", "#6d00ff"],
  ],
  [
    ["Amber", "#ffbf00"],
    ["Royal Blue", "#4269e1"],
  ],
  [
    ["Banana", "#fff49c"],
    ["Cornflower", "#7898ec"],
  ],
  [
    ["Ectoplasm", "#98fb98"],
    ["Light Blue", "#87cefa"],
  ],
  [
    ["Emerald", "#50c878"],
    ["Celeste", "#50ebec"],
  ],
  [
    ["Forest", "#16733d"],
    ["Aquamarine", "#7fffd4"],
  ],
  [
    ["Chocolate", "#6d391d"],
    ["Soil", "#654444"],
  ],
  [
    ["Caramel", "#c78862"],
    ["Peach", "#f9dac2"],
  ],
];

// The palette grid fills row by row, so list the whole top row before the bottom row.
const colours = [...pairs.map(([top]) => top), ...pairs.map(([, bottom]) => bottom)];

function checkColour(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#1a1a1a" : "#ffffff";
}

type PaintControlsProps = {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
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
  tool,
  onToolChange,
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
      <div className="tool-modes" role="group" aria-label="Tool">
        {TOOLS.map((option) => (
          <button
            key={option.tool}
            type="button"
            disabled={disabled}
            className="tool-mode-button"
            aria-label={option.label}
            aria-pressed={tool === option.tool}
            title={option.label}
            onClick={() => onToolChange(option.tool)}
          >
            <Icon name={option.icon} />
          </button>
        ))}
      </div>
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
          {BRUSH_WIDTHS.map((width) => (
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
          title="Undo last stroke (R or Ctrl/Cmd+Z)"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className="control tool-button"
          disabled={disabled || !canClear}
          onClick={onClear}
          aria-label="Clear canvas"
          title="Clear canvas (C)"
        >
          <Icon name="clear" />
        </button>
      </div>
    </section>
  );
}
