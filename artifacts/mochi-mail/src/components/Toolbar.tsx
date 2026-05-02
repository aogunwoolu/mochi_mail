"use client";

import React from "react";
import { BrushSettings, Tool, PASTEL_COLORS, BRUSH_SIZES } from "@/types";

interface ToolbarProps {
  brushSettings: BrushSettings;
  onBrushChange: (settings: Partial<BrushSettings>) => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
  hasSelectedAsset: boolean;
  onDeselectAsset: () => void;
}

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "pen", label: "Pen", icon: "✏️" },
  { id: "eraser", label: "Eraser", icon: "🧹" },
];

export default function Toolbar({
  brushSettings,
  onBrushChange,
  onUndo,
  onClear,
  onExport,
  hasSelectedAsset,
  onDeselectAsset,
}: ToolbarProps) {
  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-4">
      {/* Tool Selection */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Tools
        </div>
        <div className="flex gap-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                onBrushChange({ tool: tool.id });
                if (hasSelectedAsset) onDeselectAsset();
              }}
              className={`btn-smooth flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                brushSettings.tool === tool.id && !hasSelectedAsset
                  ? "glass-strong glow-pink"
                  : "bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
              }`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
          <div className="mx-1 w-px" style={{ background: "var(--border)" }} />
          <button onClick={onUndo} className="btn-smooth flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-lg hover:bg-[var(--surface-hover)]" title="Undo">↩️</button>
          <button onClick={onClear} className="btn-smooth flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-lg hover:bg-[var(--surface-hover)]" title="Clear">🗑️</button>
          <button onClick={onExport} className="btn-smooth flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-lg hover:bg-[var(--surface-hover)]" title="Export">💾</button>
        </div>
      </div>

      {/* Color Palette */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Colors
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PASTEL_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onBrushChange({ color, tool: "pen" })}
              className={`btn-smooth h-7 w-7 rounded-lg border-2 transition-all ${
                brushSettings.color === color
                  ? "scale-110 border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                  : "border-transparent hover:scale-105 hover:border-white/20"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Brush Size */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Size
        </div>
        <div className="flex items-center gap-2">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onBrushChange({ size })}
              className={`btn-smooth flex items-center justify-center rounded-lg p-2 ${
                brushSettings.size === size
                  ? "glass-strong glow-lavender"
                  : "bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
              }`}
              title={`${size}px`}
            >
              <div
                className="rounded-full bg-white/70"
                style={{ width: Math.min(size, 20), height: Math.min(size, 20) }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Selected Asset Indicator */}
      {hasSelectedAsset && (
        <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(255,107,157,0.1)", border: "1px solid rgba(255,107,157,0.3)" }}>
          <span className="text-xs" style={{ color: "var(--pink)" }}>
            📌 Tap canvas to place
          </span>
          <button
            onClick={onDeselectAsset}
            className="btn-smooth rounded-lg px-3 py-1 text-xs" style={{ color: "var(--pink)", background: "rgba(255,107,157,0.15)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
