"use client";

import React, { useRef, useState, useCallback } from "react";
import { PASTEL_COLORS } from "@/types";

interface StickerCreatorProps {
  onSave: (name: string, imageData: string, width: number, height: number) => void;
}

const GRID_SIZE = 32;
const PIXEL_SIZE = 10;

export default function StickerCreator({ onSave }: StickerCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ff6b9d");
  const [stickerName, setStickerName] = useState("");
  const isDrawing = useRef(false);

  const drawPixel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor(((e.clientX - rect.left) * scaleX) / PIXEL_SIZE) * PIXEL_SIZE;
      const y = Math.floor(((e.clientY - rect.top) * scaleY) / PIXEL_SIZE) * PIXEL_SIZE;
      ctx.fillStyle = selectedColor;
      ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
    },
    [selectedColor]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    drawPixel(e);
  }, [drawPixel]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    drawPixel(e);
  }, [drawPixel]);

  const handlePointerUp = useCallback(() => { isDrawing.current = false; }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const name = stickerName.trim() || `Sticker ${Date.now() % 1000}`;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let hasContent = false;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (imageData.data[(y * canvas.width + x) * 4 + 3] > 0) {
          hasContent = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!hasContent) return;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width - 1, maxX + pad);
    maxY = Math.min(canvas.height - 1, maxY + pad);
    const trimW = maxX - minX + 1;
    const trimH = maxY - minY + 1;
    const trimmed = document.createElement("canvas");
    trimmed.width = trimW;
    trimmed.height = trimH;
    trimmed.getContext("2d")!.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    onSave(name, trimmed.toDataURL("image/png"), trimW, trimH);
    setStickerName("");
    handleClear();
    setIsOpen(false);
  }, [stickerName, onSave, handleClear]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn-smooth w-full rounded-xl py-3 text-sm font-semibold"
        style={{ background: "rgba(255,107,157,0.12)", color: "var(--pink)", border: "1px solid rgba(255,107,157,0.2)" }}
      >
        🎨 Create Sticker
      </button>
    );
  }

  return (
    <div className="glass animate-fade-in rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pink)" }}>
          🎨 Sticker Creator
        </span>
        <button onClick={() => setIsOpen(false)} className="btn-smooth rounded-lg px-2 py-0.5 text-xs" style={{ color: "var(--muted)", background: "var(--surface)" }}>✕</button>
      </div>

      <input
        type="text"
        value={stickerName}
        onChange={(e) => setStickerName(e.target.value)}
        placeholder="Sticker name..."
        maxLength={20}
        className="mb-3 w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />

      <div className="mb-3 flex justify-center">
        <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * PIXEL_SIZE}
            height={GRID_SIZE * PIXEL_SIZE}
            className="block"
            style={{ width: GRID_SIZE * PIXEL_SIZE * 0.6, height: GRID_SIZE * PIXEL_SIZE * 0.6, touchAction: "none", cursor: "crosshair", imageRendering: "pixelated", background: "rgba(255,255,255,0.05)" }}
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

      <div className="flex gap-2">
        <button onClick={handleClear} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>Clear</button>
        <button onClick={handleSave} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: "var(--pink)" }}>Save ✨</button>
      </div>
    </div>
  );
}
