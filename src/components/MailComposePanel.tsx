"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, { DrawingCanvasHandle } from "./DrawingCanvas";
import FontTracerCreator from "./FontTracerCreator";
import StickerCreator from "./StickerCreator";
import WashiTapeCreator from "./WashiTapeCreator";
import MailAssetCreator from "./MailAssetCreator";
import { FiArrowLeft, FiClock, FiEdit3, FiImage, FiMove, FiPenTool, FiRotateCcw, FiRotateCw, FiSend, FiTrash2, FiType } from "react-icons/fi";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  BrushSettings,
  CustomFont,
  DELIVERY_SPEEDS,
  DeliverySpeed,
  EnvelopeStyle,
  LetterSendPayload,
  MailStamp,
  PASTEL_COLORS,
  PaperBackground,
  PlacedSticker,
  STAMP_STYLES,
  Sticker,
  WashiTape,
} from "@/types";

const BUILTIN_TEXT_FONTS = [
  { value: '"Space Mono", monospace', label: "Space Mono" },
  { value: '"Arial", sans-serif', label: "Arial" },
  { value: '"Georgia", serif', label: "Georgia" },
  { value: '"Times New Roman", serif', label: "Times" },
  { value: '"Courier New", monospace', label: "Courier" },
  { value: '"Brush Script MT", cursive', label: "Brush Script" },
] as const;

const GIF_PROVIDER = (process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy").toLowerCase();
const GIFAPI_BASE_URL = process.env.NEXT_PUBLIC_GIFAPI_BASE_URL ?? "https://api.gifapi.com/v1";
const GIFAPI_KEY = process.env.NEXT_PUBLIC_GIFAPI_KEY ?? "";
const GIPHY_KEY = process.env.GIPHY_API_KEY ?? "";

type ComposeSurface = "letter" | "envelope";
type ToolDrawer = "stickers" | "washi" | "paper" | "envelopes" | "stamps" | "gifs" | "create" | null;

type GifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  gifUrl: string;
  width: number;
  height: number;
};

