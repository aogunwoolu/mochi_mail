
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpaceItem, SpaceItemStyle, SpaceItemType, UserSpace, ViewerIdentity } from "@/types";
import {
  BgConfig,
  EMOJI_ROWS,
  FONT_OPTIONS,
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  THEME_PRESETS,
  SpaceConfig,
  bgToCss,
  displayTitle,
  fontCss,
  isSticker,
  isPinnedItem,
  isVisitorNote,
  loadGoogleFont,
  parseSpaceConfig,
  spaceConfigToWallpaper,
} from "@/lib/spaceConfig";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMochi } from "@/context/MochiContext";
import { toast } from "@/lib/toast";

const SpaceBoard = dynamic(() => import("./SpaceBoard"), { ssr: false });

// ─── Props ───────────────────────────────────────────────────────────────────

interface SpaceStudioProps {
  viewer: ViewerIdentity;
  isAuthenticated: boolean;
  loading?: boolean;
  requestedUsername?: string;
  spaces: UserSpace[];
  ownSpace: UserSpace | null;
  selectedSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
  onRequireAccount: () => void;
  onUpdateOwnSpace: (patch: Partial<UserSpace>) => void;
  onAddItemToOwnSpace: (type: SpaceItemType, seed?: Partial<SpaceItem>) => SpaceItem | undefined;
  onUpdateSpaceItem: (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => void;
  onRemoveSpaceItem: (spaceId: string, itemId: string) => void;
  onLeaveVisitorNote: (spaceId: string, authorName: string, message: string) => void;
  onNavigateBack: () => void;
}

type ActivePanel = "themes" | "background" | "audio" | "font" | "add" | "settings" | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string {
  const s = url.trim();
  if (!s) return "";
  return (
    /youtu\.be\/([^?&]+)/.exec(s)?.[1] ??
    /[?&]v=([^?&]+)/.exec(s)?.[1] ??
    /embed\/([^?&]+)/.exec(s)?.[1] ??
    ""
  );
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

// ─── Color presets ───────────────────────────────────────────────────────────

const NOTE_COLORS = ["#ffe08a", "#d9f7ff", "#ffd6ec", "#e4dcff", "#d9f99d", "#ffd7ba", "#ffffff", "#f1f5f9"];
const ACCENT_PRESETS = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"];
const DOODLE_INK = ["#352742", "#ff6b9d", "#7c3aed", "#0f766e", "#ea580c", "#2563eb"];

// ─── BackgroundPicker ─────────────────────────────────────────────────────────

function BackgroundPicker({
  bg,
  onChange,
  onUploadImage,
}: Readonly<{ bg: BgConfig; onChange: (bg: BgConfig) => void; onUploadImage: (file: File) => Promise<string | null> }>) {
  type Tab = "solid" | "gradient" | "image";
  const initTab: Tab = bg.type === "gradient" ? "gradient" : bg.type === "image" ? "image" : "solid";
  const [tab, setTab] = useState<Tab>(initTab);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface)" }}>
        {(["solid", "gradient", "image"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize"
            style={{
              background: tab === t ? "white" : "transparent",
              color: tab === t ? "var(--foreground)" : "var(--muted)",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "solid" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {SOLID_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ type: "solid", color: c })}
                className="btn-smooth h-8 w-8 rounded-full border-2"
                style={{
                  background: c,
                  borderColor: bg.type === "solid" && bg.color === c ? "var(--foreground)" : "var(--border)",
                }}
              />
            ))}
          </div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Custom color</label>
          <input
            type="color"
            value={bg.type === "solid" ? (bg.color ?? "#ffffff") : "#ffffff"}
            onChange={(e) => onChange({ type: "solid", color: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      )}

      {tab === "gradient" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onChange({ type: "gradient", c1: p.c1, c2: p.c2, angle: p.angle })}
                className="btn-smooth overflow-hidden rounded-xl border"
                style={{ borderColor: bg.type === "gradient" && bg.c1 === p.c1 ? "var(--foreground)" : "var(--border)" }}
              >
                <div className="h-10" style={{ background: `linear-gradient(${p.angle}deg, ${p.c1}, ${p.c2})` }} />
                <p className="px-1 py-0.5 text-[9px] font-semibold" style={{ color: "var(--muted)" }}>{p.label}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Color A</label>
              <input type="color" value={bg.c1 ?? "#ffd6ec"} onChange={(e) => onChange({ ...bg, type: "gradient", c1: e.target.value })} className="h-8 w-full cursor-pointer rounded-lg border" style={{ borderColor: "var(--border)" }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Color B</label>
              <input type="color" value={bg.c2 ?? "#fff6fb"} onChange={(e) => onChange({ ...bg, type: "gradient", c2: e.target.value })} className="h-8 w-full cursor-pointer rounded-lg border" style={{ borderColor: "var(--border)" }} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>
              Angle — {bg.angle ?? 135}°
            </label>
            <input
              type="range" min={0} max={360}
              value={bg.angle ?? 135}
              onChange={(e) => onChange({ ...bg, type: "gradient", angle: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          {bg.type === "gradient" && (
            <div className="h-10 rounded-xl border" style={{ background: bgToCss(bg), borderColor: "var(--border)" }} />
          )}
        </div>
      )}

      {tab === "image" && (
        <div className="space-y-3">
          <label className="btn-smooth flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", color: "white", opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading…" : "⬆️ Upload from device"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const url = await onUploadImage(file);
                setUploading(false);
                if (url) onChange({ ...bg, type: "image", url, fit: bg.fit ?? "cover" });
                e.currentTarget.value = "";
              }} />
          </label>
          <input
            type="url"
            value={bg.type === "image" ? (bg.url ?? "") : ""}
            onChange={(e) => onChange({ ...bg, type: "image", url: e.target.value })}
            placeholder="…or paste a direct image URL"
            className="input-soft w-full px-3 py-2 text-sm outline-none"
          />
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>Fit</label>
            <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface)" }}>
              {(["cover", "contain", "tile"] as const).map((f) => (
                <button key={f} onClick={() => onChange({ ...bg, type: "image", fit: f })}
                  className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize"
                  style={{
                    background: (bg.fit ?? "cover") === f ? "white" : "transparent",
                    color: (bg.fit ?? "cover") === f ? "var(--foreground)" : "var(--muted)",
                    boxShadow: (bg.fit ?? "cover") === f ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              Soften — {bg.scrim ?? 0}%
            </label>
            <input type="range" min={0} max={80} value={bg.scrim ?? 0}
              onChange={(e) => onChange({ ...bg, type: "image", scrim: Number(e.target.value) })} className="w-full" />
            <p className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>Adds a light wash so text stays readable.</p>
          </div>
          {bg.type === "image" && bg.url ? (
            <div className="h-28 overflow-hidden rounded-xl border" style={{ background: bgToCss(bg), borderColor: "var(--border)" }} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── FontPanel ────────────────────────────────────────────────────────────────

function FontPanel({
  font,
  onChange,
}: Readonly<{ font: SpaceConfig["font"]; onChange: (font: SpaceConfig["font"]) => void }>) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Family</label>
        <div className="grid grid-cols-2 gap-2">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => { loadGoogleFont(opt.gfont); onChange({ ...font, family: opt.label }); }}
              className="btn-smooth rounded-xl border px-3 py-2 text-sm text-left"
              style={{
                fontFamily: opt.css,
                borderColor: font.family === opt.label ? "var(--pink)" : "var(--border)",
                background: font.family === opt.label ? "rgba(255,107,157,0.08)" : "var(--surface)",
                color: "var(--foreground-soft)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Text color</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {["#352742", "#1e1b4b", "#ffffff", "#ff6b9d", "#3b82f6", "#16a34a", "#ea580c", "#7c3aed"].map((c) => (
            <button key={c} onClick={() => onChange({ ...font, color: c })}
              className="btn-smooth h-7 w-7 rounded-full border-2"
              style={{ background: c, borderColor: font.color === c ? "rgba(53,39,66,0.85)" : "transparent" }} />
          ))}
        </div>
        <input type="color" value={font.color} onChange={(e) => onChange({ ...font, color: e.target.value })}
          className="h-8 w-full cursor-pointer rounded-lg border" style={{ borderColor: "var(--border)" }} />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
          Size — {font.size}px
        </label>
        <input type="range" min={11} max={22} value={font.size}
          onChange={(e) => onChange({ ...font, size: Number(e.target.value) })} className="w-full" />
        <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", fontFamily: fontCss(font.family), fontSize: font.size, color: font.color, background: "rgba(255,255,255,0.7)" }}>
          The quick brown fox jumps ✨
        </div>
      </div>
    </div>
  );
}

// ─── EmojiPicker ──────────────────────────────────────────────────────────────

function EmojiPicker({ onPick }: Readonly<{ onPick: (e: string) => void }>) {
  return (
    <div className="space-y-1">
      {EMOJI_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1">
          {row.map((emoji) => (
            <button key={emoji} onClick={() => onPick(emoji)}
              className="btn-smooth flex h-9 w-9 items-center justify-center rounded-xl text-xl"
              style={{ background: "var(--surface)" }}>
              {emoji}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── DoodlePad ────────────────────────────────────────────────────────────────

function DoodlePad({ onCreate }: Readonly<{ onCreate: (url: string) => void }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState(DOODLE_INK[0]);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#fffdfb";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
  }, []);

  const dot = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    ctx.strokeStyle = ctx.fillStyle = ink;
    if (!lastPt.current) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(lastPt.current.x, lastPt.current.y); ctx.lineTo(x, y); ctx.stroke(); }
    lastPt.current = { x, y };
  };

  const stop = () => { drawing.current = false; lastPt.current = null; };

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {DOODLE_INK.map((c) => (
          <button key={c} onClick={() => setInk(c)}
            className="btn-smooth h-7 w-7 rounded-full border-2"
            style={{ background: c, borderColor: ink === c ? "rgba(53,39,66,0.85)" : "transparent" }} />
        ))}
      </div>
      <canvas
        ref={canvasRef} width={280} height={150}
        className="w-full cursor-crosshair rounded-xl border"
        style={{ borderColor: "var(--border)" }}
        onPointerDown={(e) => { drawing.current = true; dot(e); }}
        onPointerMove={(e) => { if (drawing.current) dot(e); }}
        onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            const c = canvasRef.current; const ctx = c?.getContext("2d");
            if (c && ctx) { ctx.fillStyle = "#fffdfb"; ctx.fillRect(0, 0, c.width, c.height); }
          }}
          className="btn-smooth rounded-lg px-3 py-1.5 text-xs"
          style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
          Clear
        </button>
        <button
          onClick={() => { if (canvasRef.current) onCreate(canvasRef.current.toDataURL("image/png")); }}
          className="btn-smooth flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
          Add doodle
        </button>
      </div>
    </div>
  );
}

// ─── Panel Shell ──────────────────────────────────────────────────────────────

function PanelShell({ title, onClose, children }: Readonly<{ title: string; onClose: () => void; children: React.ReactNode }>) {
  return (
    <div
      data-panel
      className="absolute right-4 top-[4.75rem] z-[300] w-80 animate-fade-in overflow-hidden rounded-3xl"
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 12px 48px rgba(120,60,160,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</p>
        <button onClick={onClose} className="btn-smooth flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>✕</button>
      </div>
      <div className="max-h-[68vh] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

// ─── Style Section ────────────────────────────────────────────────────────────

function StyleSection({ item, onUpdate }: Readonly<{ item: SpaceItem; onUpdate: (p: Partial<SpaceItem>) => void }>) {
  const style = item.style ?? {};
  const set = (patch: Partial<SpaceItemStyle>) => onUpdate({ style: { ...style, ...patch } });
  const showTexture = item.type === "note" || item.type === "about";
  const defaultTexture = item.type === "about" ? "card" : "paper";
  const showFill = ["note", "about", "link", "music", "image", "drawing"].includes(item.type);
  const fillLabel = item.type === "image" || item.type === "drawing" ? "Frame colour" : "Card colour";
  const hexInput = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#ffffff");

  const Seg = <T extends string>({ options, value, onPick }: { options: readonly T[]; value: T; onPick: (v: T) => void }) => (
    <div className="flex gap-1 rounded-xl p-1" style={{ background: "white" }}>
      {options.map((o) => (
        <button key={o} onClick={() => onPick(o)}
          className="btn-smooth flex-1 rounded-lg py-1 text-[11px] font-semibold capitalize"
          style={{ background: value === o ? "var(--surface-active)" : "transparent", color: "var(--foreground-soft)" }}>
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2.5 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>✨ Style</p>
        <button onClick={() => onUpdate({ style: {} })} className="btn-smooth rounded-lg px-2 py-0.5 text-[10px]" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>Reset</button>
      </div>
      {showTexture && (
        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>Texture</p>
          <Seg options={["paper", "card", "plain"] as const} value={(style.texture ?? defaultTexture)} onPick={(t) => set({ texture: t })} />
        </div>
      )}
      {showFill && (
        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>{fillLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            {NOTE_COLORS.map((c) => (
              <button key={c} onClick={() => onUpdate({ color: c })}
                className="btn-smooth h-6 w-6 rounded-full border-2"
                style={{ background: c, borderColor: item.color === c ? "rgba(53,39,66,0.85)" : "var(--border)" }} />
            ))}
            <input type="color" value={hexInput(item.color)} onChange={(e) => onUpdate({ color: e.target.value })}
              className="h-6 w-9 cursor-pointer rounded border-0" title="Custom colour" />
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>Corners — {style.radius ?? "auto"}</p>
        <input type="range" min={0} max={40} value={style.radius ?? 16} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full" />
      </div>
      <div>
        <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>Shadow</p>
        <Seg options={["none", "soft", "strong"] as const} value={style.shadow ?? "soft"} onPick={(s) => set({ shadow: s })} />
      </div>
      <div>
        <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>Opacity — {style.opacity ?? 100}%</p>
        <input type="range" min={20} max={100} value={style.opacity ?? 100} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full" />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
          Text
          <input type="color" value={style.textColor ?? "#352742"} onChange={(e) => set({ textColor: e.target.value })} className="h-6 w-9 cursor-pointer rounded border-0" />
        </label>
        <label className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
          Border
          <input type="color" value={style.borderColor ?? "#cbb6e6"} onChange={(e) => set({ borderColor: e.target.value })} className="h-6 w-9 cursor-pointer rounded border-0" />
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Item Sheet ───────────────────────────────────────────────────────────────

function ItemSheet({
  item, spaceId, isOwner, accent, onUpdate, onRemove, onTogglePin, onClose,
}: Readonly<{
  item: SpaceItem; spaceId: string; isOwner: boolean; accent: string;
  onUpdate: (p: Partial<SpaceItem>) => void;
  onRemove: () => void; onTogglePin: () => void; onClose: () => void;
}>) {
  const pinned = isPinnedItem(item);
  const visitor = isVisitorNote(item);
  const sticker = isSticker(item);
  const title = displayTitle(item);
  void spaceId;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[200] animate-slide-up rounded-t-3xl"
      style={{ background: "rgba(255,255,255,0.97)", borderTop: `2px solid ${accent}44`, boxShadow: "0 -8px 32px rgba(53,39,66,0.14)", backdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          {pinned && <span className="text-sm">📌</span>}
          {visitor && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: "#fde68a", color: "#78350f" }}>visitor</span>
          )}
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {sticker ? "Emoji sticker" : title || "Item"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <button onClick={onTogglePin}
                className="btn-smooth rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: pinned ? `${accent}22` : "var(--surface)", color: pinned ? accent : "var(--muted-strong)", border: "1px solid var(--border)" }}>
                {pinned ? "📌 Pinned" : "Pin"}
              </button>
              <button onClick={onRemove}
                className="btn-smooth rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: "rgba(251,146,60,0.12)", color: "#ea580c" }}>
                Remove
              </button>
            </>
          )}
          <button onClick={onClose} className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-xs" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>✕</button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {sticker ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span style={{ fontSize: 56 }}>{item.content}</span>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Drag to reposition on the board</p>
          </div>
        ) : isOwner && !visitor ? (
          <>
            {item.type === "divider" ? (
              <Field label="Divider label (optional)">
                <input value={title} onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="e.g. ✦ ✦ ✦" className="input-soft w-full px-3 py-2 text-sm outline-none" />
              </Field>
            ) : item.type === "header" ? (
              <Field label="Heading text">
                <input value={title} onChange={(e) => onUpdate({ title: (pinned ? "📌 " : "") + e.target.value })}
                  placeholder="Section title" className="input-soft w-full px-3 py-2 text-sm outline-none" />
              </Field>
            ) : item.type === "link" || item.type === "music" ? (
              <>
                <Field label={item.type === "music" ? "Track name" : "Link label"}>
                  <input value={title} onChange={(e) => onUpdate({ title: (pinned ? "📌 " : "") + e.target.value })}
                    placeholder={item.type === "music" ? "e.g. lofi beats" : "e.g. My portfolio"} className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
                <Field label={item.type === "music" ? "Music link" : "Link URL"}>
                  <input value={item.content} onChange={(e) => onUpdate({ content: e.target.value })}
                    placeholder="https://…" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
                <Field label="Thumbnail image URL (optional)">
                  <input value={item.imageUrl ?? ""} onChange={(e) => onUpdate({ imageUrl: e.target.value })}
                    placeholder="https://… image" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
                {item.content ? (
                  <a href={item.content} target="_blank" rel="noopener noreferrer"
                    className="btn-smooth inline-block rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: `${accent}18`, color: accent }}>Open ↗</a>
                ) : null}
              </>
            ) : item.type === "image" || item.type === "drawing" ? (
              <>
                <Field label="Caption (optional)">
                  <input value={title} onChange={(e) => onUpdate({ title: (pinned ? "📌 " : "") + e.target.value })}
                    placeholder="A little caption" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
                <Field label="Image URL">
                  <input value={item.imageUrl ?? ""} onChange={(e) => onUpdate({ imageUrl: e.target.value })}
                    placeholder="https://… image" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Title">
                  <input value={title} onChange={(e) => onUpdate({ title: (pinned ? "📌 " : "") + e.target.value })}
                    placeholder="Give it a title" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                </Field>
                <Field label="Content">
                  <textarea value={item.content} onChange={(e) => onUpdate({ content: e.target.value })}
                    rows={4} placeholder="Write something…" className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
                </Field>
              </>
            )}
            <StyleSection item={item} onUpdate={onUpdate} />
          </>
        ) : (
          <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--surface)" }}>
            {item.title ? <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{item.title}</p> : null}
            {(item.type === "link" || item.type === "music") && item.content ? (
              <a href={item.content} target="_blank" rel="noopener noreferrer"
                className="btn-smooth inline-block rounded-xl px-3 py-1.5 text-xs font-semibold"
                style={{ background: `${accent}18`, color: accent }}>Open ↗</a>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>{item.content}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Visitor Note Modal ───────────────────────────────────────────────────────

function VisitorNoteModal({
  space, viewer, accent, onSubmit, onClose,
}: Readonly<{
  space: UserSpace; viewer: ViewerIdentity; accent: string;
  onSubmit: (name: string, msg: string) => void; onClose: () => void;
}>) {
  const [name, setName] = useState(viewer.name);
  const [msg, setMsg] = useState("");
  const ok = name.trim().length > 0 && msg.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(53,39,66,0.38)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-slide-up rounded-3xl p-6"
        style={{ background: "rgba(255,255,255,0.98)", boxShadow: "0 24px 64px rgba(53,39,66,0.24)", border: `1px solid ${accent}44` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold">Leave a note 💌</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Your note will appear on {space.ownerName}&apos;s board.
            </p>
          </div>
          <button onClick={onClose} className="btn-smooth flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="input-soft w-full px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>Message</label>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4}
              placeholder={`Say something to ${space.ownerName}…`}
              className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
          </div>
          <button
            onClick={() => { if (ok) { onSubmit(name.trim(), msg.trim()); onClose(); } }}
            disabled={!ok}
            className="btn-smooth w-full rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, var(--lavender))`, opacity: ok ? 1 : 0.5 }}
          >
            Post note to board
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main SpaceStudio ────────────────────────────────────────────────────────

export default function SpaceStudio({
  viewer,
  isAuthenticated,
  loading = false,
  requestedUsername,
  spaces,
  ownSpace,
  selectedSpaceId,
  onSelectSpace,
  onRequireAccount,
  onUpdateOwnSpace,
  onAddItemToOwnSpace,
  onUpdateSpaceItem,
  onRemoveSpaceItem,
  onLeaveVisitorNote,
  onNavigateBack,
}: Readonly<SpaceStudioProps>) {
  const { supporter } = useMochi();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showVisitorNote, setShowVisitorNote] = useState(false);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [audioMuted, setAudioMuted] = useState(true);
  const audioFrameRef = useRef<HTMLIFrameElement>(null);

  const selectedSpace = useMemo(
    () => spaces.find((s) => s.id === selectedSpaceId) ?? ownSpace ?? spaces[0] ?? null,
    [ownSpace, selectedSpaceId, spaces]
  );

  const isOwner = Boolean(selectedSpace && ownSpace && selectedSpace.id === ownSpace.id);
  // The edit sheet is only shown when the user taps the floating ✎ button (editingItemId),
  // not merely on selection — so dragging an item no longer pops the sheet open.
  const editingItem = selectedSpace?.items.find((i) => i.id === editingItemId) ?? null;

  const spaceConfig = useMemo(() => parseSpaceConfig(selectedSpace?.wallpaper), [selectedSpace?.wallpaper]);
  const bgCssValue = useMemo(() => bgToCss(spaceConfig.bg), [spaceConfig.bg]);
  const accent = spaceConfig.lineColor || selectedSpace?.accentColor || "#ff6b9d";
  const youtubeId = extractYouTubeId(selectedSpace?.youtubeUrl ?? "");
  const fontStyle: React.CSSProperties = {
    fontFamily: fontCss(spaceConfig.font.family),
    fontSize: spaceConfig.font.size,
    color: spaceConfig.font.color,
  };

  // Load Google Font
  useEffect(() => {
    const opt = FONT_OPTIONS.find((f) => f.label === spaceConfig.font.family);
    loadGoogleFont(opt?.gfont ?? null);
  }, [spaceConfig.font.family]);

  // Close the edit sheet whenever the selection changes (incl. deselect).
  useEffect(() => {
    setEditingItemId(null);
  }, [selectedItemId]);

  // Reset on space change
  useEffect(() => {
    setSelectedItemId(null);
    setEditingItemId(null);
    setActivePanel(null);
    setAudioMuted(true);
  }, [selectedSpace?.id]);

  // Audio starts muted (browsers block unmuted autoplay). Unmute on a real
  // user gesture via the YouTube IFrame API.
  const ytCommand = useCallback((func: string) => {
    audioFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  }, []);

  const toggleAudioMute = useCallback(() => {
    setAudioMuted((prev) => {
      const next = !prev;
      if (next) {
        ytCommand("mute");
      } else {
        ytCommand("unMute");
        ytCommand("playVideo");
      }
      return next;
    });
  }, [ytCommand]);

  // Close panels on outside click
  useEffect(() => {
    if (!activePanel && !showSpacePicker) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-panel]") && !t.closest("[data-toolbar]") && !t.closest("[data-spacepicker]")) {
        setActivePanel(null);
        setShowSpacePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activePanel, showSpacePicker]);

  const handleItemChange = useCallback(
    (itemId: string, patch: Partial<SpaceItem>) => {
      if (!selectedSpace) return;
      onUpdateSpaceItem(selectedSpace.id, itemId, patch);
    },
    [onUpdateSpaceItem, selectedSpace]
  );

  const updateConfig = useCallback(
    (patch: Partial<SpaceConfig>) => onUpdateOwnSpace({ wallpaper: spaceConfigToWallpaper({ ...spaceConfig, ...patch }) }),
    [onUpdateOwnSpace, spaceConfig]
  );

  const uploadBgImage = useCallback(async (file: File): Promise<string | null> => {
    if (!ownSpace) return null;
    const supabase = createSupabaseBrowserClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${ownSpace.ownerId}/space-bg-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { console.error("[space] bg upload failed:", error.message); return null; }
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl ?? null;
  }, [ownSpace]);

  const applyTheme = useCallback((t: (typeof THEME_PRESETS)[number]) => {
    if (t.plusOnly && !supporter.isPlus) {
      toast("That's a Mochi Plus theme ♡ — become a member to unlock it!", { icon: "star" });
      return;
    }
    loadGoogleFont(FONT_OPTIONS.find((f) => f.label === t.font.family)?.gfont ?? null);
    updateConfig({ bg: t.bg, font: t.font, lineColor: t.lineColor });
  }, [updateConfig, supporter.isPlus]);

  const togglePanel = (p: ActivePanel) => setActivePanel((prev) => (prev === p ? null : p));

  const addSticker = (emoji: string) => {
    onAddItemToOwnSpace("note", {
      color: "sticker", title: emoji, content: emoji,
      width: 90, height: 90,
      rotation: Math.round((Math.random() * 12 - 6) * 10) / 10,
    });
    setActivePanel(null);
  };

  const togglePin = useCallback((item: SpaceItem) => {
    if (!selectedSpace) return;
    const pinned = isPinnedItem(item);
    onUpdateSpaceItem(selectedSpace.id, item.id, { title: pinned ? displayTitle(item) : `📌 ${displayTitle(item)}` });
  }, [onUpdateSpaceItem, selectedSpace]);

  if (!selectedSpace) {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex items-center gap-3 rounded-3xl border px-6 py-5 shadow-sm" style={{ background: "rgba(255,255,255,0.78)", borderColor: "var(--border)", backdropFilter: "blur(12px)" }}>
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: accent }} aria-hidden />
            <p className="text-sm font-semibold" style={{ color: "var(--foreground-soft)" }}>Arranging the board…</p>
          </div>
        </div>
      );
    }
    if (requestedUsername) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div className="rounded-3xl border p-8 shadow-sm" style={{ background: "rgba(255,255,255,0.88)", borderColor: "var(--border)" }}>
            <p className="mb-3 text-3xl">🌸</p>
            <p className="text-base font-semibold">Space not found</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>We couldn&apos;t find a space for <strong>{requestedUsername}</strong>.</p>
            <button onClick={onNavigateBack}
              className="btn-smooth mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
              Go back
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="rounded-3xl border p-8 shadow-sm" style={{ background: "rgba(255,255,255,0.88)", borderColor: "var(--border)" }}>
          <p className="mb-3 text-3xl">🌸</p>
          <p className="text-base font-semibold">Create your profile space</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Sign up to get your own personalised corner of the web.</p>
          <button onClick={onRequireAccount}
            className="btn-smooth mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden" style={{ background: bgCssValue }}>

      {/* ── Floating nav pill ── */}
      <header
        className="absolute left-4 top-4 z-[110] flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-2xl px-2 py-1.5"
        style={{ background: "rgba(255,255,255,0.72)", border: `1px solid ${accent}33`, backdropFilter: "blur(16px)", boxShadow: "0 8px 24px rgba(53,39,66,0.12)" }}
      >
        <button onClick={onNavigateBack}
          className="btn-smooth flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--muted-strong)", background: "rgba(255,255,255,0.7)", border: "1px solid var(--border)" }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Studio
        </button>

        {/* Space switcher */}
        <div className="relative min-w-0" data-spacepicker>
          <button
            onClick={() => setShowSpacePicker((v) => !v)}
            className="btn-smooth flex items-center gap-2 rounded-2xl px-3 py-1.5"
            style={{ background: "rgba(255,255,255,0.72)", border: "1px solid var(--border)" }}
          >
            {selectedSpace.avatarUrl ? (
              <img src={selectedSpace.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: accent }}>
                {selectedSpace.ownerName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {selectedSpace.title || selectedSpace.ownerName}
            </span>
            {spaces.length > 1 && <span className="shrink-0 text-[10px]" style={{ color: "var(--muted)" }}>▾</span>}
          </button>

          {showSpacePicker && spaces.length > 1 && (
            <div className="absolute left-0 top-full z-[400] mt-1.5 min-w-[220px] overflow-hidden rounded-2xl shadow-xl" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid var(--border-strong)" }}>
              {spaces.map((sp) => (
                <button key={sp.id} onClick={() => { onSelectSpace(sp.id); setShowSpacePicker(false); }}
                  className="btn-smooth flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  style={{ background: sp.id === selectedSpace.id ? `${accent}12` : "transparent" }}>
                  {sp.avatarUrl ? <img src={sp.avatarUrl} alt="" className="h-8 w-8 rounded-xl object-cover" /> : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: sp.accentColor || "#ff6b9d" }}>
                      {sp.ownerName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{sp.title || sp.ownerName}</p>
                    <p className="truncate text-[10px]" style={{ color: "var(--muted)" }}>@{sp.slug}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${accent}22`, color: accent }}>
            Your space
          </span>
        )}
        {!isAuthenticated && (
          <button onClick={onRequireAccount}
            className="btn-smooth shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, var(--lavender))` }}>
            Sign up
          </button>
        )}
      </header>

      {/* ── Floating owner toolbar ── */}
      {isOwner && (
        <div
          className="absolute right-4 top-4 z-[110] flex max-w-[calc(100%-2rem)] items-center gap-1.5 overflow-x-auto rounded-2xl px-2 py-1.5"
          style={{ background: "rgba(255,255,255,0.72)", border: "1px solid var(--border)", backdropFilter: "blur(16px)", boxShadow: "0 8px 24px rgba(53,39,66,0.12)" }}
          data-toolbar
        >
          {([
            { id: "themes", label: "✨ Themes" },
            { id: "background", label: "🎨 Background" },
            { id: "audio", label: "🎵 Audio" },
            { id: "font", label: "🔤 Font" },
            { id: "add", label: "➕ Add" },
            { id: "settings", label: "⚙️ Settings" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => togglePanel(id)}
              className="btn-smooth shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{
                background: activePanel === id ? accent : "rgba(255,255,255,0.82)",
                color: activePanel === id ? "white" : "var(--foreground-soft)",
                border: `1px solid ${activePanel === id ? accent : "var(--border)"}`,
              }}>
              {label}
            </button>
          ))}

          {/* Accent color quick row */}
          <div className="flex shrink-0 items-center gap-1.5 border-l pl-2" style={{ borderColor: "var(--border)" }}>
            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Lines</span>
            {ACCENT_PRESETS.map((c) => (
              <button key={c} onClick={() => updateConfig({ lineColor: c })}
                className="btn-smooth h-5 w-5 rounded-full border-2"
                style={{ background: c, borderColor: accent === c ? "rgba(53,39,66,0.8)" : "transparent" }} />
            ))}
            <input type="color" value={accent}
              onChange={(e) => updateConfig({ lineColor: e.target.value })}
              className="h-5 w-5 cursor-pointer rounded-full border-0" title="Custom accent color" />
          </div>
        </div>
      )}

      {/* ── Board ── */}
      <div className="absolute inset-0" style={{ background: bgCssValue }}>

        {/* Ambient accent wash */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48" style={{ background: `linear-gradient(180deg, ${accent}1a, transparent)` }} />

        {/* Infinite pan/zoom canvas — remounts on space change */}
        <SpaceBoard
          key={selectedSpace.id}
          items={selectedSpace.items}
          isOwner={isOwner}
          accent={accent}
          onItemChange={handleItemChange}
          onSelectItem={setSelectedItemId}
          onEditItem={setEditingItemId}
          onDeleteItem={(itemId) => {
            onRemoveSpaceItem(selectedSpace.id, itemId);
            setSelectedItemId(null);
            setEditingItemId(null);
          }}
          selectedItemId={selectedItemId}
        />

        {/* Profile card overlay */}
        <div
          className="absolute left-4 top-[4.75rem] z-20 max-w-[280px] overflow-hidden rounded-[24px] border shadow-[0_12px_32px_rgba(53,39,66,0.12)]"
          style={{ borderColor: `${accent}44`, background: "rgba(255,255,255,0.84)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-3 p-4">
            {selectedSpace.avatarUrl ? (
              <img src={selectedSpace.avatarUrl} alt={selectedSpace.ownerName} className="h-14 w-14 rounded-2xl border-2 object-cover shrink-0" style={{ borderColor: accent }} />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-xl font-bold text-white" style={{ borderColor: accent, background: accent }}>
                {selectedSpace.ownerName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold" style={{ ...fontStyle, fontSize: Math.min((spaceConfig.font.size) + 2, 22) }}>
                {selectedSpace.title || selectedSpace.ownerName}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px]" style={{ color: "var(--muted)" }}>
                <span className="truncate">@{selectedSpace.slug}</span>
                {selectedSpace.ownerIsSupporter ? (
                  <span title="Mochi Plus supporter" aria-label="Mochi Plus supporter" style={{ color: "var(--pink)" }}>♡</span>
                ) : null}
              </p>
              {selectedSpace.tagline ? (
                <p className="mt-1 text-xs leading-snug" style={{ color: "var(--foreground-soft)" }}>{selectedSpace.tagline}</p>
              ) : null}
            </div>
          </div>
          {selectedSpace.aboutMe ? (
            <p
              className="border-t px-4 pb-3 pt-2 text-xs leading-relaxed"
              style={{ borderColor: `${accent}22`, ...fontStyle, fontSize: Math.max(spaceConfig.font.size - 2, 11), color: spaceConfig.font.color }}
            >
              {selectedSpace.aboutMe}
            </p>
          ) : null}
        </div>

        {/* YouTube audio iframe + now-playing chip */}
        {youtubeId ? (
          <>
            <iframe
              ref={audioFrameRef}
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&loop=${spaceConfig.audioLoop ? 1 : 0}&playlist=${youtubeId}&controls=0&mute=1&enablejsapi=1`}
              title="soundtrack"
              allow="autoplay"
              className="pointer-events-none absolute opacity-0"
              style={{ width: 1, height: 1, left: -9999, top: -9999 }}
            />
            <button
              onClick={toggleAudioMute}
              className="btn-smooth absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border px-4 py-2"
              style={{ borderColor: `${accent}55`, background: "rgba(255,255,255,0.90)", backdropFilter: "blur(12px)", boxShadow: "0 8px 20px rgba(53,39,66,0.12)" }}
            >
              <span aria-hidden>{audioMuted ? "🔇" : "🎵"}</span>
              <span className="text-[11px] font-semibold" style={{ color: accent }}>
                {audioMuted ? "Tap to play music" : "Now playing"}
              </span>
              {!audioMuted && isOwner && <span className="text-[10px]" style={{ color: "var(--muted)" }}>{spaceConfig.audioLoop ? "· loop" : "· once"}</span>}
              <a href={selectedSpace.youtubeUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="btn-smooth rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: `${accent}22`, color: accent }}>
                Open
              </a>
            </button>
          </>
        ) : null}
      </div>

      {/* ── Visitor "Leave a note" button ── */}
      {!isOwner && (
        <button
          onClick={() => setShowVisitorNote(true)}
          className="btn-smooth fixed bottom-6 right-6 z-[150] flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, var(--lavender))`, boxShadow: `0 8px 24px ${accent}55` }}
        >
          💌 Leave a note
        </button>
      )}

      {/* ── Owner panels ── */}
      {activePanel === "themes" && (
        <PanelShell title="✨ Themes" onClose={() => setActivePanel(null)}>
          <div className="space-y-2">
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>Pick a full look, then fine-tune anything below.</p>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((t) => {
                const active =
                  bgToCss(t.bg) === bgCssValue &&
                  t.font.family === spaceConfig.font.family &&
                  t.lineColor === accent;
                const locked = Boolean(t.plusOnly && !supporter.isPlus);
                return (
                  <button key={t.label} onClick={() => applyTheme(t)}
                    className="btn-smooth relative overflow-hidden rounded-2xl border text-left"
                    style={{ borderColor: active ? t.lineColor : "var(--border)", borderWidth: active ? 2 : 1 }}>
                    <div className="relative h-12 w-full" style={{ background: bgToCss(t.bg) }}>
                      {t.plusOnly ? (
                        <span
                          className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                          style={{ background: "rgba(255,255,255,0.85)", color: "var(--pink)" }}
                          title={locked ? "Mochi Plus theme" : "Mochi Plus theme (yours ♡)"}
                        >
                          ♡ PLUS
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ opacity: locked ? 0.6 : 1 }}>
                      <span>{t.emoji}</span>
                      <span className="text-xs font-semibold" style={{ fontFamily: fontCss(t.font.family), color: "var(--foreground-soft)" }}>{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </PanelShell>
      )}

      {activePanel === "background" && (
        <PanelShell title="🎨 Background" onClose={() => setActivePanel(null)}>
          <BackgroundPicker bg={spaceConfig.bg} onChange={(bg) => updateConfig({ bg })} onUploadImage={uploadBgImage} />
        </PanelShell>
      )}

      {activePanel === "audio" && (
        <PanelShell title="🎵 Audio" onClose={() => setActivePanel(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>YouTube link</label>
              <input
                value={selectedSpace.youtubeUrl}
                onChange={(e) => onUpdateOwnSpace({ youtubeUrl: e.target.value })}
                placeholder="https://youtu.be/..."
                className="input-soft w-full px-3 py-2 text-sm outline-none"
              />
              <p className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>Plays automatically when visitors open your space.</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div>
                <p className="text-sm font-semibold">Loop track</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>Repeat continuously or play once</p>
              </div>
              <button
                onClick={() => updateConfig({ audioLoop: !spaceConfig.audioLoop })}
                role="switch" aria-checked={spaceConfig.audioLoop}
              >
                <div className="relative h-5 w-9 rounded-full transition-colors" style={{ background: spaceConfig.audioLoop ? accent : "rgba(180,170,195,0.45)" }}>
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: spaceConfig.audioLoop ? "translateX(1.125rem)" : "translateX(0.125rem)" }} />
                </div>
              </button>
            </div>
            {youtubeId ? (
              <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5" style={{ borderColor: `${accent}55`, background: `${accent}0f` }}>
                <span>🎵</span>
                <p className="flex-1 text-xs font-semibold" style={{ color: accent }}>Track active · {spaceConfig.audioLoop ? "looping" : "plays once"}</p>
                <a href={selectedSpace.youtubeUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-smooth rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${accent}22`, color: accent }}>Open</a>
              </div>
            ) : null}
          </div>
        </PanelShell>
      )}

      {activePanel === "font" && (
        <PanelShell title="🔤 Font" onClose={() => setActivePanel(null)}>
          <FontPanel font={spaceConfig.font} onChange={(font) => updateConfig({ font })} />
        </PanelShell>
      )}

      {activePanel === "add" && (
        <PanelShell title="➕ Add to board" onClose={() => setActivePanel(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Cards</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "📝 Sticky note", type: "note" as const, seed: { color: "#ffe08a", width: 220, height: 180 } },
                  { label: "💙 About card", type: "about" as const, seed: { color: "#d9f7ff", width: 260, height: 200 } },
                  { label: "🖼️ Photo card", type: "image" as const, seed: { width: 240, height: 200 } },
                  { label: "✏️ Doodle frame", type: "drawing" as const, seed: { width: 240, height: 200 } },
                ].map(({ label, type, seed }) => (
                  <button key={type} onClick={() => { onAddItemToOwnSpace(type, seed); setActivePanel(null); }}
                    className="btn-smooth rounded-2xl border px-3 py-2.5 text-xs font-semibold text-left"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground-soft)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Blocks</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "🔗 Link", type: "link" as const },
                  { label: "🎶 Music", type: "music" as const },
                  { label: "📰 Heading", type: "header" as const },
                  { label: "➖ Divider", type: "divider" as const },
                ]).map(({ label, type }) => (
                  <button key={type} onClick={() => { onAddItemToOwnSpace(type); setActivePanel(null); }}
                    className="btn-smooth rounded-2xl border px-3 py-2.5 text-xs font-semibold text-left"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground-soft)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Emoji stickers</p>
              <EmojiPicker onPick={addSticker} />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Photo from URL</p>
              <div className="flex gap-2">
                <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://... image URL"
                  className="input-soft min-w-0 flex-1 px-3 py-2 text-sm outline-none" />
                <button
                  onClick={() => {
                    if (newImageUrl.trim()) {
                      onAddItemToOwnSpace("image", { imageUrl: newImageUrl.trim(), width: 240, height: 200 });
                      setNewImageUrl(""); setActivePanel(null);
                    }
                  }}
                  className="btn-smooth shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                  style={{ background: accent }}>
                  Add
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Draw a doodle</p>
              <DoodlePad onCreate={(url) => { onAddItemToOwnSpace("drawing", { imageUrl: url, title: "Doodle", width: 240, height: 200 }); setActivePanel(null); }} />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Upload photo</p>
              <label className="btn-smooth flex cursor-pointer items-center justify-center rounded-xl px-3 py-2.5 text-xs font-semibold"
                style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}>
                Choose image file
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await readFileAsDataUrl(file);
                    if (url) { onAddItemToOwnSpace("image", { imageUrl: url, title: file.name.replace(/\.[^.]+$/, ""), width: 240, height: 200 }); setActivePanel(null); }
                    e.currentTarget.value = "";
                  }} />
              </label>
            </div>
          </div>
        </PanelShell>
      )}

      {activePanel === "settings" && (
        <PanelShell title="⚙️ Space settings" onClose={() => setActivePanel(null)}>
          <div className="space-y-3">
            {([
              { label: "🏷️ Title", field: "title", placeholder: "My cozy corner" },
              { label: "💬 Tagline", field: "tagline", placeholder: "A tiny note about your space" },
            ] as const).map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>{label}</label>
                <input value={(selectedSpace[field] as string) ?? ""}
                  onChange={(e) => onUpdateOwnSpace({ [field]: e.target.value })}
                  placeholder={placeholder} className="input-soft w-full px-3 py-2 text-sm outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>📝 About me</label>
              <textarea value={selectedSpace.aboutMe ?? ""} onChange={(e) => onUpdateOwnSpace({ aboutMe: e.target.value })}
                rows={4} placeholder="Tell visitors about your space"
                className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--muted)" }}>🖼️ Avatar URL</label>
              <input value={selectedSpace.avatarUrl ?? ""}
                onChange={(e) => onUpdateOwnSpace({ avatarUrl: e.target.value })}
                placeholder="Paste an image URL" className="input-soft w-full px-3 py-2 text-sm outline-none" />
            </div>
          </div>
        </PanelShell>
      )}

      {/* ── Item sheet (opens via the floating ✎ button) ── */}
      {editingItem && selectedSpace ? (
        <ItemSheet
          item={editingItem} spaceId={selectedSpace.id} isOwner={isOwner} accent={accent}
          onUpdate={(p) => onUpdateSpaceItem(selectedSpace.id, editingItem.id, p)}
          onRemove={() => { onRemoveSpaceItem(selectedSpace.id, editingItem.id); setEditingItemId(null); setSelectedItemId(null); }}
          onTogglePin={() => togglePin(editingItem)}
          onClose={() => setEditingItemId(null)}
        />
      ) : null}

      {/* ── Visitor note modal ── */}
      {showVisitorNote && (
        <VisitorNoteModal
          space={selectedSpace} viewer={viewer} accent={accent}
          onSubmit={(name, msg) => onLeaveVisitorNote(selectedSpace.id, name, msg)}
          onClose={() => setShowVisitorNote(false)}
        />
      )}
    </div>
  );
}
