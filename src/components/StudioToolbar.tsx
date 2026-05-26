
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrushSettings, CustomFont, PASTEL_COLORS, PaperBackground, ScrapbookKit, ScrapbookKitElement, Sticker, StoreItem, ViewerIdentity, WashiTape } from "@/types";
import StudioAssetDrawer, { type DrawerSection, type GifSearchResult } from "./StudioAssetDrawer";
import { toast } from "@/lib/toast";




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

// ── Built-in font options ─────────────────────────────────────────────────────

const BUILT_IN_FONTS: { label: string; preview: string; value: string }[] = [
  { label: "Mono",       preview: "Aa", value: '"Space Mono", monospace' },
  { label: "Serif",      preview: "Aa", value: "Georgia, serif" },
  { label: "Sans",       preview: "Aa", value: "Arial, sans-serif" },
  { label: "Playful",   preview: "Aa", value: '"Comic Sans MS", cursive' },
  { label: "Type",       preview: "Aa", value: '"Courier New", monospace' },
];

const TEXT_SIZES: { label: string; value: number; display: number }[] = [
  { label: "Small",  value: 14, display: 11 },
  { label: "Medium", value: 24, display: 15 },
  { label: "Large",  value: 36, display: 20 },
  { label: "XL",     value: 52, display: 26 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Collaborator = { id: string; name: string; color: string; avatarUrl?: string; username?: string };

interface StudioToolbarProps {
  brushSettings: BrushSettings;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  isExporting?: boolean;
  triggerOpenAssets?: number;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  kitLibrary: ScrapbookKit[];
  storeItems: StoreItem[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  viewer: ViewerIdentity;
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
  onAddKitToLibrary: (kit: ScrapbookKit) => void;
  onRemoveKit: (id: string) => void;
  onPublishKit: (kit: ScrapbookKit, publishToShop: boolean) => void;
  collaborators: Collaborator[];
  selfCollaboratorId: string;
  onJumpToCollaborator: (artistId: string) => void;
  onOpenOwnProfile: () => void;
}

// ── Tool button ───────────────────────────────────────────────────────────────

function ToolBtn({
  active = false,
  onClick,
  title,
  label,
  children,
}: Readonly<{
  active?: boolean;
  onClick: () => void;
  title: string;
  label?: string;
  children: React.ReactNode;
}>) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="btn-smooth flex flex-col items-center gap-1"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className="flex items-center justify-center rounded-2xl transition-all"
        style={{
          width: 44,
          height: 44,
          background: active
            ? "linear-gradient(135deg, rgba(255,107,157,0.18), rgba(167,139,250,0.15))"
            : "transparent",
          border: active
            ? "1.5px solid rgba(255,107,157,0.4)"
            : "1.5px solid transparent",
          boxShadow: active ? "0 2px 8px rgba(255,107,157,0.15)" : "none",
        }}
      >
        {children}
      </span>
      {label ? (
        <span
          className="text-[9px] font-semibold leading-none tracking-wide"
          style={{ color: active ? "var(--pink)" : "var(--muted)" }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      className="w-8 shrink-0 self-center"
      style={{ height: 1, background: "rgba(186,156,214,0.25)" }}
    />
  );
}

// ── Collaborator Avatars ───────────────────────────────────────────────────────

function CollaboratorAvatars({
  collaborators,
  selfCollaboratorId,
  onJumpToCollaborator,
  onOpenOwnProfile,
}: {
  collaborators: Collaborator[];
  selfCollaboratorId: string;
  onJumpToCollaborator: (id: string) => void;
  onOpenOwnProfile: () => void;
}) {
  const [popupId, setPopupId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popupId) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopupId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupId]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto absolute z-30 flex items-center gap-2"
      style={{
        right: "calc(1rem + env(safe-area-inset-right, 0px))",
        top: "calc(1rem + env(safe-area-inset-top, 0px))",
      }}
    >
      {collaborators.map((artist) => {
        const isSelf = artist.id === selfCollaboratorId;
        const initials = artist.name.split(" ").map((p) => p.charAt(0).toUpperCase()).join("").slice(0, 2) || "?";
        const hasSpace = Boolean(artist.username);
        const isPopupOpen = popupId === artist.id;

        const avatarEl = (
          <span
            className="relative flex items-center justify-center overflow-hidden rounded-full"
            style={{
              width: 42,
              height: 42,
              background: "linear-gradient(135deg, #e8e0f0, #d1c4f8)",
              border: `3px solid ${artist.color}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
              flexShrink: 0,
            }}
          >
            <img
              src={artist.avatarUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(artist.name || "guest")}`}
              alt={artist.name}
              className="h-full w-full object-cover"
            />
            {isSelf && (
              <span
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                style={{ background: "#22c55e", border: "2px solid white" }}
              />
            )}
          </span>
        );

        return (
          <div key={artist.id} className="relative flex flex-col items-center">
            <button
              onClick={() => {
                if (isSelf) {
                  onOpenOwnProfile();
                } else {
                  setPopupId(isPopupOpen ? null : artist.id);
                }
              }}
              className="btn-smooth"
              aria-label={isSelf ? "Open your profile" : `View ${artist.name}`}
            >
              {avatarEl}
            </button>

            {/* Self: always show hover tooltip */}
            {isSelf && (
              <div
                className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-semibold opacity-0 shadow-lg transition-opacity hover:opacity-0 group-hover:opacity-0"
                style={{
                  background: "rgba(255,255,255,0.97)",
                  color: "var(--foreground)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}
              >
                {artist.name} (you)
              </div>
            )}

            {/* Other user: click popup with name + space link */}
            {!isSelf && isPopupOpen && (
              <div
                className="absolute top-full mt-2 min-w-[10rem] animate-fade-in rounded-2xl p-3 shadow-xl"
                style={{
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid rgba(0,0,0,0.09)",
                  boxShadow: "0 8px 28px rgba(80,40,120,0.16)",
                  right: 0,
                  zIndex: 50,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                    style={{ background: "linear-gradient(135deg, #e8e0f0, #d1c4f8)", border: `2px solid ${artist.color}` }}
                  >
                    {artist.avatarUrl ? (
                      <img src={artist.avatarUrl} alt={artist.name} className="h-full w-full object-cover" />
                    ) : initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold" style={{ color: "var(--foreground)" }}>{artist.name}</p>
                    {artist.username && (
                      <p className="truncate text-[10px]" style={{ color: "var(--muted)" }}>@{artist.username}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <button
                    onClick={() => { onJumpToCollaborator(artist.id); setPopupId(null); }}
                    className="btn-smooth w-full rounded-xl px-3 py-1.5 text-[11px] font-semibold"
                    style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
                  >
                    Jump to their cursor
                  </button>
                  {hasSpace && (
                    <a
                      href={`/space/${artist.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setPopupId(null)}
                      className="btn-smooth flex w-full items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
                    >
                      Visit their space ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioToolbar({
  brushSettings, onBrushChange, onUndo, onRedo, onClear, onExport, isExporting = false,
  triggerOpenAssets = 0,
  stickers, washiTapes, papers, customFonts, kitLibrary, storeItems,
  selectedAsset, selectedPaper, viewer,
  onSelectSticker, onSelectWashi, onSelectPaper, onDeselectAsset,
  onDeleteSticker, onDeleteWashi, onDeletePaper, onDeleteCustomFont,
  onSaveSticker, onSaveWashi, onSaveCustomFont,
  onAddKitToLibrary, onRemoveKit, onPublishKit,
  collaborators, selfCollaboratorId, onJumpToCollaborator, onOpenOwnProfile,
}: Readonly<StudioToolbarProps>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>("assets");
  const [gifQuery, setGifQuery] = useState("cute sticker");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifUrlInput, setGifUrlInput] = useState("");
  const [customColor, setCustomColor] = useState(brushSettings.color);
  const [assetSearch, setAssetSearch] = useState("");
  const [userPalette, setUserPalette] = useState<string[]>([
    PASTEL_COLORS[0],
    PASTEL_COLORS[2],
    PASTEL_COLORS[4],
    PASTEL_COLORS[8],
    "#1e1e2e",
  ]);
  const paletteInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const longPressTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFeedback = useCallback((msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackMsg(msg);
    feedbackTimerRef.current = setTimeout(() => setFeedbackMsg(null), 2500);
  }, []);

  useEffect(() => { setCustomColor(brushSettings.color); }, [brushSettings.color]);

  useEffect(() => {
    if (triggerOpenAssets > 0) {
      setDrawerOpen(true);
      setActiveSection("assets");
    }
  }, [triggerOpenAssets]);

  // Persist custom palette
  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_left_palette");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c))
        .slice(0, 5);
      if (normalized.length >= 4) setUserPalette(normalized);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_left_palette", JSON.stringify(userPalette));
  }, [userPalette]);

  const colorChoices = useMemo(() => PASTEL_COLORS.slice(0, 10), []);
  const selectedTextFont = brushSettings.textFont ?? '"Space Mono", monospace';
  const selectedTextSize = brushSettings.textSize ?? 36;
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
      else if (code === "rate_limited") setGifError("Too many requests — please wait a moment.");
      else setGifError("GIF search failed.");
    } finally {
      setGifLoading(false);
    }
  }, [gifQuery]);

  useEffect(() => {
    if (activeSection !== "extras") return;
    if (gifResults.length > 0 || gifLoading) return;
    fetch(`${GIF_SEARCH_URL.replace("/search", "/status")}`)
      .then((r) => r.json())
      .then((status: { ready?: boolean; error?: string }) => {
        if (status.ready === false) {
          const code = status.error ?? "unknown";
          if (code === "missing_giphy_key") setGifError("GIPHY_API_KEY is not configured. Add it in Replit Secrets.");
          else if (code === "missing_gifapi_key") setGifError("GIFAPI_KEY is not configured. Add it in Replit Secrets.");
          else setGifError("GIF provider is not configured.");
        } else {
          void searchGifs();
        }
      })
      .catch(() => void searchGifs());
  }, [activeSection, gifResults.length, gifLoading, searchGifs]);

  const addKitElement = useCallback((el: ScrapbookKitElement) => {
    onSaveSticker(el.name, el.imageData, el.width, el.height);
    showFeedback(`"${el.name}" added to your stickers`);
  }, [onSaveSticker, showFeedback]);

  const addKitAll = useCallback((kit: ScrapbookKit) => {
    kit.elements.forEach((el) => onSaveSticker(el.name, el.imageData, el.width, el.height));
    showFeedback(`${kit.elements.length} element${kit.elements.length === 1 ? "" : "s"} from "${kit.name}" added`);
  }, [onSaveSticker, showFeedback]);

  const setTool = useCallback((tool: BrushSettings["tool"]) => {
    onBrushChange({ tool });
    if (["pen", "eraser", "text", "select"].includes(tool)) onDeselectAsset();
  }, [onBrushChange, onDeselectAsset]);

  const isStickerActive = brushSettings.tool === "sticker" && selectedAsset !== null;
  const isWashiActive = brushSettings.tool === "washi" && selectedAsset !== null;
  const shownCollaborators = collaborators.slice(0, 6);

  // Icon SVGs
  const PenIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const TextIcon = (
    <span
      className="text-xl font-bold leading-none"
      style={{ fontFamily: '"Space Mono", monospace', color: brushSettings.tool === "text" ? "var(--pink)" : "#666" }}
    >
      T
    </span>
  );
  const SelectIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 2v15.5l3.5-3.1 2 3.9 1.8-0.9-2-3.9H17L6 2z"
        stroke={brushSettings.tool === "select" ? "var(--pink)" : "#666"}
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const EraserIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"
        stroke={brushSettings.tool === "eraser" ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 17l4-4"
        stroke={brushSettings.tool === "eraser" ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const AssetsIcon = (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
    </svg>
  );
  const UndoIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 7h10a6 6 0 0 1 0 12H9" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7l4-4M3 7l4 4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const RedoIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 7H11a6 6 0 0 0 0 12h4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 7l-4-4M21 7l-4 4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const ExportIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12l4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">

      {/* ── Kit action feedback toast ── */}
      {feedbackMsg && (
        <div
          className="pointer-events-none absolute z-50 animate-mochi-toast"
          style={{ left: 80, bottom: 100 }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-xl"
            style={{
              background: "linear-gradient(135deg, #ff6b9d, #a78bfa)",
              color: "#fff",
              boxShadow: "0 6px 22px rgba(167,139,250,0.42)",
              maxWidth: 280,
            }}
          >
            <span style={{ fontSize: 14 }}>✓</span>
            <span className="truncate">{feedbackMsg}</span>
          </div>
        </div>
      )}

      {/* ── Left toolbar (centered in canvas area above tab bar) ── */}
      <div
        className="pointer-events-none absolute left-3 z-20 flex items-center justify-center"
        style={{ top: "1rem", bottom: "5.5rem" }}
      >
        <div
          className="animate-toolbar-in pointer-events-auto flex flex-col items-center gap-0.5 px-2 py-3"
          style={{
            maxHeight: "100%",
            overflowY: "auto",
            scrollbarWidth: "none",
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 22,
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 8px 32px rgba(143,109,178,0.16), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <ToolBtn
            active={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive}
            onClick={() => setTool("pen")}
            title="Pen"
            label="Pen"
          >
            {PenIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "text"}
            onClick={() => setTool("text")}
            title="Text"
            label="Text"
          >
            {TextIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "select"}
            onClick={() => setTool("select")}
            title="Select / move"
            label="Select"
          >
            {SelectIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "eraser"}
            onClick={() => setTool("eraser")}
            title="Eraser"
            label="Erase"
          >
            {EraserIcon}
          </ToolBtn>

          <Divider />

          <ToolBtn
            active={drawerOpen}
            onClick={() => setDrawerOpen((p) => !p)}
            title="Open studio assets"
            label="Assets"
          >
            {AssetsIcon}
          </ToolBtn>

          <Divider />

          {/* Color swatches — 2-column grid */}
          <div className="grid grid-cols-2 gap-1.5 px-0.5 py-0.5">
            {userPalette.map((color, i) => {
              const selected = brushSettings.color === color;
              return (
                <div key={`swatch-${i}`} className="relative">
                  <button
                    onClick={() => {
                      onBrushChange({
                        color,
                        tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool,
                      });
                      onDeselectAsset();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      paletteInputRefs.current[i]?.click();
                    }}
                    onPointerDown={() => {
                      longPressTimers.current[i] = setTimeout(() => {
                        paletteInputRefs.current[i]?.click();
                      }, 500);
                    }}
                    onPointerUp={() => {
                      if (longPressTimers.current[i]) {
                        clearTimeout(longPressTimers.current[i]!);
                        longPressTimers.current[i] = null;
                      }
                    }}
                    onPointerLeave={() => {
                      if (longPressTimers.current[i]) {
                        clearTimeout(longPressTimers.current[i]!);
                        longPressTimers.current[i] = null;
                      }
                    }}
                    className="btn-smooth rounded-full transition-all"
                    style={{
                      width: 24,
                      height: 24,
                      background: color,
                      boxShadow: selected
                        ? `0 0 0 2px white, 0 0 0 4px ${color}`
                        : color === "#ffffff"
                        ? "inset 0 0 0 1.5px rgba(0,0,0,0.15)"
                        : "0 1px 4px rgba(0,0,0,0.15)",
                    }}
                    title={`${color} — right-click or hold to change`}
                    aria-label={`Color ${color}`}
                  />
                  <input
                    type="color"
                    ref={(el) => { paletteInputRefs.current[i] = el; }}
                    value={color}
                    onChange={(e) => {
                      const next = [...userPalette];
                      next[i] = e.target.value;
                      setUserPalette(next);
                      onBrushChange({
                        color: e.target.value,
                        tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool,
                      });
                      onDeselectAsset();
                    }}
                    className="pointer-events-none absolute opacity-0"
                    style={{ width: 1, height: 1, top: 0, left: 0 }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              );
            })}
            <label
              className="btn-smooth flex cursor-pointer items-center justify-center overflow-hidden rounded-full"
              style={{
                width: 24,
                height: 24,
                background: "conic-gradient(from 0deg, #ff6b9d, #fb923c, #fbbf24, #6ee7b7, #67d4f1, #a78bfa, #ff6b9d)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
              title="Custom color"
              aria-label="Pick custom color"
            >
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onBrushChange({
                    color: e.target.value,
                    tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool,
                  });
                  onDeselectAsset();
                }}
                className="absolute opacity-0"
                style={{ width: 1, height: 1 }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Brush size — floats to the right of the toolbar, same vertical center ── */}
      {(brushSettings.tool === "pen" || brushSettings.tool === "eraser") && (
        <div
          className="pointer-events-none absolute left-[4.5rem] z-20 flex items-center"
          style={{ top: "1rem", bottom: "5.5rem" }}
        >
          <div
            className="animate-panel-in pointer-events-auto flex flex-col items-center gap-1 px-1.5 py-2"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 16,
              border: "1px solid rgba(186,156,214,0.25)",
              boxShadow: "0 4px 16px rgba(143,109,178,0.13), 0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {([2, 5, 10, 18] as const).map((sz) => {
              const active = brushSettings.size === sz;
              const dot = Math.max(4, Math.min(sz + 2, 16));
              return (
                <button
                  key={sz}
                  onClick={() => onBrushChange({ size: sz })}
                  className="btn-smooth flex items-center justify-center rounded-xl"
                  style={{
                    width: 34,
                    height: 34,
                    background: active ? "rgba(255,107,157,0.13)" : "transparent",
                  }}
                  title={`Size ${sz}`}
                  aria-label={`Brush size ${sz}`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: dot,
                      height: dot,
                      background: active ? "var(--pink)" : "rgba(100,80,130,0.35)",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Text options — floats to the right of the toolbar when text tool active ── */}
      {brushSettings.tool === "text" && (
        <div
          className="pointer-events-none absolute left-[4.5rem] z-20 flex items-center"
          style={{ top: "1rem", bottom: "5.5rem" }}
        >
          <div
            className="animate-panel-in pointer-events-auto flex flex-col items-center gap-0.5 px-1.5 py-2"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 16,
              border: "1px solid rgba(186,156,214,0.25)",
              boxShadow: "0 4px 16px rgba(143,109,178,0.13), 0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {/* Size label */}
            <span
              className="mb-0.5 text-[8px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Size
            </span>

            {/* Size presets */}
            {TEXT_SIZES.map((sz) => {
              const active = selectedTextSize === sz.value;
              return (
                <button
                  key={sz.value}
                  onClick={() => onBrushChange({ textSize: sz.value })}
                  className="btn-smooth flex items-center justify-center rounded-xl"
                  style={{
                    width: 38,
                    height: 34,
                    background: active ? "rgba(255,107,157,0.13)" : "transparent",
                  }}
                  title={`${sz.label} (${sz.value}px)`}
                  aria-label={`Text size ${sz.label}`}
                >
                  <span
                    style={{
                      fontSize: sz.display,
                      fontFamily: '"Space Mono", monospace',
                      fontWeight: 700,
                      color: active ? "var(--pink)" : "rgba(100,80,130,0.45)",
                      lineHeight: 1,
                    }}
                  >
                    A
                  </span>
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ width: 26, height: 1, background: "rgba(186,156,214,0.3)", margin: "3px 0" }} />

            {/* Font label */}
            <span
              className="mb-0.5 text-[8px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Font
            </span>

            {/* Built-in font presets */}
            {BUILT_IN_FONTS.map((font) => {
              const active = selectedTextFont === font.value;
              return (
                <button
                  key={font.value}
                  onClick={() => onBrushChange({ textFont: font.value })}
                  className="btn-smooth flex flex-col items-center justify-center rounded-xl gap-0"
                  style={{
                    width: 38,
                    height: 38,
                    background: active ? "rgba(167,139,250,0.15)" : "transparent",
                  }}
                  title={font.label}
                  aria-label={`Font: ${font.label}`}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: font.value,
                      fontWeight: 700,
                      color: active ? "var(--lavender)" : "rgba(100,80,130,0.5)",
                      lineHeight: 1,
                    }}
                  >
                    Aa
                  </span>
                  <span
                    style={{
                      fontSize: 7,
                      fontFamily: '"Space Mono", monospace',
                      color: active ? "var(--lavender)" : "rgba(100,80,130,0.35)",
                      lineHeight: 1.2,
                      marginTop: 2,
                    }}
                  >
                    {font.label}
                  </span>
                </button>
              );
            })}

            {/* Custom fonts */}
            {customFonts.length > 0 && (
              <>
                <div style={{ width: 26, height: 1, background: "rgba(186,156,214,0.3)", margin: "3px 0" }} />
                {customFonts.map((cf) => {
                  const value = `custom:${cf.name}`;
                  const active = selectedTextFont === value;
                  return (
                    <button
                      key={cf.id}
                      onClick={() => onBrushChange({ textFont: value })}
                      className="btn-smooth flex flex-col items-center justify-center rounded-xl"
                      style={{
                        width: 38,
                        height: 38,
                        background: active ? "rgba(251,146,60,0.13)" : "transparent",
                      }}
                      title={cf.name}
                      aria-label={`Custom font: ${cf.name}`}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 700,
                          color: active ? "var(--coral)" : "rgba(100,80,130,0.5)",
                          lineHeight: 1.2,
                          textAlign: "center",
                          maxWidth: 34,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cf.name}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Collaborator avatars (top right) ──────────────────────────────── */}
      <CollaboratorAvatars
        collaborators={shownCollaborators}
        selfCollaboratorId={selfCollaboratorId}
        onJumpToCollaborator={onJumpToCollaborator}
        onOpenOwnProfile={onOpenOwnProfile}
      />

      {/* ── Action buttons (bottom right) ────────────────────────────────── */}
      <div
        className="pointer-events-auto absolute z-30 flex flex-col gap-2.5"
        style={{
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={() => { onUndo(); toast("Undone", { icon: "undo" }); }}
          className="btn-smooth btn-ripple flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 4px 16px rgba(143,109,178,0.14), 0 1px 4px rgba(0,0,0,0.07)",
          }}
          title="Undo"
          aria-label="Undo"
        >
          {UndoIcon}
        </button>
        <button
          onClick={() => { onRedo(); toast("Redone", { icon: "redo" }); }}
          className="btn-smooth btn-ripple flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 4px 16px rgba(143,109,178,0.14), 0 1px 4px rgba(0,0,0,0.07)",
          }}
          title="Redo"
          aria-label="Redo"
        >
          {RedoIcon}
        </button>
        <button
          onClick={isExporting ? undefined : onExport}
          className="btn-smooth btn-ripple flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: isExporting
              ? "linear-gradient(135deg, rgba(255,107,157,0.5), rgba(167,139,250,0.5))"
              : "linear-gradient(135deg, var(--pink), var(--lavender))",
            boxShadow: isExporting ? "none" : "0 6px 18px rgba(255,107,157,0.38)",
            cursor: isExporting ? "not-allowed" : "pointer",
          }}
          title={isExporting ? "Saving…" : "Save (JPEG or WebM)"}
          aria-label={isExporting ? "Saving…" : "Save canvas"}
          aria-busy={isExporting}
        >
          {isExporting ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5" strokeDasharray="28 56" strokeLinecap="round" />
            </svg>
          ) : ExportIcon}
        </button>
      </div>

      {/* ── Asset drawer — rendered LAST so it always paints above toolbar/buttons ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="animate-fade-backdrop pointer-events-auto absolute inset-0 z-40"
            style={{ background: "rgba(30,10,50,0.14)", backdropFilter: "blur(3px)" }}
            onClick={() => setDrawerOpen(false)}
          />
          {/* Sheet */}
          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 z-50 animate-slide-up overflow-hidden"
            style={{
              maxHeight: "76vh",
              borderRadius: "24px 24px 0 0",
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 -8px 40px rgba(143,109,178,0.18), 0 -2px 8px rgba(0,0,0,0.06)",
              border: "1px solid rgba(186,156,214,0.25)",
              borderBottom: "none",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="rounded-full"
                style={{ width: 40, height: 4, background: "rgba(186,156,214,0.5)" }}
              />
            </div>
            <div style={{ maxHeight: "calc(76vh - 20px)", overflowY: "auto" }}>
              <StudioAssetDrawer
                assetCount={assetCount}
                activeSection={activeSection}
                stickers={stickers}
                washiTapes={washiTapes}
                papers={papers}
                customFonts={customFonts}
                selectedAsset={selectedAsset}
                selectedPaper={selectedPaper}
                brushSettings={brushSettings}
                customColor={customColor}
                colorChoices={colorChoices}
                gifQuery={gifQuery}
                gifResults={gifResults}
                gifLoading={gifLoading}
                gifError={gifError}
                gifUrlInput={gifUrlInput}
                assetSearch={assetSearch}
                onClose={() => setDrawerOpen(false)}
                onSelectSection={setActiveSection}
                onSelectSticker={onSelectSticker}
                onSelectWashi={onSelectWashi}
                onSelectPaper={onSelectPaper}
                onDeselectAsset={onDeselectAsset}
                onDeleteSticker={onDeleteSticker}
                onDeleteWashi={onDeleteWashi}
                onDeletePaper={onDeletePaper}
                onDeleteCustomFont={onDeleteCustomFont}
                onSaveSticker={onSaveSticker}
                onSaveWashi={onSaveWashi}
                onSaveCustomFont={onSaveCustomFont}
                onBrushChange={onBrushChange}
                onClear={onClear}
                setCustomColor={setCustomColor}
                setGifQuery={setGifQuery}
                searchGifs={searchGifs}
                addGifFromResult={addGifFromResult}
                setGifUrlInput={setGifUrlInput}
                addGifFromUrl={addGifFromUrl}
                onAddKitElement={addKitElement}
                onAddKit={addKitAll}
                onAddKitToLibrary={(kit) => {
                  onAddKitToLibrary(kit);
                  showFeedback(`"${kit.name}" saved to your library`);
                }}
                onRemoveKit={onRemoveKit}
                onPublishKit={(kit, toShop) => {
                  onPublishKit(kit, toShop);
                  if (toShop) showFeedback(`"${kit.name}" published to the shop!`);
                  else showFeedback(`"${kit.name}" saved to your library`);
                }}
                kitLibrary={kitLibrary}
                shopKits={storeItems.filter((i) => i.type === "kit")}
                viewer={viewer}
                setAssetSearch={setAssetSearch}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
