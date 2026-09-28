import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { SUPPORTED_SCREEN_QUERY } from "../config";
import "./ScreenGuard.css";

function subscribeToScreenSupport(onChange: () => void) {
  const query = window.matchMedia(SUPPORTED_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isScreenSupported() {
  return window.matchMedia(SUPPORTED_SCREEN_QUERY).matches;
}

export default function ScreenGuard({ children }: { children: ReactNode }) {
  const supported = useSyncExternalStore(subscribeToScreenSupport, isScreenSupported);
  const content = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!supported) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && content.current?.contains(focused)) {
        previousFocus.current = focused;
      }
      notice.current?.focus({ preventScroll: true });
    } else {
      if (previousFocus.current?.isConnected) {
        previousFocus.current.focus({ preventScroll: true });
      }
      previousFocus.current = null;
    }
  }, [supported]);

  return (
    <div className="screen-guard" data-blocked={!supported}>
      {/* Keep the room mounted while preventing interaction and hiding it from assistive tools. */}
      <div ref={content} className="screen-guard-content" inert={!supported}>
        {children}
      </div>
      {!supported && (
        <section
          ref={notice}
          className="screen-guard-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="screen-guard-message"
          tabIndex={-1}
        >
          <div className="screen-guard-notice">
            <svg
              className="screen-guard-icon"
              width="48"
              height="48"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="26" height="18" rx="4" />
              <path d="M16 23v5M10 28h12" />
            </svg>
            <p id="screen-guard-message">
              This game is built for full width computer screens only.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
