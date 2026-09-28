import type { CSSProperties } from "react";

type IconName = "copy" | "leave" | "undo" | "clear" | "timer" | "pencil" | "send" | "check";

const paths: Record<IconName, string> = {
  copy: "M9 9h11v11H9z M15 5V3H3v12h2",
  leave: "M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13",
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  clear: "M4 7h16 M9 3h6l1 4 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
  timer: "M9 2h6 M12 2v3 M18 5l2 2 M12 9v5l3 2 M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  pencil: "m15 4 5 5 M4 15 15 4a3.5 3.5 0 0 1 5 5L9 20l-6 1z M4 15l5 5",
  send: "m4 4 17 8-17 8 3-8-3-8z M7 12h14",
  check: "m5 12 4 4L19 6",
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
