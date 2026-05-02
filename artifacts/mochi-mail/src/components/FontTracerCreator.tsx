import React, { useCallback, useEffect, useRef, useState } from "react";

interface FontTracerCreatorProps {
  onSave: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
}

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-:;()[]{}+/@#$%&*'\" ";

const CHAR_GROUPS = [
  { label: "A–Z", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { label: "a–z", chars: "abcdefghijklmnopqrstuvwxyz" },
  { label: "0–9",  chars: "0123456789" },
  { label: "Symbols", chars: ".,!?-:;()[]{}+/@#$%&*'\" " },
] as const;

const GW = 104;
const GH = 128;

function drawGuide(ctx: CanvasRenderingContext2D, char: string) {
  ctx.clearRect(0, 0, GW, GH);
  ctx.fillStyle = "#fdfcff";
  ctx.fillRect(0, 0, GW, GH);

  const cap  = GH * 0.13;
  const xh   = GH * 0.40;
  const base = GH * 0.74;
  const desc = GH * 0.89;

  ctx.fillStyle = "rgba(209,196,233,0.13)";
  ctx.fillRect(2, cap, GW - 4, base - cap);

  const lines: [number, string, number, number[]][] = [
    [cap,  "rgba(167,139,250,0.30)", 0.5, [3,4]],
    [xh,   "rgba(167,139,250,0.22)", 0.5, [3,4]],
    [base, "rgba(167,139,250,0.60)", 0.75, []],
    [desc, "rgba(167,139,250,0.18)", 0.5, [3,4]],
  ];
  for (const [y, color, lw, dash] of lines) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(GW - 4, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(167,139,250,0.18)";
  ctx.lineWidth = 0.75;
  ctx.strokeRect(0.5, 0.5, GW - 1, GH - 1);

  ctx.save();
  ctx.font = `700 52px "Space Mono", monospace`;
  ctx.fillStyle = "rgba(167,139,250,0.12)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(char === " " ? "·" : char, GW / 2, base);
  ctx.restore();
}

export default function FontTracerCreator({ onSave }: Readonly<FontTracerCreatorProps>) {
  const [fontName, setFontName] = useState("My Hand Font");
  const [charIndex, setCharIndex] = useState(0);
  const [glyphs, setGlyphs] = useState<Record<string, string>>({});
  const [lineWidth, setLineWidth] = useState(4);
  const [previewText, setPreviewText] = useState("Hello!");
  const [activeGroup, setActiveGroup] = useState(0);

  const drawRef  = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const drawing  = useRef(false);
  const last     = useRef<{ x: number; y: number } | null>(null);

  const currentChar = CHARSET[charIndex] ?? "A";
  const totalChars  = CHARSET.length;
  const doneCount   = Object.keys(glyphs).length;
  const progressPct = Math.round((doneCount / totalChars) * 100);

  useEffect(() => {
    const g = guideRef.current;
    if (!g) return;
    const ctx = g.getContext("2d");
    if (!ctx) return;
    drawGuide(ctx, currentChar);
  }, [currentChar]);

  useEffect(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GW, GH);
    const saved = glyphs[currentChar];
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, GW, GH);
      img.src = saved;
    }
  // intentionally only on charIndex change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex]);

  const captureCurrentGlyph = useCallback((): string => {
    const canvas = drawRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  }, []);

  const saveAndGo = useCallback((nextIdx: number) => {
    const data = captureCurrentGlyph();
    if (data) setGlyphs(prev => ({ ...prev, [currentChar]: data }));
    setCharIndex(Math.max(0, Math.min(CHARSET.length - 1, nextIdx)));
  }, [captureCurrentGlyph, currentChar]);

  const clearGlyph = useCallback(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GW, GH);
    setGlyphs(prev => {
      const next = { ...prev };
      delete next[currentChar];
      return next;
    });
  }, [currentChar]);

  const finishFont = useCallback(() => {
    const data = captureCurrentGlyph();
    const finalGlyphs = data ? { ...glyphs, [currentChar]: data } : { ...glyphs };
    onSave(fontName.trim() || "My Hand Font", finalGlyphs, GW, GH);
    setGlyphs({});
    setCharIndex(0);
    const canvas = drawRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, GW, GH);
  }, [captureCurrentGlyph, onSave, fontName, glyphs, currentChar]);

  const point = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (GW / rect.width),
      y: (e.clientY - rect.top)  * (GH / rect.height),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }, [point]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.strokeStyle = "#1e1b2e";
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }, [lineWidth, point]);

  const onPointerUp = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "Enter") saveAndGo(charIndex + 1);
      if (e.key === "ArrowLeft")  saveAndGo(charIndex - 1);
      if (e.key === "Backspace")  { e.preventDefault(); clearGlyph(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAndGo, charIndex, clearGlyph]);

  const groupCharIndex = CHAR_GROUPS[activeGroup]?.chars.split("").findIndex(c => c === currentChar);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header: name + progress ── */}
      <div className="flex items-center gap-3">
        <input
          value={fontName}
          onChange={(e) => setFontName(e.target.value)}
          placeholder="Font name…"
          className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
          style={{ borderColor: "var(--border)", background: "white", color: "var(--foreground)" }}
        />
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums" style={{ color: "var(--purple)" }}>{doneCount}<span className="text-xs font-normal opacity-60">/{totalChars}</span></div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>glyphs</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="overflow-hidden rounded-full" style={{ height: 5, background: "var(--surface-soft)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #a78bfa, #ff6b9d)" }}
        />
      </div>

      {/* ── Character map ── */}
      <div className="rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex gap-1 border-b px-3 pt-2" style={{ borderColor: "var(--border)" }}>
          {CHAR_GROUPS.map((g, i) => {
            const groupDone = g.chars.split("").filter(c => glyphs[c]).length;
            return (
              <button
                key={g.label}
                onClick={() => setActiveGroup(i)}
                className="relative rounded-t-lg px-2.5 pb-2 pt-1.5 text-[10px] font-semibold transition-all"
                style={{
                  color: activeGroup === i ? "var(--purple)" : "var(--muted)",
                  borderBottom: activeGroup === i ? "2px solid var(--purple)" : "2px solid transparent",
                }}
              >
                {g.label}
                <span className="ml-1 rounded-full px-1 py-0.5 text-[8px]" style={{ background: groupDone > 0 ? "rgba(167,139,250,0.15)" : "transparent", color: "var(--purple)" }}>
                  {groupDone > 0 ? groupDone : ""}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1 p-2.5">
          {(CHAR_GROUPS[activeGroup]?.chars ?? "").split("").map((ch) => {
            const idx    = CHARSET.indexOf(ch);
            const isDone = !!glyphs[ch];
            const isCur  = ch === currentChar;
            return (
              <button
                key={ch}
                onClick={() => idx >= 0 && saveAndGo(idx)}
                title={ch === " " ? "space" : ch}
                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold transition-all"
                style={{
                  background: isCur
                    ? "var(--purple)"
                    : isDone
                    ? "rgba(167,139,250,0.12)"
                    : "rgba(0,0,0,0.03)",
                  color: isCur ? "white" : isDone ? "var(--purple)" : "var(--muted)",
                  boxShadow: isCur ? "0 0 0 2px rgba(167,139,250,0.3)" : "none",
                }}
              >
                {ch === " " ? "·" : ch}
                {isDone && !isCur && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--purple)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Drawing area + controls ── */}
      <div className="flex gap-4">

        {/* Canvas column */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-baseline justify-between">
            <span className="text-2xl font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: '"Space Mono", monospace' }}>
              {currentChar === " " ? <span className="text-base italic" style={{ color: "var(--muted)" }}>space</span> : currentChar}
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
              {charIndex + 1} / {totalChars}
            </span>
          </div>

          {/* Stacked guide + draw canvases, scaled up */}
          <div
            className="relative shrink-0 overflow-hidden rounded-2xl shadow-sm"
            style={{ width: 218, height: 269, border: "1.5px solid rgba(167,139,250,0.22)" }}
          >
            <canvas
              ref={guideRef}
              width={GW}
              height={GH}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
            <canvas
              ref={drawRef}
              width={GW}
              height={GH}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          {/* Guide legend */}
          <div className="flex gap-3 text-[9px]" style={{ color: "var(--muted)" }}>
            <span>cap</span>
            <span>x-ht</span>
            <span className="font-semibold" style={{ color: "var(--purple)" }}>base</span>
            <span>desc</span>
          </div>
        </div>

        {/* Controls column */}
        <div className="flex flex-1 flex-col gap-3 pt-8">

          {/* Stroke width */}
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "white" }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Stroke width</p>
              <div
                className="rounded-full"
                style={{
                  width: Math.max(4, lineWidth * 1.8),
                  height: Math.max(4, lineWidth * 1.8),
                  background: "#1e1b2e",
                  transition: "all 0.15s",
                }}
              />
            </div>
            <input
              type="range" min={1} max={14} value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[9px]" style={{ color: "var(--muted)" }}>
              <span>Fine</span><span>Bold</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => saveAndGo(charIndex - 1)}
              disabled={charIndex === 0}
              className="btn-smooth col-span-1 rounded-xl py-2 text-xs font-semibold"
              style={{ background: "var(--surface-soft)", color: "var(--muted-strong)", opacity: charIndex === 0 ? 0.35 : 1 }}
            >
              ← Prev
            </button>
            <button
              onClick={() => saveAndGo(charIndex + 1)}
              disabled={charIndex === totalChars - 1}
              className="btn-smooth col-span-1 rounded-xl py-2 text-xs font-semibold"
              style={{ background: "rgba(167,139,250,0.18)", color: "var(--purple)", opacity: charIndex === totalChars - 1 ? 0.35 : 1 }}
            >
              Next →
            </button>
            <button
              onClick={clearGlyph}
              className="btn-smooth col-span-2 rounded-xl py-1.5 text-[11px]"
              style={{ background: "rgba(251,146,60,0.1)", color: "var(--coral)" }}
            >
              Clear this character
            </button>
          </div>

          {/* Keyboard hint */}
          <p className="text-[9px] leading-relaxed" style={{ color: "var(--muted)" }}>
            ← → keys to navigate · Backspace to clear
          </p>

          {/* Finish */}
          <button
            onClick={finishFont}
            className="btn-smooth mt-auto w-full rounded-xl py-3 text-sm font-bold shadow-sm"
            style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #ff6b9d 100%)",
              color: "white",
            }}
          >
            ✦ Save Font
          </button>
          {doneCount > 0 && (
            <p className="text-center text-[9px]" style={{ color: "var(--muted)" }}>
              {doneCount} character{doneCount !== 1 ? "s" : ""} ready
            </p>
          )}
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Live Preview</p>
        <input
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Type to preview your font…"
          className="mb-3 w-full rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: "var(--border)", background: "white", color: "var(--foreground)" }}
        />
        <div
          className="flex items-end overflow-x-auto rounded-xl px-2 py-2"
          style={{ minHeight: 44, background: "#fdfcff", border: "1px solid rgba(0,0,0,0.05)" }}
        >
          {previewText === ""
            ? <span className="text-xs italic" style={{ color: "var(--muted)" }}>your characters will appear here</span>
            : previewText.split("").map((ch, i) => {
                const url = glyphs[ch];
                return (
                  <div key={i} className="shrink-0" style={{ width: 22, height: 28 }}>
                    {url
                      ? <img src={url} alt={ch} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <span style={{ fontSize: 13, color: "rgba(0,0,0,0.18)", lineHeight: "28px", display: "block", textAlign: "center", fontFamily: '"Space Mono", monospace' }}>
                          {ch === " " ? "\u00a0" : ch}
                        </span>
                    }
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