interface MailComposePanelProps {
  onSend: (payload: LetterSendPayload) => void;
  senderName: string;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  stamps: MailStamp[];
  envelopes: EnvelopeStyle[];
  customFonts: CustomFont[];
  onSaveSticker: (name: string, imageData: string, w: number, h: number, isAnimated?: boolean) => void;
  onSaveWashi: (name: string, imageData: string, opacity: number, w: number, h: number) => void;
  onSavePaper: (name: string, imageData: string, w: number, h: number) => void;
  onSaveStamp: (name: string, imageData: string, w: number, h: number) => void;
  onSaveEnvelope: (name: string, imageData: string, w: number, h: number) => void;
  onSaveCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
  onDeletePaper: (id: string) => void;
  onDeleteStamp: (id: string) => void;
  onDeleteEnvelope: (id: string) => void;
  onDeleteCustomFont: (id: string) => void;
  onBack?: () => void;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeGifResults(payload: unknown): GifSearchResult[] {
  const data = (payload as { data?: unknown[]; results?: unknown[] })?.data
    ?? (payload as { data?: unknown[]; results?: unknown[] })?.results
    ?? [];
  if (!Array.isArray(data)) return [];

  return data
    .map((entry, index) => {
      const item = entry as {
        id?: string;
        title?: string;
        content_description?: string;
        url?: string;
        images?: {
          fixed_width?: { url?: string; width?: string | number; height?: string | number };
          downsized_medium?: { url?: string; width?: string | number; height?: string | number };
          original?: { url?: string; width?: string | number; height?: string | number };
        };
        media_formats?: {
          gif?: { url?: string; dims?: number[] };
          tinygif?: { url?: string; dims?: number[] };
          nanogif?: { url?: string; dims?: number[] };
        };
      };

      const previewUrl = item.images?.fixed_width?.url ?? item.media_formats?.tinygif?.url ?? item.media_formats?.nanogif?.url;
      const gifUrl = item.images?.downsized_medium?.url ?? item.images?.original?.url ?? item.media_formats?.gif?.url ?? item.url;
      if (!previewUrl || !gifUrl) return null;

      return {
        id: item.id ?? `gif-${index}`,
        title: item.title ?? item.content_description ?? "GIF",
        previewUrl,
        gifUrl,
        width: toNumber(item.images?.fixed_width?.width ?? item.images?.original?.width ?? item.media_formats?.gif?.dims?.[0], 200),
        height: toNumber(item.images?.fixed_width?.height ?? item.images?.original?.height ?? item.media_formats?.gif?.dims?.[1], 200),
      } satisfies GifSearchResult;
    })
    .filter((item): item is GifSearchResult => item !== null);
}

function makeEmojiStampPreview(emoji: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 140;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#ff8db8");
  gradient.addColorStop(1, "#ffd2df");
  ctx.fillStyle = gradient;
  ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.setLineDash([]);
  ctx.font = "64px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2 + 4);
  return canvas.toDataURL("image/png");
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  if (!img.complete) {
    await img.decode().catch(() => undefined);
  }
  return img;
}

export default function MailComposePanel({
  onSend,
  senderName,
  stickers,
  washiTapes,
  papers,
  stamps,
  envelopes,
  customFonts,
  onSaveSticker,
  onSaveWashi,
  onSavePaper,
  onSaveStamp,
  onSaveEnvelope,
  onSaveCustomFont,
  onDeleteSticker,
  onDeleteWashi,
  onDeletePaper,
  onDeleteStamp,
  onDeleteEnvelope,
  onDeleteCustomFont,
  onBack,
}: Readonly<MailComposePanelProps>) {
  const letterCanvasRef = useRef<DrawingCanvasHandle>(null);
  const envelopeCanvasRef = useRef<DrawingCanvasHandle>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [receiver, setReceiver] = useState("");
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [speed, setSpeed] = useState<DeliverySpeed>("standard");
  const [stampStyle, setStampStyle] = useState(STAMP_STYLES[0]);
  const [selectedStamp, setSelectedStamp] = useState<MailStamp | null>(stamps[0] ?? null);
  const [selectedEnvelope, setSelectedEnvelope] = useState<EnvelopeStyle | null>(envelopes[0] ?? null);
  const [selectedPaper, setSelectedPaper] = useState<PaperBackground | null>(papers[0] ?? null);
  const [selectedAsset, setSelectedAsset] = useState<Sticker | WashiTape | null>(null);
  const [letterPlacedItems, setLetterPlacedItems] = useState<PlacedSticker[]>([]);
  const [envelopePlacedItems, setEnvelopePlacedItems] = useState<PlacedSticker[]>([]);
  const [activeSurface, setActiveSurface] = useState<ComposeSurface>("letter");
  const [toolDrawer, setToolDrawer] = useState<ToolDrawer>("stickers");
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    color: "#1e1e2e",
    size: 4,
    tool: "pen",
    textSize: 32,
    textFont: '"Space Mono", monospace',
  });
  const [gifQuery, setGifQuery] = useState("cute mail sticker");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [sendPreview, setSendPreview] = useState<{
    receiverName: string;
    letterImageData: string;
    envelopeImageData: string;
    stampImageData?: string;
    stampStyle: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("username")
      .then(({ data, error }) => {
        if (error) console.error("[MailComposePanel] recipient list:", error.message);
        if (data) setAllUsernames(data.map((row) => row.username));
      });
  }, []);

  useEffect(() => {
    if (!selectedStamp && stamps.length > 0) setSelectedStamp(stamps[0]);
  }, [selectedStamp, stamps]);

  useEffect(() => {
    if (!selectedEnvelope && envelopes.length > 0) setSelectedEnvelope(envelopes[0]);
  }, [envelopes, selectedEnvelope]);

  useEffect(() => {
    if (!selectedPaper && papers.length > 0) setSelectedPaper(papers[0]);
  }, [papers, selectedPaper]);

  const filteredSuggestions = receiver.trim()
    ? allUsernames.filter((username) => username.toLowerCase().includes(receiver.trim().toLowerCase())).slice(0, 8)
    : [];

  const activeCanvasRef = activeSurface === "letter" ? letterCanvasRef : envelopeCanvasRef;

  const setActivePlacedItems = useCallback((updater: (prev: PlacedSticker[]) => PlacedSticker[]) => {
    if (activeSurface === "letter") {
      setLetterPlacedItems(updater);
      return;
    }
    setEnvelopePlacedItems(updater);
  }, [activeSurface]);

  const placeItem = useCallback((asset: Sticker | WashiTape, x: number, y: number) => {
    const isWashi = "opacity" in asset;
    const nextItem: PlacedSticker = {
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
    };
    setActivePlacedItems((prev) => [...prev, nextItem]);
  }, [setActivePlacedItems]);

  const updatePlacedItem = useCallback((id: string, updates: Partial<PlacedSticker>) => {
    setActivePlacedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, [setActivePlacedItems]);

  const placeTextItem = useCallback((item: PlacedSticker) => {
    setActivePlacedItems((prev) => [...prev, item]);
    return item;
  }, [setActivePlacedItems]);

  const clearActiveSurface = useCallback(() => {
    activeCanvasRef.current?.clearCanvas();
    setActivePlacedItems(() => []);
  }, [activeCanvasRef, setActivePlacedItems]);

  const searchGifs = useCallback(async () => {
    const query = gifQuery.trim();
    if (!query) {
      setGifError("Enter a search term first.");
      return;
    }
    if (GIF_PROVIDER === "giphy" && !GIPHY_KEY) {
      setGifError("Missing GIPHY_API_KEY.");
      return;
    }
    if (GIF_PROVIDER !== "giphy" && !GIFAPI_KEY) {
      setGifError("Missing GIFAPI_KEY.");
      return;
    }

    setGifLoading(true);
    setGifError(null);
    try {
      const url = GIF_PROVIDER === "giphy"
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=18&rating=pg`
        : `${GIFAPI_BASE_URL}/gifs/search?api_key=${encodeURIComponent(GIFAPI_KEY)}&q=${encodeURIComponent(query)}&limit=18`;
      const response = await fetch(url);
      const payload = await response.json();
      const results = normalizeGifResults(payload);
      setGifResults(results);
      if (results.length === 0) setGifError("No GIFs found for that search.");
    } catch {
      setGifError("Could not fetch GIFs right now.");
    } finally {
      setGifLoading(false);
    }
  }, [gifQuery]);

  const addGifAsset = useCallback(async (src: string, title?: string) => {
    const image = await loadImage(src);
    onSaveSticker(title?.trim() || "Mail GIF", src, image.naturalWidth || 180, image.naturalHeight || 180, true);
    setToolDrawer("stickers");
  }, [onSaveSticker]);

  const createLetterCanvas = useCallback(() => {
    const base = letterCanvasRef.current?.getCompositeCanvas();
    if (!base) return null;
    const output = document.createElement("canvas");
    output.width = base.width;
    output.height = base.height;
    const ctx = output.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillRect(48, 40, Math.min(360, output.width - 96), 78);
    ctx.fillStyle = "#5b4b65";
    ctx.font = '600 34px "Space Mono", monospace';
    ctx.fillText(`To: ${receiver.trim()}`, 72, 88);
    return output;
  }, [receiver]);

  const createEnvelopeCanvas = useCallback(async () => {
    const base = envelopeCanvasRef.current?.getCompositeCanvas();
    if (!base) return null;
    const output = document.createElement("canvas");
    output.width = base.width;
    output.height = base.height;
    const ctx = output.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(base, 0, 0);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.roundRect(output.width * 0.22, output.height * 0.44, output.width * 0.46, 92, 24);
    ctx.fill();
    ctx.fillStyle = "#5f5168";
    ctx.textAlign = "center";
    ctx.font = '600 34px "Space Mono", monospace';
    ctx.fillText(receiver.trim(), output.width / 2, output.height * 0.51 + 28);
    ctx.textAlign = "start";

    if (selectedStamp?.imageData) {
      const stampImage = await loadImage(selectedStamp.imageData);
      const stampWidth = 150;
      const stampHeight = 172;
      ctx.drawImage(stampImage, output.width - stampWidth - 78, 72, stampWidth, stampHeight);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.roundRect(output.width - 220, 84, 126, 144, 22);
      ctx.fill();
      ctx.font = "72px serif";
      ctx.fillStyle = "#ff6b9d";
      ctx.fillText(stampStyle, output.width - 175, 182);
    }

    return output;
  }, [receiver, selectedStamp, stampStyle]);

  const handleSend = useCallback(async () => {
    if (!receiver.trim()) return;
    const letterCanvas = createLetterCanvas();
    const envelopeCanvas = await createEnvelopeCanvas();
    if (!letterCanvas || !envelopeCanvas) return;

    const letterImageData = letterCanvas.toDataURL("image/png");
    const envelopeImageData = envelopeCanvas.toDataURL("image/png");
    const payload: LetterSendPayload = {
      receiverName: receiver.trim(),
      imageData: letterImageData,
      speed,
      stampStyle,
      stampImageData: selectedStamp?.imageData ?? makeEmojiStampPreview(stampStyle),
      stampName: selectedStamp?.name ?? `Emoji ${stampStyle}`,
      envelopeImageData,
      envelopeName: selectedEnvelope?.name ?? "Envelope",
    };

    onSend(payload);
    setSendPreview({
      receiverName: receiver.trim(),
      letterImageData,
      envelopeImageData,
      stampImageData: payload.stampImageData,
      stampStyle,
    });

    globalThis.setTimeout(() => {
      setSendPreview(null);
      setReceiver("");
      setLetterPlacedItems([]);
      setEnvelopePlacedItems([]);
      letterCanvasRef.current?.clearCanvas();
      envelopeCanvasRef.current?.clearCanvas();
      onBack?.();
    }, 1800);
  }, [createEnvelopeCanvas, createLetterCanvas, onBack, onSend, receiver, selectedEnvelope?.name, selectedStamp, speed, stampStyle]);

  const handleSelectSticker = useCallback((sticker: Sticker) => {
    setSelectedAsset(sticker);
    setBrushSettings((prev) => ({ ...prev, tool: "sticker" }));
  }, []);

  const handleSelectWashi = useCallback((washi: WashiTape) => {
    setSelectedAsset(washi);
    setBrushSettings((prev) => ({ ...prev, tool: "washi" }));
  }, []);

  const activeFontOptions = useMemo(
    () => [
      ...BUILTIN_TEXT_FONTS,
      ...customFonts.map((font) => ({ value: `custom:${font.id}`, label: `${font.name} (custom)` })),
    ],
    [customFonts]
  );

  if (sendPreview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 animate-fade-in">
        <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--pink)" }}>
          Sending letter
        </p>
        <div className="relative h-[420px] w-full max-w-3xl overflow-hidden rounded-[32px] border bg-[rgba(255,255,255,0.72)]" style={{ borderColor: "var(--border)" }}>
          <div className="absolute left-1/2 top-10 z-10 w-[52%] -translate-x-1/2 animate-mail-letter-send rounded-[24px] border bg-white p-4 shadow-2xl" style={{ borderColor: "rgba(255, 184, 205, 0.5)" }}>
            <img src={sendPreview.letterImageData} alt="Letter" className="w-full rounded-[18px]" />
          </div>
          <div className="absolute inset-x-10 bottom-6 z-20 animate-fade-in">
            <img src={sendPreview.envelopeImageData} alt="Envelope" className="mx-auto w-full max-w-2xl" />
          </div>
          <div className="absolute right-[16%] top-[20%] z-30 animate-mail-stamp-pop rounded-[18px] bg-white/80 p-1 shadow-lg">
            {sendPreview.stampImageData ? (
              <img src={sendPreview.stampImageData} alt="Stamp" className="h-20 w-16 rounded-[14px] object-cover" />
            ) : (
              <div className="flex h-20 w-16 items-center justify-center text-3xl">{sendPreview.stampStyle}</div>
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold" style={{ color: "var(--pink)" }}>Off to {sendPreview.receiverName}</div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The letter slips into the envelope and heads to the mailbox.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      {onBack ? (
        <button
          onClick={onBack}
          className="btn-smooth self-start rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
          style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
        >
          <FiArrowLeft />
          Back to inbox
        </button>
      ) : null}

      <div className="panel p-4">
        <p className="section-title mb-3">Address</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div>
            <label htmlFor="mail-compose-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              From
            </label>
            <div id="mail-compose-from" className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
              {senderName}
            </div>
          </div>
          <div className="flex h-full items-center justify-center pb-2 text-2xl" style={{ color: "var(--muted)" }}>→</div>
          <div>
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
                onBlur={() => globalThis.setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Recipient name..."
                maxLength={30}
                autoComplete="off"
                className="input-soft w-full px-3 py-2 text-sm outline-none"
              />
              {showSuggestions && filteredSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border shadow-xl" style={{ background: "var(--glass)", borderColor: "var(--border-strong)", backdropFilter: "blur(12px)" }}>
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
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
                        {username[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium">{username}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel overflow-hidden p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-title">Mail Studio</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Decorate both the letter and its envelope before you send it.
              </p>
            </div>
            <div className="flex rounded-2xl p-1" style={{ background: "var(--surface)" }}>
              {(["letter", "envelope"] as const).map((surface) => {
                const active = activeSurface === surface;
                return (
                  <button
                    key={surface}
                    onClick={() => setActiveSurface(surface)}
                    className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: active ? "rgba(255,107,157,0.14)" : "transparent",
                      color: active ? "var(--pink)" : "var(--muted)",
                    }}
                  >
                    {surface === "letter" ? "Letter" : "Envelope"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: "var(--border)", height: "clamp(320px, 62vh, 720px)", background: "rgba(255,255,255,0.8)" }}>
            <div style={{ display: activeSurface === "letter" ? "block" : "none", height: "100%" }}>
              <DrawingCanvas
                ref={letterCanvasRef}
                brushSettings={brushSettings}
                placedItems={letterPlacedItems}
                selectedAsset={selectedAsset}
                selectedPaper={selectedPaper}
                customFonts={customFonts}
                onPlaceAsset={placeItem}
                onAddTextItem={placeTextItem}
                onUpdatePlacedItem={updatePlacedItem}
                width={1200}
                height={900}
                fillContainer
              />
            </div>
            <div style={{ display: activeSurface === "envelope" ? "block" : "none", height: "100%" }}>
              <DrawingCanvas
                ref={envelopeCanvasRef}
                brushSettings={brushSettings}
                placedItems={envelopePlacedItems}
                selectedAsset={selectedAsset}
                selectedPaper={selectedEnvelope}
                customFonts={customFonts}
                onPlaceAsset={placeItem}
                onAddTextItem={placeTextItem}
                onUpdatePlacedItem={updatePlacedItem}
                width={1200}
                height={900}
                fillContainer
                backgroundMode="cover"
              />
              {receiver.trim() ? (
                <div className="pointer-events-none absolute inset-x-[24%] top-[46%] z-30 rounded-2xl border px-6 py-4 text-center text-2xl font-semibold shadow-sm" style={{ borderColor: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.72)", color: "#5f5168", backdropFilter: "blur(8px)" }}>
                  {receiver.trim()}
                </div>
              ) : null}
              <div className="pointer-events-none absolute right-8 top-8 z-30 rounded-[18px] bg-white/70 p-1 shadow-md">
                {selectedStamp?.imageData ? (
                  <img src={selectedStamp.imageData} alt={selectedStamp.name} className="h-24 w-20 rounded-[14px] object-cover" />
                ) : (
                  <div className="flex h-24 w-20 items-center justify-center rounded-[14px] bg-white text-4xl">{stampStyle}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="panel flex flex-col overflow-hidden p-3" style={{ minHeight: 520 }}>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { id: "stickers", label: "Assets" },
              { id: "paper", label: activeSurface === "letter" ? "Paper" : "Envelope" },
              { id: "stamps", label: "Stamp" },
              { id: "gifs", label: "GIFs" },
              { id: "create", label: "Create" },
            ].map((section) => {
              const active = toolDrawer === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setToolDrawer(section.id as ToolDrawer)}
                  className="btn-smooth rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ background: active ? "rgba(167,139,250,0.18)" : "var(--surface)", color: active ? "var(--lavender)" : "var(--muted)" }}
                >
                  {section.label}
                </button>
              );
            })}
          </div>

          <div className="mb-3 grid grid-cols-4 gap-2">
            {(["pen", "eraser", "select", "text"] as const).map((tool) => {
              const active = brushSettings.tool === tool;
              const toolIcons: Record<"pen" | "eraser" | "select" | "text", React.ReactNode> = {
                pen: <FiPenTool />,
                eraser: <FiTrash2 />,
                select: <FiMove />,
                text: <FiType />,
              };
              const toolLabels: Record<"pen" | "eraser" | "select" | "text", string> = {
                pen: "Pen",
                eraser: "Erase",
                select: "Select",
                text: "Text",
              };
              return (
                <button
                  key={tool}
                  onClick={() => setBrushSettings((prev) => ({ ...prev, tool }))}
                  className="btn-smooth rounded-2xl px-2 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1"
                  style={{ background: active ? "rgba(255,107,157,0.14)" : "var(--surface)", color: active ? "var(--pink)" : "var(--muted-strong)" }}
                  aria-label={tool}
                >
                  {toolIcons[tool]}
                  {toolLabels[tool]}
                </button>
              );
            })}
          </div>

          <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.65)" }}>
            <button onClick={() => colorInputRef.current?.click()} className="btn-smooth flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "rgba(0,0,0,0.08)", background: brushSettings.color }} aria-label="Brush color" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Colour & size</div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>{brushSettings.tool === "text" ? `${brushSettings.textSize ?? 32}px text` : `${brushSettings.size}px brush`}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => brushSettings.tool === "text" ? setBrushSettings((prev) => ({ ...prev, textSize: Math.min(96, (prev.textSize ?? 32) + 2) })) : setBrushSettings((prev) => ({ ...prev, size: Math.min(40, prev.size + 1) }))} className="btn-smooth rounded-lg px-2 py-1 text-xs" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>+</button>
              <button onClick={() => brushSettings.tool === "text" ? setBrushSettings((prev) => ({ ...prev, textSize: Math.max(10, (prev.textSize ?? 32) - 2) })) : setBrushSettings((prev) => ({ ...prev, size: Math.max(1, prev.size - 1) }))} className="btn-smooth rounded-lg px-2 py-1 text-xs" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>−</button>
            </div>
            <input ref={colorInputRef} type="color" value={brushSettings.color} onChange={(e) => setBrushSettings((prev) => ({ ...prev, color: e.target.value }))} className="sr-only" tabIndex={-1} aria-label="Brush colour" />
          </div>

          <div className="mb-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.65)" }}>
            <label htmlFor="mail-text-font" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Text Font
            </label>
            <select
              id="mail-text-font"
              value={brushSettings.textFont}
              onChange={(e) => setBrushSettings((prev) => ({ ...prev, textFont: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {activeFontOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PASTEL_COLORS.slice(0, 8).map((color) => (
                <button key={color} onClick={() => setBrushSettings((prev) => ({ ...prev, color }))} className="h-5 w-5 rounded-full border border-white/60" style={{ background: color }} aria-label={`Select ${color}`} />
              ))}
            </div>
          </div>

          <div className="overflow-y-auto pr-1" style={{ maxHeight: 400 }}>
            {toolDrawer === "stickers" ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Stickers</p>
                  <div className="grid grid-cols-4 gap-2">
                    {stickers.map((sticker) => (
                      <div key={sticker.id} className="group relative">
                        <button onClick={() => handleSelectSticker(sticker)} className="btn-smooth aspect-square overflow-hidden rounded-2xl border" style={{ borderColor: selectedAsset?.id === sticker.id ? "rgba(255,107,157,0.45)" : "var(--border)", background: "rgba(255,255,255,0.8)" }}>
                          <img src={sticker.imageData} alt={sticker.name} className="h-full w-full object-contain" />
                        </button>
                        {stickers.length > 1 ? (
                          <button onClick={() => onDeleteSticker(sticker.id)} className="btn-smooth absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.92)", color: "#d63384" }}>✕</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Washi tape</p>
                  <div className="space-y-2">
                    {washiTapes.map((washi) => (
                      <div key={washi.id} className="group relative">
                        <button onClick={() => handleSelectWashi(washi)} className="btn-smooth h-12 w-full overflow-hidden rounded-2xl border" style={{ borderColor: selectedAsset?.id === washi.id ? "rgba(255,107,157,0.45)" : "var(--border)", background: "rgba(255,255,255,0.8)" }}>
                          <img src={washi.imageData} alt={washi.name} className="h-full w-full object-cover" style={{ opacity: washi.opacity }} />
                        </button>
                        {washiTapes.length > 1 ? (
                          <button onClick={() => onDeleteWashi(washi.id)} className="btn-smooth absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.92)", color: "#d63384" }}>✕</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {toolDrawer === "paper" ? (
              <div className="space-y-3">
                {activeSurface === "letter" ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Letter papers</p>
                    <div className="grid grid-cols-2 gap-2">
                      {papers.map((paper) => (
                        <div key={paper.id} className="group relative">
                          <button onClick={() => setSelectedPaper(paper)} className="btn-smooth overflow-hidden rounded-2xl border" style={{ borderColor: selectedPaper?.id === paper.id ? "rgba(255,107,157,0.45)" : "var(--border)" }}>
                            <img src={paper.imageData} alt={paper.name} className="aspect-[4/3] w-full object-cover" />
                          </button>
                          <div className="mt-1 truncate text-[11px] font-medium">{paper.name}</div>
                          {papers.length > 1 ? (
                            <button onClick={() => onDeletePaper(paper.id)} className="btn-smooth absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.92)", color: "#d63384" }}>✕</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Envelope styles</p>
                    <div className="space-y-2">
                      {envelopes.map((envelope) => (
                        <div key={envelope.id} className="group relative">
                          <button onClick={() => setSelectedEnvelope(envelope)} className="btn-smooth overflow-hidden rounded-2xl border" style={{ borderColor: selectedEnvelope?.id === envelope.id ? "rgba(255,107,157,0.45)" : "var(--border)" }}>
                            <img src={envelope.imageData} alt={envelope.name} className="aspect-[4/3] w-full object-cover" />
                          </button>
                          <div className="mt-1 truncate text-[11px] font-medium">{envelope.name}</div>
                          {envelopes.length > 1 ? (
                            <button onClick={() => onDeleteEnvelope(envelope.id)} className="btn-smooth absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.92)", color: "#d63384" }}>✕</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {toolDrawer === "stamps" ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Stamp image</p>
                  <div className="grid grid-cols-3 gap-2">
                    {stamps.map((stamp) => (
                      <div key={stamp.id} className="group relative">
                        <button onClick={() => setSelectedStamp(stamp)} className="btn-smooth overflow-hidden rounded-2xl border bg-white" style={{ borderColor: selectedStamp?.id === stamp.id ? "rgba(255,107,157,0.45)" : "var(--border)" }}>
                          <img src={stamp.imageData} alt={stamp.name} className="aspect-[7/8] w-full object-cover" />
                        </button>
                        {stamps.length > 1 ? (
                          <button onClick={() => onDeleteStamp(stamp.id)} className="btn-smooth absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.92)", color: "#d63384" }}>✕</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Stamp emoji</p>
                  <div className="flex flex-wrap gap-2">
                    {STAMP_STYLES.map((value) => (
                      <button key={value} onClick={() => setStampStyle(value)} className="btn-smooth flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: stampStyle === value ? "rgba(255,107,157,0.15)" : "var(--surface)", border: stampStyle === value ? "1px solid rgba(255,107,157,0.3)" : "1px solid var(--border)" }}>{value}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {toolDrawer === "gifs" ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Search GIFs</p>
                  <div className="flex gap-2">
                    <input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="cute post office" className="input-soft min-w-0 flex-1 px-3 py-2 text-xs outline-none" />
                    <button onClick={() => void searchGifs()} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "var(--pink)" }}>Search</button>
                  </div>
                </div>
                {gifLoading ? <div className="text-xs" style={{ color: "var(--muted)" }}>Loading GIFs...</div> : null}
                {gifError ? <div className="text-xs" style={{ color: "#d63384" }}>{gifError}</div> : null}
                <div className="grid grid-cols-2 gap-2">
                  {gifResults.map((result) => (
                    <button key={result.id} onClick={() => void addGifAsset(result.gifUrl, result.title)} className="btn-smooth overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
                      <img src={result.previewUrl} alt={result.title} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {toolDrawer === "create" ? (
              <div className="space-y-3">
                <StickerCreator onSave={onSaveSticker} />
                <WashiTapeCreator onSave={onSaveWashi} />
                <MailAssetCreator buttonLabel="📝 Create Paper" title="Paper Creator" accent="#67d4f1" width={360} height={240} placeholder="Paper name..." helperText="Draw a new paper design to use in letters and publish in the shop." onSave={onSavePaper} />
                <MailAssetCreator buttonLabel="📮 Create Envelope" title="Envelope Creator" accent="#ffb347" width={420} height={260} placeholder="Envelope name..." helperText="Design the envelope base that your letter will slide into." onSave={onSaveEnvelope} />
                <MailAssetCreator buttonLabel="📬 Create Stamp" title="Stamp Creator" accent="#ff6b9d" width={160} height={180} placeholder="Stamp name..." helperText="Draw a custom postage stamp for outgoing mail." onSave={onSaveStamp} />
                <FontTracerCreator onSave={onSaveCustomFont} />
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => activeCanvasRef.current?.undo()} aria-label="Undo" className="btn-smooth rounded-xl py-2 text-xs font-semibold inline-flex items-center justify-center gap-1" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}><FiRotateCcw /> Undo</button>
            <button onClick={() => activeCanvasRef.current?.redo()} aria-label="Redo" className="btn-smooth rounded-xl py-2 text-xs font-semibold inline-flex items-center justify-center gap-1" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}><FiRotateCw /> Redo</button>
            <button onClick={clearActiveSurface} aria-label="Clear" className="btn-smooth rounded-xl py-2 text-xs font-semibold inline-flex items-center justify-center gap-1" style={{ background: "rgba(255,107,157,0.12)", color: "#d63384" }}><FiTrash2 /> Clear</button>
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1" style={{ color: "var(--muted)" }}><FiClock /> Delivery</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {DELIVERY_SPEEDS.map((option) => (
                <button key={option.id} onClick={() => setSpeed(option.id)} className="btn-smooth rounded-2xl p-3 text-left" style={{ background: speed === option.id ? "rgba(167,139,250,0.14)" : "var(--surface)", border: speed === option.id ? "1px solid rgba(167,139,250,0.3)" : "1px solid var(--border)" }}>
                  <div className="text-xl">{option.emoji}</div>
                  <div className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>{option.description}</div>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => void handleSend()} disabled={!receiver.trim()} className="btn-smooth rounded-2xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-40 inline-flex items-center gap-2" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            {stampStyle} <FiSend /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
