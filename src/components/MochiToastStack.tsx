
"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToast, type ToastIcon, type ToastItem } from "@/lib/toast";

// ── SVG icon map ──────────────────────────────────────────────────────────────

function ToastIconSvg({ icon, variant }: { icon?: ToastIcon; variant: string }) {
  const stroke = "white";
  const w = 17;

  const paths: Record<ToastIcon, React.ReactNode> = {
    check: (
      <>
        <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.8" />
        <path d="M8.5 12l2.5 2.5 4.5-4.5" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    save: (
      <>
        <path d="M12 4v9M8.5 9.5l3.5 3.5 3.5-3.5" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V17" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2z" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" fill="rgba(255,255,255,0.25)" />
        <path d="M5.5 5l.6 1.7L8 7.3l-1.9.6L5.5 9.7 4.9 8l-2-.7 2-.6L5.5 5z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
      </>
    ),
    warning: (
      <>
        <path d="M10.3 3.9L2 19h20L13.7 3.9a2 2 0 00-3.4 0z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v5M12 17.5h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    store: (
      <>
        <path d="M6 2L3 7v13a1 1 0 001 1h16a1 1 0 001-1V7l-3-5z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M3 7h18M16 11a4 4 0 01-8 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    star: (
      <>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.2)" />
      </>
    ),
    wave: (
      <>
        <path d="M7.5 10V8a2 2 0 014 0v5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11.5 8.5V7.5a2 2 0 014 0v5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15.5 8.5v-1a2 2 0 014 0v7a7 7 0 01-14 0V10" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" stroke={stroke} strokeWidth="1.8" />
        <path d="M2 8l10 6.5L22 8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2.5" stroke={stroke} strokeWidth="1.8" />
        <circle cx="8.5" cy="8.5" r="1.5" stroke={stroke} strokeWidth="1.8" />
        <path d="M21 15l-6-6L5 21" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    undo: (
      <>
        <path d="M3 8h10a6 6 0 010 12H9" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 8l4-4M3 8l4 4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    redo: (
      <>
        <path d="M21 8H11a6 6 0 000 12h4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 8l-4-4M21 8l-4 4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    clear: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    pen: (
      <>
        <path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    eraser: (
      <>
        <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 17l4-4" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" />
      </>
    ),
    type: (
      <>
        <path d="M4 7V4h16v3M9 20h6M12 4v16" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    cursor: (
      <>
        <path d="M6 3v15.5l3.5-3.1 2 3.9 1.8-.9-2-3.9H17L6 3z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    sticker: (
      <>
        <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.8" />
        <path d="M8.5 13.5s1 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    ribbon: (
      <>
        <path d="M12 2l2 4.5 5 .7-3.5 3.5.8 5L12 13.25 7.7 15.7l.8-5L5 7.2l5-.7L12 2z" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" fill="rgba(255,255,255,0.2)" />
      </>
    ),
  };

  const defaultIcon: Record<string, ToastIcon> = {
    success: "check",
    error: "warning",
    info: "sparkle",
  };

  const iconKey = icon ?? defaultIcon[variant] ?? "check";

  return (
    <svg
      width={w}
      height={w}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {paths[iconKey as ToastIcon]}
    </svg>
  );
}

// ── Animated toast item ───────────────────────────────────────────────────────

function ToastEntry({ t, onRemove }: { t: ToastItem; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(t.id), 280);
    }, 2200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bgGradient =
    t.variant === "error"
      ? "linear-gradient(135deg, #e74c7e, #ff6b6b)"
      : t.variant === "info"
        ? "linear-gradient(135deg, #67d4f1, #a78bfa)"
        : "linear-gradient(135deg, #ff6b9d, #a78bfa)";

  const shadow =
    t.variant === "error"
      ? "0 8px 28px rgba(231,76,126,0.45), 0 2px 8px rgba(0,0,0,0.12)"
      : "0 8px 28px rgba(167,139,250,0.42), 0 2px 8px rgba(0,0,0,0.12)";

  return (
    <div
      role="status"
      onClick={() => { setExiting(true); setTimeout(() => onRemove(t.id), 280); }}
      className={exiting ? "animate-toast-out" : "animate-toast-in"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 999,
        padding: "9px 18px 9px 13px",
        fontSize: 13,
        fontWeight: 600,
        color: "white",
        background: bgGradient,
        boxShadow: shadow,
        whiteSpace: "nowrap",
        maxWidth: "calc(100vw - 2.5rem)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <ToastIconSvg icon={t.icon} variant={t.variant} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.message}</span>
    </div>
  );
}

// ── Stack ─────────────────────────────────────────────────────────────────────

export default function MochiToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToast(setToasts), []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed z-300 flex flex-col-reverse items-center gap-2"
      style={{ bottom: "5.5rem", left: "50%", transform: "translateX(-50%)" }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastEntry t={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
