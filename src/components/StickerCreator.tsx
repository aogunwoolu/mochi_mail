
import React, { useRef, useState, useCallback } from "react";
import { PASTEL_COLORS } from "@/types";

interface StickerCreatorProps {
  onSave: (name: string, imageData: string, width: number, height: number) => void;
}

const CANVAS_SIZE = 320;
const BRUSH_SIZE = 12;

type CreatorMode = "draw" | "upload";

export default function StickerCreator({ onSave }: StickerCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CreatorMode>("draw");
  const [selectedColor, setSelectedColor] = useState("#ff6b9d");
  const [stickerName, setStickerName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadSize, setUploadSize] = useState<{ w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

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
    },
    [selectedColor]
  );

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

  const handleSaveDraw = useCallback(() => {
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

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setUploadPreview(src);
        setUploadSize({ w: img.naturalWidth, h: img.naturalHeight });
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
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  const handleSaveUpload = useCallback(() => {
    if (!uploadPreview || !uploadSize) return;
    const name = stickerName.trim() || `Photo ${Date.now() % 1000}`;
    onSave(name, uploadPreview, uploadSize.w, uploadSize.h);
    setUploadPreview(null);
    setUploadSize(null);
    setStickerName("");
    setIsOpen(false);
  }, [uploadPreview, uploadSize, stickerName, onSave]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setUploadPreview(null);
    setUploadSize(null);
    setStickerName("");
    handleClear();
  }, [handleClear]);

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
        <button onClick={handleClose} className="btn-smooth rounded-lg px-2 py-0.5 text-xs" style={{ color: "var(--muted)", background: "var(--surface)" }}>✕</button>
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex rounded-xl p-1" style={{ background: "var(--surface)" }}>
        <button
          onClick={() => setMode("draw")}
          className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold"
          style={{
            background: mode === "draw" ? "rgba(255,107,157,0.18)" : "transparent",
            color: mode === "draw" ? "var(--pink)" : "var(--muted-strong)",
          }}
        >
          ✏️ Draw
        </button>
        <button
          onClick={() => setMode("upload")}
          className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold"
          style={{
            background: mode === "upload" ? "rgba(167,139,250,0.18)" : "transparent",
            color: mode === "upload" ? "var(--lavender)" : "var(--muted-strong)",
          }}
        >
          📷 Upload Photo
        </button>
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

      {mode === "draw" ? (
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
            <button onClick={handleSaveDraw} className="btn-smooth flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: "var(--pink)" }}>Save ✨</button>
          </div>
        </>
      ) : (
        <>
          {/* Drop zone / preview */}
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
                  style={{ imageRendering: "auto" }}
                />
                <button
                  onClick={() => { setUploadPreview(null); setUploadSize(null); }}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] text-white"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                >
                  ✕
                </button>
              </div>
              {uploadSize && (
                <p className="text-center text-[10px]" style={{ color: "var(--muted)" }}>
                  {uploadSize.w} × {uploadSize.h}px
                </p>
              )}
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
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>PNG, JPG, GIF, WebP supported</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={handleSaveUpload}
            disabled={!uploadPreview}
            className="btn-smooth w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-30"
            style={{ background: "var(--lavender)" }}
          >
            Save as Sticker ✨
          </button>
        </>
      )}
    </div>
  );
}
