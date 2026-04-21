"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import DrawingCanvas, { DrawingCanvasHandle } from "./DrawingCanvas";
import StudioToolbar from "./StudioToolbar";
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
  onSaveSticker: (name: string, imageData: string, w: number, h: number) => void;
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

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("username")
      .then(({ data }) => {
        if (data) {
          setAllUsernames(data.map((row) => row.username));
        }
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
        type: isWashi ? "washi" : "sticker",
        opacity: isWashi ? asset.opacity : 1,
      },
    ]);
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

      {/* Letter canvas + full art toolbar */}
      <div className="panel overflow-visible p-0">
        <div className="px-4 pt-4 pb-3">
          <p className="section-title">Letter Canvas</p>
        </div>
        {/* Canvas — larger 4:3 frame so handwriting feels less cramped */}
        <div className="panel-soft relative mx-4 mb-3 h-[clamp(240px,44vh,520px)] overflow-hidden rounded-xl sm:h-[clamp(280px,48vh,620px)]" style={{ aspectRatio: "4/3" }}>
          <DrawingCanvas
            ref={canvasRef}
            brushSettings={brushSettings}
            placedItems={placedItems}
            selectedAsset={selectedAsset}
            selectedPaper={selectedPaper}
            customFonts={customFonts}
            onPlaceAsset={placeItem}
            width={1200}
            height={900}
            fillContainer
          />
        </div>
        {/* Toolbar — explicit tools block for visibility and reliable layout */}
        <div className="mx-4 mb-4 rounded-xl border px-2 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.78)" }}>
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
            Edit Tools
          </p>
          <StudioToolbar
            brushSettings={brushSettings}
            onBrushChange={(update) => setBrushSettings((prev) => ({ ...prev, ...update }))}
            onUndo={() => canvasRef.current?.undo()}
            onClear={() => {
              canvasRef.current?.clearCanvas();
              setPlacedItems([]);
            }}
            onExport={() => {}}
            stickers={stickers}
            washiTapes={washiTapes}
            papers={papers}
            customFonts={customFonts}
            selectedAsset={selectedAsset}
            selectedPaper={selectedPaper}
            onSelectSticker={handleSelectSticker}
            onSelectWashi={handleSelectWashi}
            onSelectPaper={setSelectedPaper}
            onDeselectAsset={handleDeselectAsset}
            onDeleteSticker={onDeleteSticker}
            onDeleteWashi={onDeleteWashi}
            onDeletePaper={onDeletePaper}
            onDeleteCustomFont={onDeleteCustomFont}
            onSaveSticker={onSaveSticker}
            onSaveWashi={onSaveWashi}
            onSaveCustomFont={onSaveCustomFont}
          />
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
