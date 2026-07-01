"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

const DISMISS_KEY = "mochimail_wip_banner_dismissed";

interface WipBannerProps {
  /** Opens the panel that hosts the feedback form. */
  onOpenFeedback: () => void;
}

export function WipBanner({ onOpenFeedback }: WipBannerProps) {
  // Start hidden and reveal after mount so SSR and client markup match.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div className="z-[60] flex shrink-0 justify-center px-3 pt-2 animate-fade-in">
      <div
        className="flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-[12px] font-semibold"
        style={{
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(186,156,214,0.35)",
          boxShadow: "0 4px 16px rgba(143,109,178,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "var(--muted-strong)",
        }}
        role="status"
      >
        <span aria-hidden>🍡</span>
        <span className="truncate">MochiMail is still baking — a work in progress!</span>
        <button
          onClick={onOpenFeedback}
          className="btn-smooth shrink-0 rounded-full px-3 py-1 text-[12px] font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--pink), var(--lavender))",
            boxShadow: "0 2px 8px var(--pink-glow)",
          }}
        >
          Found an issue? 💌
        </button>
        <button
          onClick={dismiss}
          className="btn-smooth flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <FiX size={13} />
        </button>
      </div>
    </div>
  );
}
