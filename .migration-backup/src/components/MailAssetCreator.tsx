"use client";

import React, { useCallback, useRef, useState } from "react";
import { PASTEL_COLORS } from "@/types";

interface MailAssetCreatorProps {
  buttonLabel: string;
  title: string;
  accent: string;
  width: number;
  height: number;
  placeholder: string;
  helperText?: string;
  onSave: (name: string, imageData: string, width: number, height: number) => void;
}

const BRUSH_SIZE = 10;

export default function MailAssetCreator({
  buttonLabel,
  title,
  accent,
  width,
  height,
  placeholder,
  helperText,
  onSave,
}: Readonly<MailAssetCreatorProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#ff6b9d");

  const drawStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = selectedColor;
      ctx.lineWidth = BRUSH_SIZE;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const previous = lastPointRef.current;
      if (!previous) {
        ctx.beginPath();
        ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      lastPointRef.current = { x, y };
    },
    [selectedColor]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      drawingRef.current = true;
      drawStroke(e);
    },
    [drawStroke]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      drawStroke(e);
    },
    [drawStroke]
  );

  const handlePointerUp = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    lastPointRef.current = null;
  }, []);

  const handleFill = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = selectedColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [selectedColor]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trimmedName = name.trim() || `${title} ${Date.now() % 1000}`;
    onSave(trimmedName, canvas.toDataURL("image/png"), width, height);
    setName("");
    handleClear();
    setIsOpen(false);
  }, [handleClear, height, name, onSave, title, width]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn-smooth w-full rounded-2xl px-4 py-3 text-sm font-semibold"
        style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30` }}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="glass animate-fade-in rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            {title}
          </p>
          {helperText ? (
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
              {helperText}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="btn-smooth rounded-lg px-2 py-1 text-xs"
          style={{ background: "var(--surface)", color: "var(--muted)" }}
        >
          ✕
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        maxLength={28}
        className="mb-3 w-full rounded-xl px-3 py-2 text-xs outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />

      <div className="mb-3 flex justify-center">
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="block"
            style={{
              width: Math.min(width, 260),
              height: Math.min(height, 180),
              maxWidth: "100%",
              touchAction: "none",
              cursor: "crosshair",
              background: "rgba(255,255,255,0.06)",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        {PASTEL_COLORS.slice(0, 12).map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`h-6 w-6 rounded-lg border-2 transition-all ${selectedColor === color ? "scale-110 border-white/50" : "border-transparent"}`}
            style={{ backgroundColor: color }}
            aria-label={`Select ${color}`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleClear}
          className="btn-smooth flex-1 rounded-xl py-2 text-xs font-semibold"
          style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
        >
          Clear
        </button>
        <button
          onClick={handleFill}
          className="btn-smooth flex-1 rounded-xl py-2 text-xs font-semibold"
          style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
        >
          Fill
        </button>
        <button
          onClick={handleSave}
          className="btn-smooth flex-1 rounded-xl py-2 text-xs font-semibold text-white"
          style={{ background: accent }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
