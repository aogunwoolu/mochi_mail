"use client";

import React, { useRef, useState, useCallback } from "react";
import { PASTEL_COLORS } from "@/types";

interface WashiTapeCreatorProps {
  onSave: (name: string, imageData: string, opacity: number, width: number, height: number) => void;
}

const TAPE_WIDTH = 240;
const TAPE_HEIGHT = 48;
const BRUSH_SIZE = 6;

export default function WashiTapeCreator({ onSave }: WashiTapeCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#6ee7b7");
  const [tapeName, setTapeName] = useState("");
  const [opacity, setOpacity] = useState(70);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const drawStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
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

    const previous = lastPoint.current;
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
    lastPoint.current = { x, y };
  }, [selectedColor]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    drawStroke(e);
  }, [drawStroke]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    drawStroke(e);
  }, [drawStroke]);

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    lastPoint.current = null;
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
    const name = tapeName.trim() || `Tape ${Date.now() % 1000}`;
    onSave(name, canvas.toDataURL("image/png"), opacity / 100, TAPE_WIDTH, TAPE_HEIGHT);
    setTapeName("");
    handleClear();
    setIsOpen(false);
  }, [tapeName, opacity, onSave, handleClear]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn-smooth w-full rounded-xl py-3 text-sm font-semibold"
        style={{ background: "rgba(110,231,183,0.12)", color: "var(--mint)", border: "1px solid rgba(110,231,183,0.2)" }}
      >
        🎀 Create Washi Tape
      </button>
    );
  }

  return (
    <div className="glass animate-fade-in rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--mint)" }}>
          🎀 Washi Tape Creator
        </span>
        <button onClick={() => setIsOpen(false)} className="btn-smooth rounded-lg px-2 py-0.5 text-xs" style={{ color: "var(--muted)", background: "var(--surface)" }}>✕</button>
      </div>

      <input
        type="text"
        value={tapeName}
        onChange={(e) => setTapeName(e.target.value)}
        placeholder="Tape name..."
        maxLength={20}
        className="mb-3 w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />

      <div className="mb-3 flex justify-center">
        <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <canvas
            ref={canvasRef}
            width={TAPE_WIDTH}
            height={TAPE_HEIGHT}
            className="block"
            style={{ width: TAPE_WIDTH, height: TAPE_HEIGHT, touchAction: "none", cursor: "crosshair", background: "rgba(255,255,255,0.05)" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-1">
        {PASTEL_COLORS.slice(0, 12).map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`h-5 w-5 rounded-md border-2 transition-all ${selectedColor === color ? "scale-110 border-white/40" : "border-transparent"}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="mb-3">
        <label className="mb-1 flex items-center justify-between text-[10px]" style={{ color: "var(--muted)" }}>
          <span>Transparency</span>
          <span className="font-semibold">{opacity}%</span>
        </label>
        <input type="range" min={20} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" />
        <div className="mt-0.5 flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
          <span>See-through</span>
          <span>Opaque</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleClear} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>Clear</button>
        <button onClick={handleFill} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>Fill</button>
        <button onClick={handleSave} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: "var(--mint)" }}>Save ✨</button>
      </div>
    </div>
  );
}
