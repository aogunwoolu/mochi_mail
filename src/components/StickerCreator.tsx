
import React, { useRef, useState, useCallback, useEffect } from "react";
import { PASTEL_COLORS } from "@/types";

interface StickerCreatorProps {
  onSave: (name: string, imageData: string, width: number, height: number, isAnimated?: boolean) => void;
}

const CANVAS_SIZE = 320;
const BRUSH_SIZE = 12;
const MAX_FRAMES = 8;
const FPS_OPTIONS = [3, 6, 12] as const;

type CreatorMode = "draw" | "upload" | "animate";

// ── GIF encoding ─────────────────────────────────────────────────────────────

async function encodeGif(frameSrcs: string[], size: number, fps: number): Promise<string> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const delay = Math.round(100 / fps); // centiseconds

  // Sentinel color for transparent pixels — a cyan that won't appear in pastel drawings
  const TR = 0, TG = 255, TB = 254;

  for (const src of frameSrcs) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    await new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0); res(); };
      img.src = src;
    });

    const { data: rgba } = ctx.getImageData(0, 0, size, size);
    const n = size * size;
    const rgb = new Uint8Array(n * 3);
    const transparent = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < 128) {
        transparent[i] = 1;
        rgb[i * 3] = TR; rgb[i * 3 + 1] = TG; rgb[i * 3 + 2] = TB;
      } else {
        rgb[i * 3] = rgba[i * 4]; rgb[i * 3 + 1] = rgba[i * 4 + 1]; rgb[i * 3 + 2] = rgba[i * 4 + 2];
      }
    }

    const palette = quantize(rgb, 256, { format: "rgb565" });
    const index = applyPalette(rgb, palette, "rgb565");

    // Find which palette index the sentinel maps to
    let transIdx = -1;
    for (let i = 0; i < n; i++) {
      if (transparent[i]) { transIdx = index[i]; break; }
    }

    gif.writeFrame(index, size, size, {
      palette,
      delay,
      ...(transIdx >= 0 ? { transparent: transIdx, dispose: 2 } : {}),
    });
  }

  gif.finish();
  const bytes = gif.bytesView();
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:image/gif;base64,${btoa(bin)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StickerCreator({ onSave }: StickerCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CreatorMode>("draw");
  const [selectedColor, setSelectedColor] = useState("#ff6b9d");
  const [stickerName, setStickerName] = useState("");

  // Upload state
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadSize, setUploadSize] = useState<{ w: number; h: number } | null>(null);
  const [uploadIsGif, setUploadIsGif] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Animate state
  const [frames, setFrames] = useState<string[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState<(typeof FPS_OPTIONS)[number]>(6);
  const [playing, setPlaying] = useState(false);
  const [playFrame, setPlayFrame] = useState(0);
  const [encoding, setEncoding] = useState(false);

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // ── Drawing helpers ──────────────────────────────────────────────────────

  const drawStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = selectedColor;
      ctx.lineWidth = BRUSH_SIZE;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const prev = lastPoint.current;
      if (!prev) {
        ctx.beginPath(); ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
      }
      lastPoint.current = { x, y };
    },
    [selectedColor],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault(); isDrawing.current = true; drawStroke(e);
  }, [drawStroke]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return; e.preventDefault(); drawStroke(e);
  }, [drawStroke]);

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false; lastPoint.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    lastPoint.current = null;
  }, []);

  const getCanvasDataUrl = useCallback(() =>
    canvasRef.current?.toDataURL("image/png") ?? "", []);

  // ── Draw mode save ───────────────────────────────────────────────────────

  const handleSaveDraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const name = stickerName.trim() || `Sticker ${Date.now() % 1000}`;
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    let minX = CANVAS_SIZE, minY = CANVAS_SIZE, maxX = 0, maxY = 0, hasContent = false;
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        if (data[(y * CANVAS_SIZE + x) * 4 + 3] > 0) {
          hasContent = true;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (!hasContent) return;
    const pad = 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(CANVAS_SIZE - 1, maxX + pad); maxY = Math.min(CANVAS_SIZE - 1, maxY + pad);
    const trimW = maxX - minX + 1, trimH = maxY - minY + 1;
    const trimmed = document.createElement("canvas");
    trimmed.width = trimW; trimmed.height = trimH;
    trimmed.getContext("2d")!.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    onSave(name, trimmed.toDataURL("image/png"), trimW, trimH, false);
    setStickerName(""); clearCanvas(); setIsOpen(false);
  }, [stickerName, onSave, clearCanvas]);

  // ── Upload mode ──────────────────────────────────────────────────────────

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const isGif = file.type === "image/gif";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setUploadPreview(src);
        setUploadSize({ w: img.naturalWidth, h: img.naturalHeight });
        setUploadIsGif(isGif);
        if (!stickerName) setStickerName(file.name.replace(/\.[^.]+$/, ""));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [stickerName]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.currentTarget.value = "";
  }, [loadImageFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  const handleSaveUpload = useCallback(() => {
    if (!uploadPreview || !uploadSize) return;
    const name = stickerName.trim() || `Photo ${Date.now() % 1000}`;
    onSave(name, uploadPreview, uploadSize.w, uploadSize.h, uploadIsGif);
    setUploadPreview(null); setUploadSize(null); setUploadIsGif(false);
    setStickerName(""); setIsOpen(false);
  }, [uploadPreview, uploadSize, stickerName, uploadIsGif, onSave]);

  // ── Animate mode ─────────────────────────────────────────────────────────

  // Save current canvas into frames array
  const saveCurrentFrame = useCallback(() => {
    const dataUrl = getCanvasDataUrl();
    setFrames((prev) => {
      const next = [...prev];
      next[currentFrame] = dataUrl;
      return next;
    });
  }, [currentFrame, getCanvasDataUrl]);

  // Load a frame onto the canvas
  const loadFrame = useCallback((dataUrl: string | undefined) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = dataUrl;
  }, []);

  const switchToFrame = useCallback((idx: number) => {
    saveCurrentFrame();
    setCurrentFrame(idx);
    setFrames((prev) => {
      loadFrame(prev[idx]);
      return prev;
    });
  }, [saveCurrentFrame, loadFrame]);

  const addFrame = useCallback(() => {
    if (frames.length >= MAX_FRAMES) return;
    saveCurrentFrame();
    const newIdx = frames.length;
    setFrames((prev) => [...prev, ""]);
    setCurrentFrame(newIdx);
    clearCanvas();
  }, [frames.length, saveCurrentFrame, clearCanvas]);

  const deleteFrame = useCallback((idx: number) => {
    if (frames.length <= 1) return;
    saveCurrentFrame();
    setFrames((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const nextIdx = Math.min(idx, next.length - 1);
      setCurrentFrame(nextIdx);
      loadFrame(next[nextIdx]);
      return next;
    });
  }, [frames.length, saveCurrentFrame, loadFrame]);

  // Initialize first frame when switching to animate mode
  useEffect(() => {
    if (mode === "animate" && frames.length === 0) {
      clearCanvas();
      setFrames([""]);
      setCurrentFrame(0);
    }
  }, [mode, frames.length, clearCanvas]);

  // Play animation preview
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (!playing || frames.length < 2) { setPlaying(false); return; }
    playRef.current = setInterval(() => {
      setPlayFrame((f) => (f + 1) % frames.length);
    }, 1000 / fps);
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, fps, frames.length]);

  const handleSaveAnimate = useCallback(async () => {
    saveCurrentFrame();
    const allFrames = await new Promise<string[]>((res) => {
      setFrames((prev) => { res(prev); return prev; });
    });
    const validFrames = allFrames.filter(Boolean);
    if (validFrames.length === 0) return;
    if (validFrames.length === 1) {
      // Single frame → save as static PNG
      const name = stickerName.trim() || `Sticker ${Date.now() % 1000}`;
      onSave(name, validFrames[0], CANVAS_SIZE, CANVAS_SIZE, false);
      handleClose(); return;
    }
    setEncoding(true);
    try {
      const gifDataUrl = await encodeGif(validFrames, CANVAS_SIZE, fps);
      const name = stickerName.trim() || `Animated ${Date.now() % 1000}`;
      onSave(name, gifDataUrl, CANVAS_SIZE, CANVAS_SIZE, true);
      handleClose();
    } finally {
      setEncoding(false);
    }
  }, [saveCurrentFrame, stickerName, fps, onSave]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    setIsOpen(false); setUploadPreview(null); setUploadSize(null);
    setUploadIsGif(false); setStickerName(""); clearCanvas();
    setFrames([]); setCurrentFrame(0); setPlaying(false);
  }, [clearCanvas]);

  const handleModeChange = useCallback((next: CreatorMode) => {
    if (mode === "animate") saveCurrentFrame();
    setMode(next);
    clearCanvas();
  }, [mode, saveCurrentFrame, clearCanvas]);

  // ── Render ───────────────────────────────────────────────────────────────

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
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pink)" }}>
          🎨 Sticker Creator
        </span>
        <button
          onClick={handleClose}
          className="btn-smooth rounded-lg px-2 py-0.5 text-xs"
          style={{ color: "var(--muted)", background: "var(--surface)" }}
        >
          ✕
        </button>
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex rounded-xl p-1" style={{ background: "var(--surface)" }}>
        {(["draw", "upload", "animate"] as CreatorMode[]).map((m) => {
          const labels: Record<CreatorMode, string> = { draw: "✏️ Draw", upload: "📷 Upload", animate: "🎬 Animate" };
          const activeColors: Record<CreatorMode, string> = {
            draw: "rgba(255,107,157,0.18)",
            upload: "rgba(167,139,250,0.18)",
            animate: "rgba(251,191,36,0.18)",
          };
          const textColors: Record<CreatorMode, string> = {
            draw: "var(--pink)",
            upload: "var(--lavender)",
            animate: "#d97706",
          };
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold"
              style={{
                background: mode === m ? activeColors[m] : "transparent",
                color: mode === m ? textColors[m] : "var(--muted-strong)",
              }}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* Name field */}
      <input
        type="text"
        value={stickerName}
        onChange={(e) => setStickerName(e.target.value)}
        placeholder="Sticker name…"
        maxLength={30}
        className="mb-3 w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />

      {/* ── Draw mode ── */}
      {mode === "draw" && (
        <>
          <div className="mb-3 flex justify-center">
            <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="block"
                style={{ width: CANVAS_SIZE * 0.6, height: CANVAS_SIZE * 0.6, touchAction: "none", cursor: "crosshair", background: "rgba(255,255,255,0.05)" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
          </div>
          <ColorPalette selected={selectedColor} onSelect={setSelectedColor} />
          <div className="flex gap-2">
            <button onClick={clearCanvas} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>Clear</button>
            <button onClick={handleSaveDraw} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: "var(--pink)" }}>Save ✨</button>
          </div>
        </>
      )}

      {/* ── Upload mode ── */}
      {mode === "upload" && (
        <>
          {uploadPreview ? (
            <div className="mb-3">
              <div
                className="relative mb-2 flex items-center justify-center overflow-hidden rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 120 }}
              >
                <img
                  src={uploadPreview}
                  alt="Preview"
                  className="max-h-40 max-w-full object-contain"
                />
                {uploadIsGif && (
                  <span
                    className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(251,191,36,0.9)", color: "#1a1a2e" }}
                  >
                    GIF ✨
                  </span>
                )}
                <button
                  onClick={() => { setUploadPreview(null); setUploadSize(null); setUploadIsGif(false); }}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] text-white"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                >
                  ✕
                </button>
              </div>
              <p className="text-center text-[10px]" style={{ color: "var(--muted)" }}>
                {uploadSize ? `${uploadSize.w} × ${uploadSize.h}px` : ""}
                {uploadIsGif ? " · Animated GIF" : ""}
              </p>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl py-8 text-center transition-all"
              style={{
                border: `2px dashed ${isDragOver ? "var(--lavender)" : "var(--border)"}`,
                background: isDragOver ? "rgba(167,139,250,0.07)" : "var(--surface)",
              }}
            >
              <span className="text-2xl">📁</span>
              <p className="text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>Drop image here or click to browse</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>PNG, JPG, WebP · GIF for animated</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={handleSaveUpload}
            disabled={!uploadPreview}
            className="btn-smooth w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-30"
            style={{ background: uploadIsGif ? "#d97706" : "var(--lavender)" }}
          >
            {uploadIsGif ? "Save as Animated Sticker 🎬" : "Save as Sticker ✨"}
          </button>
        </>
      )}

      {/* ── Animate mode ── */}
      {mode === "animate" && (
        <>
          {/* Canvas + play preview overlay */}
          <div className="mb-3 flex justify-center">
            <div className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)", width: CANVAS_SIZE * 0.6, height: CANVAS_SIZE * 0.6 }}>
              {/* Drawing canvas (hidden while playing) */}
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="absolute inset-0 block"
                style={{
                  width: "100%", height: "100%",
                  touchAction: "none", cursor: playing ? "default" : "crosshair",
                  background: "rgba(255,255,255,0.05)",
                  pointerEvents: playing ? "none" : "auto",
                  opacity: playing ? 0 : 1,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              {/* Animation preview (shown while playing) */}
              {playing && frames[playFrame] && (
                <img
                  src={frames[playFrame]}
                  alt="preview"
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
              )}
              {/* Frame counter badge */}
              <span
                className="absolute bottom-1.5 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
              >
                {currentFrame + 1}/{frames.length}
              </span>
            </div>
          </div>

          <ColorPalette selected={selectedColor} onSelect={setSelectedColor} />

          {/* Frame strip */}
          <div className="mb-2 flex gap-1 overflow-x-auto py-1">
            {frames.map((src, idx) => (
              <button
                key={idx}
                onClick={() => switchToFrame(idx)}
                className="relative shrink-0 overflow-hidden rounded-md transition-all"
                style={{
                  width: 36, height: 36,
                  background: "var(--surface)",
                  border: idx === currentFrame ? "2px solid #d97706" : "2px solid var(--border)",
                  outline: "none",
                }}
              >
                {src ? (
                  <img src={src} alt={`Frame ${idx + 1}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px]" style={{ color: "var(--muted)" }}>
                    {idx + 1}
                  </span>
                )}
                {frames.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFrame(idx); }}
                    className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-bl-md text-[8px] text-white"
                    style={{ background: "rgba(0,0,0,0.5)", lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </button>
            ))}
            {frames.length < MAX_FRAMES && (
              <button
                onClick={addFrame}
                className="btn-smooth shrink-0 rounded-md text-sm font-bold"
                style={{ width: 36, height: 36, background: "var(--surface)", border: "2px dashed var(--border)", color: "var(--muted-strong)" }}
              >
                +
              </button>
            )}
          </div>

          {/* Controls row */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => {
                if (playing) { setPlaying(false); }
                else { saveCurrentFrame(); setPlayFrame(0); setPlaying(true); }
              }}
              className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: playing ? "rgba(251,191,36,0.2)" : "var(--surface)", color: playing ? "#d97706" : "var(--muted-strong)", border: "1px solid var(--border)" }}
            >
              {playing ? "⏸ Pause" : "▶ Preview"}
            </button>
            <div className="flex items-center gap-1 rounded-lg px-2 py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>fps</span>
              {FPS_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className="btn-smooth rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: fps === f ? "rgba(251,191,36,0.25)" : "transparent",
                    color: fps === f ? "#d97706" : "var(--muted-strong)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={clearCanvas} className="btn-smooth ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)", border: "1px solid var(--border)" }}>
              Clear
            </button>
          </div>

          <button
            onClick={handleSaveAnimate}
            disabled={encoding}
            className="btn-smooth w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: encoding ? "var(--muted-strong)" : "#d97706" }}
          >
            {encoding ? "Encoding GIF…" : frames.length > 1 ? "Save Animated Sticker 🎬" : "Save Sticker ✨"}
          </button>
        </>
      )}
    </div>
  );
}

function ColorPalette({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-1">
      {PASTEL_COLORS.slice(0, 12).map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className={`h-5 w-5 rounded-md border-2 transition-all ${selected === color ? "scale-110 border-white/40" : "border-transparent"}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
