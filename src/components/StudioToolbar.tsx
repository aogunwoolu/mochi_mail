"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrushSettings, CustomFont, PASTEL_COLORS, PaperBackground, Sticker, WashiTape } from "@/types";
import StudioAssetDrawer, { type DrawerSection, type GifSearchResult, getSwatchShadow } from "./StudioAssetDrawer";

// ── GIF search ────────────────────────────────────────────────────────────────

const GIF_SEARCH_URL = "/api/gifs/search";

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") { const n = Number(value); if (Number.isFinite(n)) return n; }
  return fallback;
}

function normalizeGifResults(payload: unknown): GifSearchResult[] {
  const data = (payload as { data?: unknown[]; results?: unknown[] })?.data
    ?? (payload as { data?: unknown[]; results?: unknown[] })?.results
    ?? [];
  if (!Array.isArray(data)) return [];

  return data.map((entry, index) => {
    const item = entry as {
      id?: string; title?: string; content_description?: string; url?: string;
      images?: { fixed_width?: { url?: string; width?: string | number; height?: string | number }; downsized_medium?: { url?: string }; original?: { url?: string; width?: string | number; height?: string | number } };
      media_formats?: { gif?: { url?: string; dims?: number[] }; tinygif?: { url?: string; dims?: number[] }; nanogif?: { url?: string; dims?: number[] } };
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
  }).filter((item): item is GifSearchResult => item !== null);
}

// ── Toolbar customization ─────────────────────────────────────────────────────

type ToolbarControlId = "pen" | "select" | "text" | "eraser" | "drawer" | "undo" | "redo" | "export";
type ToolbarControl = { id: ToolbarControlId; label: string; enabled: boolean };

const DEFAULT_TOOLBAR_CONTROLS: ToolbarControl[] = [
  { id: "pen", label: "Pen", enabled: true },
  { id: "select", label: "Select", enabled: true },
  { id: "text", label: "Text", enabled: true },
  { id: "eraser", label: "Eraser", enabled: true },
  { id: "drawer", label: "Assets", enabled: true },
  { id: "undo", label: "Undo", enabled: true },
  { id: "redo", label: "Redo", enabled: true },
  { id: "export", label: "Export", enabled: true },
];

function normalizeToolbarControls(value: unknown): ToolbarControl[] {
  if (!Array.isArray(value)) return DEFAULT_TOOLBAR_CONTROLS;
  const map = new Map(DEFAULT_TOOLBAR_CONTROLS.map((c) => [c.id, { ...c }]));
  const ordered: ToolbarControl[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    const enabled = (item as { enabled?: unknown }).enabled;
    if (typeof id !== "string" || !map.has(id as ToolbarControlId)) continue;
    const fallback = map.get(id as ToolbarControlId)!;
    ordered.push({ ...fallback, enabled: typeof enabled === "boolean" ? enabled : fallback.enabled });
    map.delete(id as ToolbarControlId);
  }
  for (const c of map.values()) ordered.push(c);
  return ordered;
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

type Collaborator = { id: string; name: string; color: string; avatarUrl?: string; username?: string };

function RoundIconButton({ active = false, onClick, title, label, children }: Readonly<{ active?: boolean; onClick: () => void; title: string; label?: string; children: React.ReactNode }>) {
  return (
    <button onClick={onClick} className="btn-smooth flex flex-col items-center gap-0.5 px-1 py-1" title={title}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: active ? "rgba(255,107,157,0.15)" : "rgba(255,255,255,0.7)", border: active ? "1.5px solid rgba(255,107,157,0.45)" : "1.5px solid rgba(0,0,0,0.07)" }}>
        {children}
      </span>
      {label ? <span className="text-[9px] font-medium leading-tight" style={{ color: active ? "var(--pink)" : "var(--muted)" }}>{label}</span> : null}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StudioToolbarProps {
  brushSettings: BrushSettings;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  onSelectSticker: (s: Sticker) => void;
  onSelectWashi: (w: WashiTape) => void;
  onSelectPaper: (p: PaperBackground) => void;
  onDeselectAsset: () => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
  onDeletePaper: (id: string) => void;
  onDeleteCustomFont: (id: string) => void;
  onSaveSticker: (name: string, imageData: string, w: number, h: number, isAnimated?: boolean) => void;
  onSaveWashi: (name: string, imageData: string, opacity: number, w: number, h: number) => void;
  onSaveCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  collaborators: Collaborator[];
  selfCollaboratorId: string;
  onJumpToCollaborator: (artistId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioToolbar({
  brushSettings, onBrushChange, onUndo, onRedo, onClear, onExport,
  stickers, washiTapes, papers, customFonts, selectedAsset, selectedPaper,
  onSelectSticker, onSelectWashi, onSelectPaper, onDeselectAsset,
  onDeleteSticker, onDeleteWashi, onDeletePaper, onDeleteCustomFont,
  onSaveSticker, onSaveWashi, onSaveCustomFont,
  collaborators, selfCollaboratorId, onJumpToCollaborator,
}: Readonly<StudioToolbarProps>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>("assets");
  const [gifQuery, setGifQuery] = useState("cute sticker");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifUrlInput, setGifUrlInput] = useState("");
  const [customColor, setCustomColor] = useState(brushSettings.color);
  const [assetSearch, setAssetSearch] = useState("");
  const [toolbarControls, setToolbarControls] = useState<ToolbarControl[]>(DEFAULT_TOOLBAR_CONTROLS);
  const [userPalette, setUserPalette] = useState<string[]>([PASTEL_COLORS[2], PASTEL_COLORS[3], PASTEL_COLORS[4], PASTEL_COLORS[8]]);

  useEffect(() => { setCustomColor(brushSettings.color); }, [brushSettings.color]);

  // Persist toolbar layout to localStorage
  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_toolbar_controls");
      if (raw) setToolbarControls(normalizeToolbarControls(JSON.parse(raw)));
    } catch { setToolbarControls(DEFAULT_TOOLBAR_CONTROLS); }
  }, []);
  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_toolbar_controls", JSON.stringify(toolbarControls));
  }, [toolbarControls]);

  // Persist custom color palette to localStorage
  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_left_palette");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.filter((c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 4);
      if (normalized.length === 4) setUserPalette(normalized as string[]);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_left_palette", JSON.stringify(userPalette));
  }, [userPalette]);

  const colorChoices = useMemo(() => PASTEL_COLORS.slice(0, 10), []);
  const selectedTextFont = brushSettings.textFont ?? '"Space Mono", monospace';
  const selectedTextSize = brushSettings.textSize ?? 34;
  const assetCount = stickers.length + washiTapes.length + papers.length;

  // GIF helpers
  const addGifAsset = useCallback((src: string, title?: string) => {
    const trimmed = src.trim();
    if (!trimmed) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxEdge = 220;
      const ratio = img.width / img.height;
      const w = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const h = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;
      onSaveSticker(title?.trim() || "Animated Sticker", trimmed, w, h, true);
      setActiveSection("assets");
    };
    img.onerror = () => setGifError("Could not load this GIF. Try another result or URL.");
    img.src = trimmed;
  }, [onSaveSticker]);

  const addGifFromUrl = useCallback(() => {
    if (!gifUrlInput.trim()) return;
    setGifError(null);
    addGifAsset(gifUrlInput, "Imported GIF");
    setGifUrlInput("");
  }, [addGifAsset, gifUrlInput]);

  const addGifFromResult = useCallback((result: GifSearchResult) => {
    setGifError(null);
    addGifAsset(result.gifUrl, result.title || "GIF");
  }, [addGifAsset]);

  const searchGifs = useCallback(async () => {
    const q = gifQuery.trim();
    if (!q) { setGifResults([]); return; }
    setGifLoading(true);
    setGifError(null);
    try {
      const res = await fetch(`${GIF_SEARCH_URL}?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "search_failed");
      const mapped = normalizeGifResults(json);
      setGifResults(mapped);
      if (mapped.length === 0) setGifError("No GIFs found. Try a different search term.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      if (code === "missing_gifapi_key") setGifError("GIFAPI_KEY not set on the server.");
      else if (code === "missing_giphy_key") setGifError("GIPHY_API_KEY not set on the server.");
      else setGifError("GIF search failed.");
    } finally {
      setGifLoading(false);
    }
  }, [gifQuery]);

  useEffect(() => {
    if (activeSection !== "extras") return;
    if (gifResults.length > 0 || gifLoading) return;
    void searchGifs();
  }, [activeSection, gifResults.length, gifLoading, searchGifs]);

  // Scrapbook pack: 3 canvas-drawn sticker shapes
  const addScrapbookPack = useCallback(() => {
    const make = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      draw(ctx);
      return canvas.toDataURL("image/png");
    };
    const polaroid = make(240, 280, (ctx) => {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 240, 280);
      ctx.fillStyle = "#f6f1ff"; ctx.fillRect(18, 18, 204, 188);
      ctx.strokeStyle = "rgba(167,139,250,0.45)"; ctx.lineWidth = 2; ctx.strokeRect(18, 18, 204, 188);
      ctx.fillStyle = "rgba(255,107,157,0.28)"; ctx.fillRect(16, 216, 208, 42);
    });
    const ticket = make(260, 120, (ctx) => {
      ctx.fillStyle = "#fff8e8"; ctx.fillRect(0, 0, 260, 120);
      ctx.fillStyle = "rgba(251,146,60,0.3)"; ctx.fillRect(0, 84, 260, 36);
      ctx.fillStyle = "#d97706"; ctx.font = '700 24px "Space Mono", monospace'; ctx.fillText("MEMORIES", 28, 70);
    });
    const label = make(190, 70, (ctx) => {
      ctx.fillStyle = "#fdf2f8"; ctx.fillRect(0, 0, 190, 70);
      ctx.strokeStyle = "rgba(244,114,182,0.5)"; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 178, 58);
      ctx.fillStyle = "#be185d"; ctx.font = '700 20px "Space Mono", monospace'; ctx.fillText("NOTES", 56, 44);
    });
    if (polaroid) onSaveSticker("Polaroid Frame", polaroid, 240, 280);
    if (ticket) onSaveSticker("Ticket Stub", ticket, 260, 120);
    if (label) onSaveSticker("Label Tag", label, 190, 70);
  }, [onSaveSticker]);

  const setTool = useCallback((tool: BrushSettings["tool"]) => {
    onBrushChange({ tool });
    if (["pen", "eraser", "text", "select"].includes(tool)) onDeselectAsset();
  }, [onBrushChange, onDeselectAsset]);

  const moveControl = useCallback((id: ToolbarControlId, dir: -1 | 1) => {
    setToolbarControls((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      if (i === -1 || i + dir < 0 || i + dir >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(i + dir, 0, item);
      return next;
    });
  }, []);

  const toggleControl = useCallback((id: ToolbarControlId) => {
    setToolbarControls((prev) => {
      const enabledCount = prev.filter((c) => c.enabled).length;
      return prev.map((c) => c.id !== id ? c : c.enabled && enabledCount <= 1 ? c : { ...c, enabled: !c.enabled });
    });
  }, []);

  const isStickerActive = brushSettings.tool === "sticker" && selectedAsset !== null;
  const isWashiActive = brushSettings.tool === "washi" && selectedAsset !== null;
  const activeControls = toolbarControls.filter((c) => c.enabled);
  const shownCollaborators = collaborators.slice(0, 5);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Asset drawer */}
      {drawerOpen && (
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-40 max-h-[72vh] overflow-y-auto">
          <StudioAssetDrawer
            assetCount={assetCount} activeSection={activeSection}
            stickers={stickers} washiTapes={washiTapes} papers={papers} customFonts={customFonts}
            selectedAsset={selectedAsset} selectedPaper={selectedPaper}
            brushSettings={brushSettings} selectedTextFont={selectedTextFont} selectedTextSize={selectedTextSize}
            customColor={customColor} colorChoices={colorChoices}
            gifQuery={gifQuery} gifResults={gifResults} gifLoading={gifLoading} gifError={gifError} gifUrlInput={gifUrlInput}
            assetSearch={assetSearch}
            onClose={() => setDrawerOpen(false)} onSelectSection={setActiveSection}
            onSelectSticker={onSelectSticker} onSelectWashi={onSelectWashi} onSelectPaper={onSelectPaper} onDeselectAsset={onDeselectAsset}
            onDeleteSticker={onDeleteSticker} onDeleteWashi={onDeleteWashi} onDeletePaper={onDeletePaper} onDeleteCustomFont={onDeleteCustomFont}
            onSaveSticker={onSaveSticker} onSaveWashi={onSaveWashi} onSaveCustomFont={onSaveCustomFont}
            onBrushChange={onBrushChange} onClear={onClear}
            setCustomColor={setCustomColor} setGifQuery={setGifQuery} searchGifs={searchGifs}
            addGifFromResult={addGifFromResult} setGifUrlInput={setGifUrlInput} addGifFromUrl={addGifFromUrl}
            addScrapbookPack={addScrapbookPack} setAssetSearch={setAssetSearch}
          />
        </div>
      )}

      {/* Toolbar customization popover */}
      {customizeOpen && (
        <div className="pointer-events-auto absolute left-20 top-1/2 z-40 w-72 -translate-y-1/2 rounded-2xl border p-3" style={{ background: "var(--surface-active)", borderColor: "var(--border-strong)", boxShadow: "0 10px 28px rgba(0,0,0,0.16)" }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Customize Toolbar</p>
            <button onClick={() => setCustomizeOpen(false)} className="btn-smooth rounded-lg px-2 py-1 text-[10px]" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>Close</button>
          </div>
          <div className="space-y-2">
            {toolbarControls.map((control, index) => (
              <div key={control.id} className="flex items-center gap-2 rounded-xl border px-2 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <input type="checkbox" checked={control.enabled} onChange={() => toggleControl(control.id)} aria-label={`Toggle ${control.label}`} />
                <span className="flex-1 text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>{control.label}</span>
                <button onClick={() => moveControl(control.id, -1)} disabled={index === 0} className="btn-smooth rounded-lg px-2 py-1 text-[10px]" style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}>Up</button>
                <button onClick={() => moveControl(control.id, 1)} disabled={index === toolbarControls.length - 1} className="btn-smooth rounded-lg px-2 py-1 text-[10px]" style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}>Down</button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Left Menu Colors</p>
            <div className="grid grid-cols-4 gap-2">
              {userPalette.map((color, i) => (
                <label key={`${color}-${i}`} className="flex flex-col items-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  <input type="color" value={color} onChange={(e) => setUserPalette((prev) => prev.map((c, idx) => idx === i ? e.target.value : c))} className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                  {i + 1}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left tool palette */}
      <div className="pointer-events-auto absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 px-2 py-2.5 sm:left-4" style={{ background: "rgba(255,255,255,0.94)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)" }}>
        {activeControls.map((control) => {
          if (control.id === "pen") return (
            <RoundIconButton key="pen" active={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive} onClick={() => setTool("pen")} title="Pen" label="Pen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </RoundIconButton>
          );
          if (control.id === "text") return (
            <RoundIconButton key="text" active={brushSettings.tool === "text"} onClick={() => setTool("text")} title="Text" label="Text">
              <span className="text-sm font-bold" style={{ fontFamily: '"Space Mono", monospace', color: "#444" }}>T</span>
            </RoundIconButton>
          );
          if (control.id === "select") return (
            <RoundIconButton key="select" active={brushSettings.tool === "select"} onClick={() => setTool("select")} title="Select" label="Select">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 2v15.5l3.5-3.1 2 3.9 1.8-0.9-2-3.9H17L6 2z" stroke="#444" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </RoundIconButton>
          );
          if (control.id === "eraser") return (
            <RoundIconButton key="eraser" active={brushSettings.tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser" label="Erase">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 17l4-4" stroke="#444" strokeWidth="2" strokeLinecap="round" /></svg>
            </RoundIconButton>
          );
          if (control.id === "drawer") return (
            <RoundIconButton key="drawer" active={drawerOpen} onClick={() => setDrawerOpen((p) => !p)} title="Open Studio" label="Studio">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" /></svg>
            </RoundIconButton>
          );
          return null;
        })}

        <div className="w-full" style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "2px 0" }} />

        {userPalette.map((color) => {
          const selected = brushSettings.color === color;
          return (
            <button key={color} onClick={() => { onBrushChange({ color, tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool }); onDeselectAsset(); }} className="btn-smooth rounded-full" style={{ width: 26, height: 26, background: color, boxShadow: getSwatchShadow(selected, color) }} title={color} />
          );
        })}

        <div className="w-full" style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "2px 0" }} />

        <RoundIconButton active={customizeOpen} onClick={() => setCustomizeOpen((p) => !p)} title="Customize toolbar" label="More">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z" stroke="#444" strokeWidth="2" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.2 1.2 0 1 1-2.4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.2 1.2 0 1 1 0-2.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.2 1.2 0 1 1 2.4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.2 1.2 0 1 1 0 2.4h-.2a1 1 0 0 0-.9.6z" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </RoundIconButton>
      </div>

      {/* Collaborator avatars (top right) */}
      <div className="pointer-events-auto absolute z-30 flex gap-2" style={{ right: "calc(1rem + env(safe-area-inset-right, 0px))", top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        {shownCollaborators.map((artist) => {
          const isSelf = artist.id === selfCollaboratorId;
          const initials = artist.name.split(" ").map((p) => p.charAt(0).toUpperCase()).join("").slice(0, 2) || "?";
          const hasSpace = !isSelf && Boolean(artist.username);
          const avatar = (
            <span className="relative flex items-center justify-center overflow-hidden rounded-full" style={{ width: 38, height: 38, background: "linear-gradient(135deg, #e8e0f0, #d1c4f8)", border: `3px solid ${artist.color}`, boxShadow: "0 3px 10px rgba(0,0,0,0.14)", flexShrink: 0 }}>
              {artist.avatarUrl ? <img src={artist.avatarUrl} alt={artist.name} className="h-full w-full object-cover" /> : <span className="text-[11px] font-bold" style={{ color: "#6b4fa8" }}>{initials}</span>}
              {isSelf && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e", border: "2px solid white" }} />}
            </span>
          );
          return (
            <div key={artist.id} className="group relative flex flex-col items-center">
              {hasSpace ? (
                <a href={`/space/${artist.username}`} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); onJumpToCollaborator(artist.id); window.open(`/space/${artist.username}`, "_blank"); }} className="btn-smooth" aria-label={`${artist.name}'s space`}>{avatar}</a>
              ) : (
                <button onClick={() => onJumpToCollaborator(artist.id)} className="btn-smooth" aria-label={isSelf ? `${artist.name} (you)` : `Jump to ${artist.name}`}>{avatar}</button>
              )}
              <div className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold opacity-0 shadow-lg transition-opacity group-hover:opacity-100" style={{ background: "rgba(255,255,255,0.96)", color: "var(--foreground)", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                {isSelf ? `${artist.name} (you)` : artist.name}
                {hasSpace && <span className="ml-1 text-[10px]" style={{ color: "var(--purple)" }}>· visit space ↗</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Undo / Redo / Export (bottom right) */}
      <div className="pointer-events-auto absolute z-30 flex flex-col gap-2.5" style={{ right: "calc(1rem + env(safe-area-inset-right, 0px))", bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        {toolbarControls.some((c) => c.id === "undo" && c.enabled) && (
          <button onClick={onUndo} className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }} title="Undo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7h10a6 6 0 0 1 0 12H9" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 7l4-4M3 7l4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        {toolbarControls.some((c) => c.id === "redo" && c.enabled) && (
          <button onClick={onRedo} className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }} title="Redo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 7H11a6 6 0 0 0 0 12h4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 7l-4-4M21 7l-4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        {toolbarControls.some((c) => c.id === "export" && c.enabled) && (
          <button onClick={onExport} className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--pink)", boxShadow: "0 4px 14px rgba(255,107,157,0.4)" }} title="Export PNG">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v13" stroke="white" strokeWidth="2" strokeLinecap="round" /><path d="M8 12l4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 20h18" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
