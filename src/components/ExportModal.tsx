"use client";

import React, { useEffect, useRef } from "react";
import type { StaticFormat } from "./ExportUtil";

interface ExportModalProps {
  isExporting: boolean;
  hasAnimation: boolean;
  staticFormat: StaticFormat;
  onStaticFormatChange: (f: StaticFormat) => void;
  onExportWhole: () => void;
  onSelectRegion: () => void;
  onClose: () => void;
}

export default function ExportModal({
  isExporting,
  hasAnimation,
  staticFormat,
  onStaticFormatChange,
  onExportWhole,
  onSelectRegion,
  onClose,
}: ExportModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const formatLabel = hasAnimation ? "GIF" : staticFormat === "png" ? "PNG" : "JPEG";

  return (
    <div className="absolute inset-0 z-55 flex items-center justify-center">
      <div
        ref={ref}
        className="flex flex-col gap-3 rounded-3xl p-5"
        style={{
          background: "rgba(255,255,255,0.97)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: "1px solid rgba(186,156,214,0.3)",
          minWidth: 248,
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: "var(--muted-strong, #374151)" }}>
            Export canvas
          </p>
          {/* Format badge */}
          <span
            className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: hasAnimation
                ? "rgba(167,139,250,0.15)"
                : "rgba(255,107,157,0.12)",
              color: hasAnimation ? "#7c3aed" : "#be185d",
            }}
          >
            {formatLabel}
          </span>
        </div>

        {/* Format picker — only for static canvases */}
        {!hasAnimation && (
          <div className="flex gap-1.5 rounded-xl p-1" style={{ background: "rgba(0,0,0,0.05)" }}>
            {(["png", "jpeg"] as StaticFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onStaticFormatChange(fmt)}
                className="flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all"
                style={{
                  background: staticFormat === fmt ? "white" : "transparent",
                  color: staticFormat === fmt ? "var(--foreground)" : "var(--muted)",
                  boxShadow: staticFormat === fmt ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Whole canvas */}
        <button
          onClick={() => { if (!isExporting) onExportWhole(); }}
          disabled={isExporting}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
          style={{
            background: isExporting
              ? "rgba(186,156,214,0.12)"
              : "linear-gradient(135deg, rgba(255,107,157,0.08), rgba(167,139,250,0.12))",
            border: "1px solid rgba(167,139,250,0.25)",
            cursor: isExporting ? "not-allowed" : "pointer",
            opacity: isExporting ? 0.6 : 1,
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, var(--pink, #ff6b9d), var(--lavender, #a78bfa))" }}
          >
            {isExporting ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5" strokeDasharray="28 56" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 11l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 20h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {isExporting ? "Saving…" : "Whole canvas"}
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted, #9ca3af)" }}>
              {hasAnimation ? "Animated GIF, loops forever" : `Lossless ${staticFormat.toUpperCase()}`}
            </div>
          </div>
        </button>

        {/* Select region */}
        <button
          onClick={() => { if (!isExporting) onSelectRegion(); }}
          disabled={isExporting}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
          style={{
            background: "rgba(167,139,250,0.07)",
            border: "1px solid rgba(167,139,250,0.2)",
            cursor: isExporting ? "not-allowed" : "pointer",
            opacity: isExporting ? 0.5 : 1,
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(167,139,250,0.2)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 2" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 2" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 2" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 2" />
            </svg>
          </span>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              Select region
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted, #9ca3af)" }}>
              Drag to choose what to export
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
