"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FontTracerCreatorProps {
  onSave: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
}

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-:;()[]{}+/@#$%&*'\" ";

function drawGuide(ctx: CanvasRenderingContext2D, char: string, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(167,139,250,0.25)";
  ctx.lineWidth = 1;
  for (let y = 8; y < h; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(167,139,250,0.35)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  ctx.save();
  ctx.font = '600 48px "Space Mono", monospace';
  ctx.fillStyle = "rgba(167,139,250,0.2)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char === " " ? "space" : char, w / 2, h / 2);
  ctx.restore();
}

export default function FontTracerCreator({ onSave }: Readonly<FontTracerCreatorProps>) {
  const [fontName, setFontName] = useState("My Hand Font");
  const [charIndex, setCharIndex] = useState(0);
  const [glyphs, setGlyphs] = useState<Record<string, string>>({});
  const [lineWidth, setLineWidth] = useState(4);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const w = 104;
  const h = 128;

  const currentChar = useMemo(() => CHARSET[charIndex] ?? "A", [charIndex]);

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) return;
    const gctx = guide.getContext("2d");
    if (!gctx) return;
    drawGuide(gctx, currentChar, w, h);
  }, [currentChar]);

  const point = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (w / rect.width),
      y: (e.clientY - rect.top) * (h / rect.height),
    };
  }, []);

  const start = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = point(e);
  }, [point]);

  const move = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !last.current) return;
    const p = point(e);
    ctx.strokeStyle = "#2a2433";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }, [lineWidth, point]);

  const stop = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  const clearGlyph = useCallback(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
  }, []);

  const saveCurrentGlyph = useCallback(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    setGlyphs((prev) => ({ ...prev, [currentChar]: data }));
  }, [currentChar]);

  const nextGlyph = useCallback(() => {
    saveCurrentGlyph();
    clearGlyph();
    setCharIndex((idx) => Math.min(CHARSET.length - 1, idx + 1));
  }, [saveCurrentGlyph, clearGlyph]);

  const prevGlyph = useCallback(() => {
    saveCurrentGlyph();
    clearGlyph();
    setCharIndex((idx) => Math.max(0, idx - 1));
  }, [saveCurrentGlyph, clearGlyph]);

  const finishFont = useCallback(() => {
    saveCurrentGlyph();
    onSave(fontName.trim() || "My Hand Font", glyphs, w, h);
    setGlyphs({});
    setCharIndex(0);
    clearGlyph();
  }, [saveCurrentGlyph, onSave, fontName, glyphs, clearGlyph]);

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface)" }}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Font Tracer Lab
      </p>
      <input
        value={fontName}
        onChange={(e) => setFontName(e.target.value)}
        placeholder="Font name"
        className="mb-2 w-full rounded-lg border px-2 py-1 text-xs outline-none"
        style={{ borderColor: "var(--border)", background: "white" }}
      />
      <div className="mb-2 text-xs" style={{ color: "var(--muted-strong)" }}>
        Trace character: <span className="font-semibold">{currentChar === " " ? "[space]" : currentChar}</span>
        <span className="ml-2" style={{ color: "var(--muted)" }}>{charIndex + 1}/{CHARSET.length}</span>
      </div>
      <div className="relative mb-2 inline-block rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <canvas ref={guideRef} width={w} height={h} className="block rounded-lg" />
        <canvas
          ref={drawRef}
          width={w}
          height={h}
          className="absolute inset-0 block rounded-lg"
          style={{ touchAction: "none", cursor: "crosshair" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="font-tracer-width" className="text-[11px]" style={{ color: "var(--muted)" }}>
          Stroke
        </label>
        <input
          id="font-tracer-width"
          type="range"
          min={1}
          max={12}
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="flex-1"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={prevGlyph} className="btn-smooth rounded-lg px-2 py-1 text-xs" style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}>
          ← Prev
        </button>
        <button onClick={nextGlyph} className="btn-smooth rounded-lg px-2 py-1 text-xs" style={{ background: "rgba(103,212,241,0.2)", color: "var(--sky)" }}>
          Save + Next
        </button>
        <button onClick={clearGlyph} className="btn-smooth rounded-lg px-2 py-1 text-xs" style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}>
          Clear
        </button>
        <button onClick={finishFont} className="btn-smooth rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: "rgba(255,107,157,0.2)", color: "var(--pink)" }}>
          Finish Font
        </button>
      </div>
    </div>
  );
}
