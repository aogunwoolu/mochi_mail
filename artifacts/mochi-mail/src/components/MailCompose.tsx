"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import DrawingCanvas, { DrawingCanvasHandle } from "./DrawingCanvas";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  BrushSettings,
  DELIVERY_SPEEDS,
  STAMP_STYLES,
  DeliverySpeed,
  CustomFont,
  PaperBackground,
  PlacedSticker,
  Sticker,
  WashiTape,
} from "@/types";

interface MailComposeProps {
  onSend: (receiverName: string, imageData: string, speed: DeliverySpeed, stamp: string) => void;
  senderName: string;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  onSaveSticker: (name: string, imageData: string, w: number, h: number, isAnimated?: boolean) => void;
  onSaveWashi: (name: string, imageData: string, opacity: number, w: number, h: number) => void;
  onSaveCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
  onDeletePaper: (id: string) => void;
  onDeleteCustomFont: (id: string) => void;
  onBack?: () => void;
}

export default function MailCompose({
  onSend,
  senderName,
  stickers,
  washiTapes,
  papers,
  customFonts,
  onSaveSticker,
  onSaveWashi,
  onSaveCustomFont,
  onDeleteSticker,
  onDeleteWashi,
  onDeletePaper,
  onDeleteCustomFont,
  onBack,
}: Readonly<MailComposeProps>) {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [receiver, setReceiver] = useState("");
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [speed, setSpeed] = useState<DeliverySpeed>("standard");
  const [stamp, setStamp] = useState(STAMP_STYLES[0]);
  const [selectedAsset, setSelectedAsset] = useState<Sticker | WashiTape | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperBackground | null>(papers[0] ?? null);
  const [placedItems, setPlacedItems] = useState<PlacedSticker[]>([]);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    color: "#1e1e2e",
    size: 4,
    tool: "pen",
    textSize: 34,
    textFont: '"Space Mono", monospace',
  });
  const [sent, setSent] = useState(false);
  const [showAssetDrawer, setShowAssetDrawer] = useState<"stickers" | "washi" | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("username")
      .then(({ data, error }) => {
        if (error) console.error("[MailCompose] recipient list:", error.message);
        if (data) setAllUsernames(data.map((row) => row.username));
      });
  }, []);

  const filteredSuggestions = receiver.trim()
    ? allUsernames
        .filter((username) => username.toLowerCase().includes(receiver.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const handleSend = useCallback(() => {
    if (!receiver.trim() || !canvasRef.current) return;
    const composite = canvasRef.current.getCompositeCanvas();
    const imageData = composite.toDataURL("image/png");
    onSend(receiver.trim(), imageData, speed, stamp);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setReceiver("");
      canvasRef.current?.clearCanvas();
      setPlacedItems([]);
    }, 2000);
  }, [receiver, speed, stamp, onSend]);

  const placeItem = useCallback((asset: Sticker | WashiTape, x: number, y: number) => {
    const isWashi = "opacity" in asset;
    setPlacedItems((prev) => [
      ...prev,
      {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        stickerId: asset.id,
        x,
        y,
        imageData: asset.imageData,
        width: asset.width,
        height: asset.height,
        rotation: 0,
        type: isWashi ? "washi" : "sticker",
        opacity: isWashi ? asset.opacity : 1,
        isAnimated: !isWashi && Boolean(asset.isAnimated),
      },
    ]);
  }, []);

  const updatePlacedItem = useCallback((id: string, updates: Partial<PlacedSticker>) => {
    setPlacedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const handleSelectSticker = useCallback((sticker: Sticker) => {
    setSelectedAsset(sticker);
    setBrushSettings((prev) => ({ ...prev, tool: "sticker" }));
  }, []);

  const handleSelectWashi = useCallback((washi: WashiTape) => {
    setSelectedAsset(washi);
    setBrushSettings((prev) => ({ ...prev, tool: "washi" }));
  }, []);

  const handleDeselectAsset = useCallback(() => {
    setSelectedAsset(null);
  }, []);

  if (sent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-20 animate-fade-in">
        <div className="text-6xl animate-float">{stamp}</div>
        <div className="text-lg font-semibold" style={{ color: "var(--pink)" }}>Letter sent!</div>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          On its way to {receiver}...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 h-full flex-col gap-4 overflow-y-auto p-4 animate-fade-in sm:p-5">
      {onBack && (
        <button
          onClick={onBack}
          className="btn-smooth panel-soft self-start rounded-lg px-3 py-1.5 text-xs"
          style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
        >
          ← Back to inbox
        </button>
      )}
      {/* Addressing */}
      <div className="panel p-4">
        <p className="section-title mb-3">Address</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="mail-compose-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              From
            </label>
            <div id="mail-compose-from" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
              {senderName}
            </div>
          </div>
          <div className="text-xl" style={{ color: "var(--muted)" }}>→</div>
          <div className="flex-1">
            <label htmlFor="mail-compose-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              To
            </label>
            <div className="relative">
              <input
                id="mail-compose-to"
                type="text"
                value={receiver}
                onChange={(e) => {
                  setReceiver(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Recipient name..."
                maxLength={30}
                autoComplete="off"
                className="input-soft w-full px-3 py-2 text-sm outline-none"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border shadow-xl"
                  style={{ background: "var(--glass)", borderColor: "var(--border-strong)", backdropFilter: "blur(12px)" }}
                >
                  {filteredSuggestions.map((username) => (
                    <button
                      key={username}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setReceiver(username);
                        setShowSuggestions(false);
                      }}
                      className="btn-smooth flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
                      >
                        {username[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium">{username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Letter canvas + right-side tool panel */}
      <div className="panel overflow-visible p-0">
        <div className="px-4 pt-4 pb-2">
          <p className="section-title">Letter Canvas</p>
        </div>
        <div className="mx-4 mb-4 flex items-stretch gap-3" style={{ height: "clamp(280px,52vh,580px)" }}>
          {/* Mini asset drawer — slides in to the left of canvas */}
          {showAssetDrawer && (
            <div
              className="w-32 shrink-0 flex flex-col rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  {showAssetDrawer === "stickers" ? "Stickers" : "Washi"}
                </span>
                <button
                  onClick={() => setShowAssetDrawer(null)}
                  className="btn-smooth text-[11px] leading-none"
                  style={{ color: "var(--muted)" }}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                {showAssetDrawer === "stickers" && (
                  <div className="grid grid-cols-3 gap-1">
                    {stickers.length === 0 && (
                      <p className="col-span-3 text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>No stickers yet</p>
                    )}
                    {stickers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { handleSelectSticker(s); setShowAssetDrawer(null); }}
                        className="btn-smooth aspect-square overflow-hidden rounded-lg border-2"
                        style={{
                          borderColor: selectedAsset?.id === s.id ? "var(--pink)" : "transparent",
                          background: "rgba(255,255,255,0.6)",
                        }}
                      >
                        <img src={s.imageData} alt={s.name} className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
                {showAssetDrawer === "washi" && (
                  <div className="flex flex-col gap-1">
                    {washiTapes.length === 0 && (
                      <p className="text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>No washi yet</p>
                    )}
                    {washiTapes.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => { handleSelectWashi(w); setShowAssetDrawer(null); }}
                        className="btn-smooth h-10 w-full overflow-hidden rounded-lg border-2"
                        style={{
                          borderColor: selectedAsset?.id === w.id ? "var(--pink)" : "transparent",
                        }}
                      >
                        <img
                          src={w.imageData}
                          alt={w.name}
                          className="w-full h-full object-cover"
                          style={{ opacity: w.opacity }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="relative flex-1 min-w-0 overflow-hidden rounded-xl panel-soft">
            <DrawingCanvas
              ref={canvasRef}
              brushSettings={brushSettings}
              placedItems={placedItems}
              selectedAsset={selectedAsset}
              selectedPaper={selectedPaper}
              customFonts={customFonts}
              onPlaceAsset={placeItem}
              onUpdatePlacedItem={updatePlacedItem}
              width={1200}
              height={900}
              fillContainer
            />
          </div>

          {/* Right-side tool panel */}
          <div
            className="w-16 shrink-0 flex flex-col items-center gap-1 rounded-xl border py-2 px-1 overflow-y-auto"
            style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.92)" }}
          >
            {/* Drawing tools */}
            {([
              {
                id: "pen" as const,
                title: "Pen",
                label: "Pen",
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                ),
              },
              {
                id: "eraser" as const,
                title: "Eraser",
                label: "Erase",
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M15.14 3 21 8.86 8.86 21H3v-5.86L15.14 3zm0 2.83L5 15.97V19h3.03L18.17 8.86 15.14 5.83z" />
                  </svg>
                ),
              },
              {
                id: "select" as const,
                title: "Select",
                label: "Select",
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M6 2v15.5l3.5-3.1 2 3.9 1.8-.9-2-3.9H17L6 2z" />
                  </svg>
                ),
              },
              {
                id: "text" as const,
                title: "Text",
                label: "Text",
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M5 4v3h5.5v12h3V7H19V4H5z" />
                  </svg>
                ),
              },
            ] as { id: "pen" | "eraser" | "select" | "text"; title: string; label: string; icon: React.ReactNode }[]).map(
              ({ id, title, label, icon }) => {
                const active = brushSettings.tool === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setBrushSettings((prev) => ({ ...prev, tool: id }));
                      setShowAssetDrawer(null);
                    }}
                    title={title}
                    className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{
                        background: active ? "rgba(255,107,157,0.15)" : "rgba(255,255,255,0.7)",
                        border: active ? "1.5px solid rgba(255,107,157,0.45)" : "1.5px solid rgba(0,0,0,0.07)",
                        color: active ? "var(--pink)" : "var(--muted-strong)",
                      }}
                    >
                      {icon}
                    </span>
                    <span
                      className="text-[9px] font-medium"
                      style={{ color: active ? "var(--pink)" : "var(--muted)" }}
                    >
                      {label}
                    </span>
                  </button>
                );
              }
            )}

            <div className="w-full border-t my-0.5" style={{ borderColor: "var(--border)" }} />

            {/* Color picker */}
            <button
              title="Brush colour"
              onClick={() => colorInputRef.current?.click()}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
              >
                <span
                  className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                  style={{ background: brushSettings.color }}
                />
              </span>
              <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Colour</span>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={brushSettings.color}
              onChange={(e) => setBrushSettings((prev) => ({ ...prev, color: e.target.value }))}
              className="sr-only"
              tabIndex={-1}
              aria-label="Brush colour"
            />

            {/* Brush size */}
            <div className="flex flex-col items-center gap-0.5 w-full px-1 py-0.5">
              <button
                onClick={() =>
                  brushSettings.tool === "text"
                    ? setBrushSettings((prev) => ({ ...prev, textSize: Math.min(96, (prev.textSize ?? 34) + 2) }))
                    : setBrushSettings((prev) => ({ ...prev, size: Math.min(40, prev.size + 1) }))
                }
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
              >
                +
              </button>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--muted-strong)" }}>
                {brushSettings.tool === "text" ? (brushSettings.textSize ?? 34) : brushSettings.size}
              </span>
              <button
                onClick={() =>
                  brushSettings.tool === "text"
                    ? setBrushSettings((prev) => ({ ...prev, textSize: Math.max(8, (prev.textSize ?? 34) - 2) }))
                    : setBrushSettings((prev) => ({ ...prev, size: Math.max(1, prev.size - 1) }))
                }
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
              >
                −
              </button>
            </div>

            <div className="w-full border-t my-0.5" style={{ borderColor: "var(--border)" }} />

            {/* Stickers */}
            <button
              title="Stickers"
              onClick={() => setShowAssetDrawer((prev) => (prev === "stickers" ? null : "stickers"))}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                style={{
                  background:
                    showAssetDrawer === "stickers" || brushSettings.tool === "sticker"
                      ? "rgba(255,107,157,0.15)"
                      : "rgba(255,255,255,0.7)",
                  border:
                    showAssetDrawer === "stickers" || brushSettings.tool === "sticker"
                      ? "1.5px solid rgba(255,107,157,0.45)"
                      : "1.5px solid rgba(0,0,0,0.07)",
                }}
              >
                🌸
              </span>
              <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Sticker</span>
            </button>

            {/* Washi */}
            <button
              title="Washi Tape"
              onClick={() => setShowAssetDrawer((prev) => (prev === "washi" ? null : "washi"))}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                style={{
                  background:
                    showAssetDrawer === "washi" || brushSettings.tool === "washi"
                      ? "rgba(255,107,157,0.15)"
                      : "rgba(255,255,255,0.7)",
                  border:
                    showAssetDrawer === "washi" || brushSettings.tool === "washi"
                      ? "1.5px solid rgba(255,107,157,0.45)"
                      : "1.5px solid rgba(0,0,0,0.07)",
                }}
              >
                🎀
              </span>
              <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Washi</span>
            </button>

            <div className="w-full border-t my-0.5 mt-auto" style={{ borderColor: "var(--border)" }} />

            {/* Undo */}
            <button
              title="Undo"
              onClick={() => canvasRef.current?.undo()}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "var(--muted-strong)",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.46 7.46 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                </svg>
              </span>
              <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Undo</span>
            </button>

            {/* Redo */}
            <button
              title="Redo"
              onClick={() => canvasRef.current?.redo()}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "var(--muted-strong)",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
                </svg>
              </span>
              <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Redo</span>
            </button>

            {/* Clear */}
            <button
              title="Clear canvas"
              onClick={() => {
                canvasRef.current?.clearCanvas();
                setPlacedItems([]);
              }}
              className="btn-smooth flex flex-col items-center gap-0.5 w-full px-1 py-1"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "#e05",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </span>
              <span className="text-[9px] font-medium" style={{ color: "#e05" }}>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delivery options */}
      <div className="panel p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          {/* Speed */}
          <div className="flex-1">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Delivery Speed
            </div>
            <div className="flex gap-2">
              {DELIVERY_SPEEDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSpeed(s.id)}
                  className={`btn-smooth flex-1 rounded-xl p-3 text-center ${speed === s.id ? "glow-lavender" : ""}`}
                  style={{
                    background: speed === s.id ? "rgba(167,139,250,0.12)" : "var(--surface)",
                    border: speed === s.id ? "1px solid rgba(167,139,250,0.3)" : "1px solid var(--border)",
                  }}
                >
                  <div className="text-xl">{s.emoji}</div>
                  <div className="mt-1 text-xs font-semibold">{s.label}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted)" }}>{s.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stamp selection */}
        <div className="mt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Stamp
          </div>
          <div className="flex gap-2">
            {STAMP_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStamp(s)}
                className={`btn-smooth flex h-10 w-10 items-center justify-center rounded-xl text-xl ${stamp === s ? "glow-pink" : ""}`}
                style={{
                  background: stamp === s ? "rgba(255,107,157,0.12)" : "var(--surface)",
                  border: stamp === s ? "1px solid rgba(255,107,157,0.3)" : "1px solid var(--border)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!receiver.trim()}
          className="btn-smooth mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-30"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
        >
          {stamp} Send Letter
        </button>
      </div>
    </div>
  );
}
