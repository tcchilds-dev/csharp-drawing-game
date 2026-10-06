import type { CSSProperties } from "react";

type IconName =
  | "copy"
  | "leave"
  | "undo"
  | "clear"
  | "timer"
  | "pencil"
  | "send"
  | "check"
  | "sun"
  | "coffee"
  | "moon"
  | "brush"
  | "fill"
  | "keyboard";

const paths: Record<IconName, string> = {
  copy: "M9 9h11v11H9z M15 5V3H3v12h2",
  leave: "M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13",
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  clear: "M4 7h16 M9 3h6l1 4 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
  timer: "M9 2h6 M12 2v3 M18 5l2 2 M12 9v5l3 2 M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  pencil: "m15 4 5 5 M4 15 15 4a3.5 3.5 0 0 1 5 5L9 20l-6 1z M4 15l5 5",
  send: "m4 4 17 8-17 8 3-8-3-8z M7 12h14",
  check: "m5 12 4 4L19 6",
  sun:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  coffee:
    "M4 10h13v4a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z M17 11h1a3 3 0 0 1 0 6h-1.5 M8 3.5c-.7.9-.7 1.8 0 2.7 M12.5 3.5c-.7.9-.7 1.8 0 2.7",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  brush:
    "M9 12l8.3-8.3a2.1 2.1 0 0 1 3 3L12 15 M9 12l3 3 M7.5 14C5.6 14 4 15.6 4 17.5c0 1.3-.8 2-2 2.5 1.3 1 2.7 1.5 4 1.5 2.5 0 4.5-2 4.5-4.5z",
  keyboard:
    "M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M7 10h.01 M11 10h.01 M15 10h.01 M8 14h8",
  fill: "M19 11 11 3l-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0z M5 2l5 5 M2 13h15 M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z",
};

export default function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
