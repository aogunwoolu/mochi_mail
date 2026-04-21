"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrushSettings,
  CustomFont,
  PASTEL_COLORS,
  PaperBackground,
  Sticker,
  WashiTape,
} from "@/types";
import FontTracerCreator from "./FontTracerCreator";
import StickerCreator from "./StickerCreator";
import WashiTapeCreator from "./WashiTapeCreator";

const BUILTIN_TEXT_FONTS = [
  { value: '"Space Mono", monospace', label: "Space Mono" },
  { value: '"Arial", sans-serif', label: "Arial" },
  { value: '"Helvetica", sans-serif', label: "Helvetica" },
  { value: '"Verdana", sans-serif', label: "Verdana" },
  { value: '"Tahoma", sans-serif', label: "Tahoma" },
  { value: '"Trebuchet MS", sans-serif', label: "Trebuchet" },
  { value: '"Segoe UI", sans-serif', label: "Segoe UI" },
  { value: '"Gill Sans", sans-serif', label: "Gill Sans" },
  { value: '"Georgia", serif', label: "Georgia" },
  { value: '"Times New Roman", serif', label: "Times New Roman" },
  { value: '"Garamond", serif', label: "Garamond" },
  { value: '"Palatino", serif', label: "Palatino" },
  { value: '"Didot", serif', label: "Didot" },
  { value: '"Baskerville", serif', label: "Baskerville" },
  { value: '"Courier New", monospace', label: "Courier New" },
  { value: '"Lucida Console", monospace', label: "Lucida Console" },
  { value: '"Impact", sans-serif', label: "Impact" },
  { value: '"Comic Sans MS", cursive', label: "Comic Sans" },
  { value: '"Brush Script MT", cursive', label: "Brush Script" },
] as const;

const GIF_PROVIDER = (process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy").toLowerCase();
const GIFAPI_BASE_URL = process.env.NEXT_PUBLIC_GIFAPI_BASE_URL ?? "https://api.gifapi.com/v1";
const GIFAPI_KEY = process.env.NEXT_PUBLIC_GIFAPI_KEY ?? "";
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

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

  const map = new Map<ToolbarControlId, ToolbarControl>(
    DEFAULT_TOOLBAR_CONTROLS.map((control) => [control.id, { ...control }])
  );
  const ordered: ToolbarControl[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rawId = (item as { id?: unknown }).id;
    const rawEnabled = (item as { enabled?: unknown }).enabled;
    if (typeof rawId !== "string") continue;
    if (!map.has(rawId as ToolbarControlId)) continue;

    const fallback = map.get(rawId as ToolbarControlId);
    if (!fallback) continue;
    const next: ToolbarControl = {
      ...fallback,
      enabled: typeof rawEnabled === "boolean" ? rawEnabled : fallback.enabled,
    };
    ordered.push(next);
    map.delete(rawId as ToolbarControlId);
  }

  for (const control of map.values()) ordered.push(control);
  return ordered;
}

type SelectedAsset = Sticker | WashiTape;
type DrawerSection = "assets" | "paper" | "type" | "extras" | "fonts";
type ToolbarControlId = "pen" | "select" | "text" | "eraser" | "drawer" | "undo" | "redo" | "export";

type ToolbarControl = {
  id: ToolbarControlId;
  label: string;
  enabled: boolean;
};

type Collaborator = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  username?: string;
};

type GifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  gifUrl: string;
  width: number;
  height: number;
};

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
          preview_gif?: { url?: string };
        };
        media_formats?: {
          gif?: { url?: string; dims?: number[] };
          tinygif?: { url?: string; dims?: number[] };
          nanogif?: { url?: string; dims?: number[] };
        };
      };

      const giphyPreview = item.images?.fixed_width?.url;
      const giphyGif = item.images?.downsized_medium?.url ?? item.images?.original?.url;
      const tenorPreview = item.media_formats?.tinygif?.url ?? item.media_formats?.nanogif?.url;
      const tenorGif = item.media_formats?.gif?.url;
      const previewUrl = giphyPreview ?? tenorPreview;
      const gifUrl = giphyGif ?? tenorGif ?? item.url;
      if (!previewUrl || !gifUrl) return null;

      const width = toNumber(
        item.images?.fixed_width?.width ?? item.images?.original?.width ?? item.media_formats?.gif?.dims?.[0],
        200
      );
      const height = toNumber(
        item.images?.fixed_width?.height ?? item.images?.original?.height ?? item.media_formats?.gif?.dims?.[1],
        200
      );

      return {
        id: item.id ?? `gif-${index}`,
        title: item.title ?? item.content_description ?? "GIF",
        previewUrl,
        gifUrl,
        width,
        height,
      } satisfies GifSearchResult;
    })
    .filter((item): item is GifSearchResult => item !== null);
}

const SECTION_META: Record<DrawerSection, { label: string }> = {
  assets: { label: "Stickers & Tape" },
  paper: { label: "Paper" },
  type: { label: "Text & Color" },
  extras: { label: "Extras" },
  fonts: { label: "Fonts" },
};

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
  selectedAsset: SelectedAsset | null;
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
  onSaveCustomFont: (
    name: string,
    glyphs: Record<string, string>,
    glyphWidth: number,
    glyphHeight: number
  ) => void;
  collaborators: Collaborator[];
  selfCollaboratorId: string;
  onJumpToCollaborator: (artistId: string) => void;
}

interface StudioAssetDrawerProps {
  assetCount: number;
  activeSection: DrawerSection;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  selectedAsset: SelectedAsset | null;
  selectedPaper: PaperBackground | null;
  brushSettings: BrushSettings;
  selectedTextFont: string;
  selectedTextSize: number;
  customColor: string;
  colorChoices: string[];
  gifQuery: string;
  gifResults: GifSearchResult[];
  gifLoading: boolean;
  gifError: string | null;
  gifUrlInput: string;
  onClose: () => void;
  onSelectSection: (section: DrawerSection) => void;
  onSelectSticker: (s: Sticker) => void;
  onSelectWashi: (w: WashiTape) => void;
  onSelectPaper: (p: PaperBackground) => void;
  onDeselectAsset: () => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
  onDeletePaper: (id: string) => void;
  onDeleteCustomFont: (id: string) => void;
  onSaveSticker: (name: string, imageData: string, w: number, h: number) => void;
  onSaveWashi: (name: string, imageData: string, opacity: number, w: number, h: number) => void;
  onSaveCustomFont: (
    name: string,
    glyphs: Record<string, string>,
    glyphWidth: number,
    glyphHeight: number
  ) => void;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  setCustomColor: (value: string) => void;
  setGifQuery: (value: string) => void;
  searchGifs: () => void;
  addGifFromResult: (result: GifSearchResult) => void;
  setGifUrlInput: (value: string) => void;
  addGifFromUrl: () => void;
  addScrapbookPack: () => void;
  onClear: () => void;
  assetSearch: string;
  setAssetSearch: (value: string) => void;
}

function getSwatchShadow(isSelected: boolean, color: string): string {
  if (isSelected) return `0 0 0 2px white, 0 0 0 3.5px ${color}`;
  if (color === "#ffffff") return "inset 0 0 0 1px rgba(0,0,0,0.12)";
  return "0 1px 4px rgba(0,0,0,0.1)";
}

function SectionTitle({ title, note }: Readonly<{ title: string; note?: string }>) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          {title}
        </p>
        {note ? (
          <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SectionChip({
  active,
  label,
  onClick,
}: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="btn-smooth whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all"
      style={{
        background: active ? "var(--pink)" : "transparent",
        color: active ? "white" : "var(--muted-strong)",
      }}
    >
      {label}
    </button>
  );
}

function RoundIconButton({
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
      className="btn-smooth flex flex-col items-center gap-0.5 px-1 py-1"
      title={title}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: active ? "rgba(255,107,157,0.15)" : "rgba(255,255,255,0.7)",
          border: active ? "1.5px solid rgba(255,107,157,0.45)" : "1.5px solid rgba(0,0,0,0.07)",
        }}
      >
        {children}
      </span>
      {label ? (
        <span
          className="text-[9px] font-medium leading-tight"
          style={{ color: active ? "var(--pink)" : "var(--muted)" }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

function StudioAssetDrawer({
  assetCount,
  activeSection,
  stickers,
  washiTapes,
  papers,
  customFonts,
  selectedAsset,
  selectedPaper,
  brushSettings,
  selectedTextFont,
  selectedTextSize,
  customColor,
  colorChoices,
  gifQuery,
  gifResults,
  gifLoading,
  gifError,
  gifUrlInput,
  onClose,
  onSelectSection,
  onSelectSticker,
  onSelectWashi,
  onSelectPaper,
  onDeselectAsset,
  onDeleteSticker,
  onDeleteWashi,
  onDeletePaper,
  onDeleteCustomFont,
  onSaveSticker,
  onSaveWashi,
  onSaveCustomFont,
  onBrushChange,
  setCustomColor,
  setGifQuery,
  searchGifs,
  addGifFromResult,
  setGifUrlInput,
  addGifFromUrl,
  addScrapbookPack,
  onClear,
  assetSearch,
  setAssetSearch,
}: Readonly<StudioAssetDrawerProps>) {
  const query = assetSearch.trim().toLowerCase();
  const filteredStickers = useMemo(
    () => stickers.filter((item) => item.name.toLowerCase().includes(query)),
    [stickers, query]
  );
  const filteredWashi = useMemo(
    () => washiTapes.filter((item) => item.name.toLowerCase().includes(query)),
    [washiTapes, query]
  );
  const filteredPapers = useMemo(
    () => papers.filter((item) => item.name.toLowerCase().includes(query)),
    [papers, query]
  );
  const filteredFonts = useMemo(
    () => customFonts.filter((item) => item.name.toLowerCase().includes(query)),
    [customFonts, query]
  );

  return (
    <div
      className="animate-slide-up"
      style={{
        background: "#ffffff",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Studio</h3>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(167,139,250,0.12)", color: "var(--purple)" }}
          >
            {assetCount} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ color: "var(--coral)" }}
          >
            Clear canvas
          </button>
          <button
            onClick={onClose}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-full text-base"
            style={{ background: "rgba(0,0,0,0.05)", color: "var(--muted-strong)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 overflow-x-auto px-3 py-2"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", scrollbarWidth: "none" }}
      >
        {(["assets", "paper", "type", "extras", "fonts"] as DrawerSection[]).map((section) => (
          <SectionChip
            key={section}
            active={activeSection === section}
            label={SECTION_META[section].label}
            onClick={() => onSelectSection(section)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
          Library Search
        </p>
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.03)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" stroke="#999" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#999" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            placeholder="Filter assets, paper, and fonts"
            className="w-full bg-transparent text-xs outline-none"
            style={{ color: "var(--foreground)" }}
          />
          {assetSearch ? (
            <button
              onClick={() => setAssetSearch("")}
              className="text-xs"
              style={{ color: "var(--muted)", flexShrink: 0 }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
        <div className="grid gap-4">
          {activeSection === "assets" ? (
            <div className="space-y-4 lg:col-span-2">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="panel-soft p-4">
                  <SectionTitle title="Stickers" note="Pick one, then click on the canvas to place it." />
                  {filteredStickers.length === 0 ? (
                    <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                      No stickers match your search.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 xl:grid-cols-5">
                      {filteredStickers.map((sticker) => {
                        const selected = selectedAsset?.id === sticker.id;
                        return (
                          <div key={sticker.id} className="group relative">
                            <button
                              onClick={() => {
                                if (selected) {
                                  onDeselectAsset();
                                } else {
                                  onSelectSticker(sticker);
                                  onClose();
                                }
                              }}
                              className={`btn-smooth flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl p-1 ${selected ? "glow-pink" : ""}`}
                              style={{
                                background: selected ? "rgba(255,107,157,0.18)" : "var(--surface)",
                                border: selected ? "1px solid rgba(255,107,157,0.35)" : "1px solid var(--border)",
                              }}
                              title={sticker.name}
                            >
                              <img
                                src={sticker.imageData}
                                alt={sticker.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </button>
                            <button
                              onClick={() => onDeleteSticker(sticker.id)}
                              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex"
                              style={{ background: "var(--pink)" }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4">
                    <StickerCreator onSave={onSaveSticker} />
                  </div>
                </div>

                <div className="panel-soft p-4">
                  <SectionTitle title="Washi Tape" note="Choose a tape, then drag across the canvas to apply it." />
                  {filteredWashi.length === 0 ? (
                    <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                      No tape rolls match your search.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredWashi.map((tape) => {
                        const selected = selectedAsset?.id === tape.id;
                        return (
                          <div key={tape.id} className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (selected) {
                                  onDeselectAsset();
                                } else {
                                  onSelectWashi(tape);
                                  onClose();
                                }
                              }}
                              className={`btn-smooth flex h-11 flex-1 items-center overflow-hidden rounded-xl px-3 ${selected ? "glow-mint" : ""}`}
                              style={{
                                background: selected ? "rgba(110,231,183,0.14)" : "var(--surface)",
                                border: selected ? "1px solid rgba(110,231,183,0.35)" : "1px solid var(--border)",
                              }}
                            >
                              <div className="h-5 w-full overflow-hidden rounded" style={{ opacity: tape.opacity }}>
                                <img src={tape.imageData} alt={tape.name} className="h-full w-full object-cover" />
                              </div>
                            </button>
                            <button
                              onClick={() => onDeleteWashi(tape.id)}
                              className="btn-smooth flex h-9 w-9 items-center justify-center rounded-lg text-xs"
                              style={{ color: "var(--muted)", background: "var(--surface)" }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4">
                    <WashiTapeCreator onSave={onSaveWashi} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "paper" ? (
            <div className="space-y-4">
              <div className="panel-soft p-4">
                <SectionTitle title="Paper" note="Choose a background for your canvas." />
                {filteredPapers.length === 0 ? (
                  <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    No paper backgrounds match your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {filteredPapers.map((paper) => {
                      const selected = selectedPaper?.id === paper.id;
                      return (
                        <div key={paper.id} className="group relative">
                          <button
                            onClick={() => {
                              onSelectPaper(paper);
                              onClose();
                            }}
                            className="btn-smooth w-full overflow-hidden rounded-2xl p-1"
                            style={{
                              background: selected ? "rgba(103,212,241,0.15)" : "var(--surface)",
                              border: selected ? "1px solid rgba(103,212,241,0.4)" : "1px solid var(--border)",
                            }}
                          >
                            <div className="mb-1.5 aspect-4/3 overflow-hidden rounded-xl">
                              <img src={paper.imageData} alt={paper.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="truncate px-1 pb-1 text-[10px] font-semibold" style={{ color: "var(--muted-strong)" }}>
                              {paper.name}
                            </div>
                          </button>
                          {filteredPapers.length > 1 ? (
                            <button
                              onClick={() => onDeletePaper(paper.id)}
                              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex"
                              style={{ background: "var(--sky)" }}
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeSection === "type" ? (
            <div className="space-y-4 lg:col-span-2">
              <div className="panel-soft p-4">
                <SectionTitle title="Type & Color" note="Pick a pen color, choose a font, and set the text size." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                      Color
                    </p>
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomColor(value);
                          onBrushChange({ color: value });
                          onDeselectAsset();
                        }}
                        className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        value={customColor}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomColor(value);
                          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                            onBrushChange({ color: value });
                            onDeselectAsset();
                          }
                        }}
                        placeholder="#000000"
                        className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                        style={{ borderColor: "var(--border)", background: "white" }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {colorChoices.map((color) => {
                        const selected = brushSettings.color === color;
                        return (
                          <button
                            key={color}
                            onClick={() => {
                              onBrushChange({ color, tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool });
                              onDeselectAsset();
                            }}
                            className="btn-smooth rounded-full"
                            style={{
                              width: selected ? 24 : 20,
                              height: selected ? 24 : 20,
                              background: color,
                              boxShadow: getSwatchShadow(selected, color),
                            }}
                            title={color}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                      Type Settings
                    </p>
                    <select
                      value={selectedTextFont}
                      onChange={(e) => onBrushChange({ textFont: e.target.value, tool: "text" })}
                      className="mb-2 w-full rounded-lg border px-2 py-2 text-xs outline-none"
                      style={{ borderColor: "var(--border)", background: "white" }}
                    >
                      {BUILTIN_TEXT_FONTS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                      {customFonts.map((font) => (
                        <option key={font.id} value={`custom:${font.id}`}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={12}
                        max={120}
                        value={selectedTextSize}
                        onChange={(e) => onBrushChange({ textSize: Number(e.target.value), tool: "text" })}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-[10px] font-semibold" style={{ color: "var(--muted-strong)" }}>
                        {selectedTextSize}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "extras" ? (
            <div className="space-y-4 lg:col-span-2">
              <div className="panel-soft p-4">
                <SectionTitle title="Extras" note="Add scrapbook elements and searchable GIFs." />
                <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: "rgba(251,146,60,0.35)",
                      background:
                        "repeating-linear-gradient(-12deg, rgba(255,244,230,0.95), rgba(255,244,230,0.95) 18px, rgba(255,251,243,0.95) 18px, rgba(255,251,243,0.95) 36px)",
                    }}
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#b45309" }}>
                      Scrapbook Starter
                    </p>
                    <p className="mb-3 text-xs" style={{ color: "#92400e" }}>
                      Add paper frames, ticket stubs, and labels for a layered scrapbook vibe.
                    </p>
                    <button
                      onClick={addScrapbookPack}
                      className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{ background: "rgba(251,146,60,0.22)", color: "#9a3412" }}
                    >
                      + Add Scrapbook Pack
                    </button>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                      Search GIFs
                    </p>
                    <div className="mb-2 flex gap-2">
                      <input
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") searchGifs();
                        }}
                        placeholder="cats, sparkle, retro..."
                        className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                        style={{ borderColor: "var(--border)", background: "white" }}
                      />
                      <button
                        onClick={searchGifs}
                        className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold"
                        style={{ background: "rgba(103,212,241,0.2)", color: "#0e7490" }}
                      >
                        Search
                      </button>
                    </div>
                    {gifError ? (
                      <p className="mb-2 text-[11px]" style={{ color: "var(--coral)" }}>
                        {gifError}
                      </p>
                    ) : null}
                    {gifLoading ? (
                      <p className="mb-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        Loading GIFs...
                      </p>
                    ) : null}
                    {gifResults.length > 0 ? (
                      <div className="mb-3 grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                        {gifResults.map((gif) => (
                          <button
                            key={gif.id}
                            onClick={() => addGifFromResult(gif)}
                            className="btn-smooth overflow-hidden rounded-lg border"
                            style={{ borderColor: "var(--border)", background: "white" }}
                            title={`Add ${gif.title}`}
                          >
                            <img src={gif.previewUrl} alt={gif.title} className="h-20 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-[11px]" style={{ color: "var(--muted)" }}>
                        Search for a GIF and click a result to add it.
                      </p>
                    )}

                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                      Or paste GIF URL
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={gifUrlInput}
                        onChange={(e) => setGifUrlInput(e.target.value)}
                        placeholder="https://...gif"
                        className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                        style={{ borderColor: "var(--border)", background: "white" }}
                      />
                      <button
                        onClick={addGifFromUrl}
                        className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold"
                        style={{ background: "rgba(103,212,241,0.2)", color: "#0e7490" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "fonts" ? (
            <div className="space-y-4 lg:col-span-2">
              <div className="panel-soft p-4">
                <SectionTitle title="Font Lab" note="Trace your own handwriting and use it as a font." />
                <FontTracerCreator onSave={onSaveCustomFont} />
                {filteredFonts.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {filteredFonts.map((font) => (
                      <div
                        key={font.id}
                        className="group flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      >
                        <button
                          onClick={() => onBrushChange({ textFont: `custom:${font.id}`, tool: "text" })}
                          className="btn-smooth flex-1 text-left"
                          style={{ color: "var(--muted-strong)" }}
                        >
                          <div className="text-xs font-semibold">{font.name}</div>
                          <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                            Use this traced font for text mode
                          </div>
                        </button>
                        <button
                          onClick={() => onDeleteCustomFont(font.id)}
                          className="btn-smooth rounded-lg px-2 py-1 text-[10px]"
                          style={{ background: "rgba(251,146,60,0.15)", color: "var(--coral)" }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    No fonts match your search.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function StudioToolbar({
  brushSettings,
  onBrushChange,
  onUndo,
  onRedo,
  onClear,
  onExport,
  stickers,
  washiTapes,
  papers,
  customFonts,
  selectedAsset,
  selectedPaper,
  onSelectSticker,
  onSelectWashi,
  onSelectPaper,
  onDeselectAsset,
  onDeleteSticker,
  onDeleteWashi,
  onDeletePaper,
  onDeleteCustomFont,
  onSaveSticker,
  onSaveWashi,
  onSaveCustomFont,
  collaborators,
  selfCollaboratorId,
  onJumpToCollaborator,
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

  useEffect(() => {
    setCustomColor(brushSettings.color);
  }, [brushSettings.color]);

  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_toolbar_controls");
      if (!raw) return;
      setToolbarControls(normalizeToolbarControls(JSON.parse(raw)));
    } catch {
      setToolbarControls(DEFAULT_TOOLBAR_CONTROLS);
    }
  }, []);

  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_toolbar_controls", JSON.stringify(toolbarControls));
  }, [toolbarControls]);

  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_left_palette");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((item) => typeof item === "string" && /^#[0-9A-Fa-f]{6}$/.test(item))
        .slice(0, 4);
      if (normalized.length === 4) setUserPalette(normalized as string[]);
    } catch {
      // Ignore invalid persisted palette.
    }
  }, []);

  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_left_palette", JSON.stringify(userPalette));
  }, [userPalette]);

  const isStickerActive = brushSettings.tool === "sticker" && selectedAsset !== null;
  const isWashiActive = brushSettings.tool === "washi" && selectedAsset !== null;
  const colorChoices = useMemo(() => PASTEL_COLORS.slice(0, 10), []);
  const selectedTextFont = brushSettings.textFont ?? BUILTIN_TEXT_FONTS[0].value;
  const selectedTextSize = brushSettings.textSize ?? 34;
  const assetCount = stickers.length + washiTapes.length + papers.length;

  const addGifAsset = useCallback((src: string, title?: string) => {
    const trimmed = src.trim();
    if (!trimmed) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxEdge = 220;
      const ratio = img.width / img.height;
      const width = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const height = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;
      onSaveSticker(title?.trim() || "Animated Sticker", trimmed, width, height, true);
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
    if (!q) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    setGifError(null);
    try {
      let url = "";
      if (GIF_PROVIDER === "giphy") {
        if (!GIPHY_KEY) {
          throw new Error("missing_giphy_key");
        }
        const params = new URLSearchParams({
          api_key: GIPHY_KEY,
          q,
          limit: "18",
          rating: "pg",
        });
        url = `https://api.giphy.com/v1/gifs/search?${params.toString()}`;
      } else {
        if (!GIFAPI_KEY) {
          throw new Error("missing_gifapi_key");
        }
        const params = new URLSearchParams({
          api_key: GIFAPI_KEY,
          q,
          limit: "18",
          rating: "pg",
        });
        url = `${GIFAPI_BASE_URL}/gifs/search?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("search_failed");
      const data = await res.json();
      const mapped = normalizeGifResults(data);
      setGifResults(mapped);
      if (mapped.length === 0) {
        setGifError("No GIFs found. Try a different search term.");
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      if (code === "missing_gifapi_key") {
        setGifError("Missing GIFAPI_KEY in env. Add it to enable GIF search.");
      } else if (code === "missing_giphy_key") {
        setGifError("Missing GIPHY_API_KEY in env for Giphy mode.");
      } else {
        setGifError("GIF search failed. Check your provider settings and try again.");
      }
    } finally {
      setGifLoading(false);
    }
  }, [gifQuery]);

  useEffect(() => {
    if (activeSection !== "extras") return;
    if (gifResults.length > 0 || gifLoading) return;
    void searchGifs();
  }, [activeSection, gifResults.length, gifLoading, searchGifs]);

  const addScrapbookPack = useCallback(() => {
    const make = (
      width: number,
      height: number,
      draw: (ctx: CanvasRenderingContext2D) => void
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      draw(ctx);
      return canvas.toDataURL("image/png");
    };

    const polaroid = make(240, 280, (ctx) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 240, 280);
      ctx.fillStyle = "#f6f1ff";
      ctx.fillRect(18, 18, 204, 188);
      ctx.strokeStyle = "rgba(167, 139, 250, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, 204, 188);
      ctx.fillStyle = "rgba(255, 107, 157, 0.28)";
      ctx.fillRect(16, 216, 208, 42);
    });

    const ticket = make(260, 120, (ctx) => {
      ctx.fillStyle = "#fff8e8";
      ctx.fillRect(0, 0, 260, 120);
      ctx.fillStyle = "rgba(251, 146, 60, 0.3)";
      ctx.fillRect(0, 84, 260, 36);
      ctx.fillStyle = "#d97706";
      ctx.font = '700 24px "Space Mono", monospace';
      ctx.fillText("MEMORIES", 28, 70);
    });

    const label = make(190, 70, (ctx) => {
      ctx.fillStyle = "#fdf2f8";
      ctx.fillRect(0, 0, 190, 70);
      ctx.strokeStyle = "rgba(244, 114, 182, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, 178, 58);
      ctx.fillStyle = "#be185d";
      ctx.font = '700 20px "Space Mono", monospace';
      ctx.fillText("NOTES", 56, 44);
    });

    if (polaroid) onSaveSticker("Polaroid Frame", polaroid, 240, 280);
    if (ticket) onSaveSticker("Ticket Stub", ticket, 260, 120);
    if (label) onSaveSticker("Label Tag", label, 190, 70);
  }, [onSaveSticker]);

  const setTool = useCallback(
    (tool: BrushSettings["tool"]) => {
      onBrushChange({ tool });
      if (tool === "pen" || tool === "eraser" || tool === "text" || tool === "select") {
        onDeselectAsset();
      }
    },
    [onBrushChange, onDeselectAsset]
  );

  const moveControl = useCallback((id: ToolbarControlId, direction: -1 | 1) => {
    setToolbarControls((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }, []);

  const toggleControl = useCallback((id: ToolbarControlId) => {
    setToolbarControls((prev) => {
      const enabledCount = prev.filter((item) => item.enabled).length;
      return prev.map((item) => {
        if (item.id !== id) return item;
        if (item.enabled && enabledCount <= 1) return item;
        return { ...item, enabled: !item.enabled };
      });
    });
  }, []);

  const activeControls = toolbarControls.filter((item) => item.enabled);
  const shownCollaborators = collaborators.slice(0, 5);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {drawerOpen ? (
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-40 max-h-[72vh] overflow-y-auto">
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
            selectedTextFont={selectedTextFont}
            selectedTextSize={selectedTextSize}
            customColor={customColor}
            colorChoices={colorChoices}
            gifQuery={gifQuery}
            gifResults={gifResults}
            gifLoading={gifLoading}
            gifError={gifError}
            gifUrlInput={gifUrlInput}
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
            setCustomColor={setCustomColor}
            setGifQuery={setGifQuery}
            searchGifs={searchGifs}
            addGifFromResult={addGifFromResult}
            setGifUrlInput={setGifUrlInput}
            addGifFromUrl={addGifFromUrl}
            addScrapbookPack={addScrapbookPack}
            onClear={onClear}
            assetSearch={assetSearch}
            setAssetSearch={setAssetSearch}
          />
        </div>
      ) : null}

      {customizeOpen ? (
        <div
          className="pointer-events-auto absolute left-20 top-1/2 z-40 w-72 -translate-y-1/2 rounded-2xl border p-3"
          style={{ background: "var(--surface-active)", borderColor: "var(--border-strong)", boxShadow: "0 10px 28px rgba(0,0,0,0.16)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Customize Toolbar
            </p>
            <button
              onClick={() => setCustomizeOpen(false)}
              className="btn-smooth rounded-lg px-2 py-1 text-[10px]"
              style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            {toolbarControls.map((control, index) => (
              <div
                key={control.id}
                className="flex items-center gap-2 rounded-xl border px-2 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <input
                  type="checkbox"
                  checked={control.enabled}
                  onChange={() => toggleControl(control.id)}
                  aria-label={`Toggle ${control.label}`}
                />
                <span className="flex-1 text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>
                  {control.label}
                </span>
                <button
                  onClick={() => moveControl(control.id, -1)}
                  disabled={index === 0}
                  className="btn-smooth rounded-lg px-2 py-1 text-[10px]"
                  style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}
                >
                  Up
                </button>
                <button
                  onClick={() => moveControl(control.id, 1)}
                  disabled={index === toolbarControls.length - 1}
                  className="btn-smooth rounded-lg px-2 py-1 text-[10px]"
                  style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}
                >
                  Down
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Left Menu Colors
            </p>
            <div className="grid grid-cols-4 gap-2">
              {userPalette.map((color, index) => (
                <label key={`${color}-${index}`} className="flex flex-col items-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUserPalette((prev) => prev.map((entry, i) => (i === index ? value : entry)));
                    }}
                    className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                  {index + 1}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 px-2 py-2.5 sm:left-4"
        style={{
          background: "rgba(255,255,255,0.94)",
          borderRadius: 20,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
        }}
      >
        {activeControls.map((control) => {
          if (control.id === "pen") {
            return (
              <RoundIconButton
                key={control.id}
                active={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive}
                onClick={() => setTool("pen")}
                title="Pen"
                label="Pen"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </RoundIconButton>
            );
          }

          if (control.id === "text") {
            return (
              <RoundIconButton key={control.id} active={brushSettings.tool === "text"} onClick={() => setTool("text")} title="Text" label="Text">
                <span className="text-sm font-bold" style={{ fontFamily: '"Space Mono", monospace', color: "#444" }}>
                  T
                </span>
              </RoundIconButton>
            );
          }

          if (control.id === "select") {
            return (
              <RoundIconButton key={control.id} active={brushSettings.tool === "select"} onClick={() => setTool("select")} title="Select" label="Select">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: "block", margin: "auto" }}>
                  <path d="M6 2v15.5l3.5-3.1 2 3.9 1.8-0.9-2-3.9H17L6 2z" stroke="#444" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </RoundIconButton>
            );
          }

          if (control.id === "eraser") {
            return (
              <RoundIconButton key={control.id} active={brushSettings.tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser" label="Erase">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 17l4-4" stroke="#444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </RoundIconButton>
            );
          }

          if (control.id === "drawer") {
            return (
              <RoundIconButton key={control.id} active={drawerOpen} onClick={() => setDrawerOpen((prev) => !prev)} title="Open Studio" label="Studio">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#444" strokeWidth="2" />
                </svg>
              </RoundIconButton>
            );
          }

          if (control.id === "undo") {
            return null;
          }

          if (control.id === "redo") return null;
          if (control.id === "export") return null;

          return null;
        })}

        {/* Divider before colors */}
        <div className="w-full" style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "2px 0" }} />

        {userPalette.map((color) => {
          const selected = brushSettings.color === color;
          return (
            <button
              key={color}
              onClick={() => {
                onBrushChange({ color, tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool });
                onDeselectAsset();
              }}
              className="btn-smooth rounded-full"
              style={{
                width: 26,
                height: 26,
                background: color,
                boxShadow: getSwatchShadow(selected, color),
              }}
              title={color}
            />
          );
        })}

        {/* Divider before customize */}
        <div className="w-full" style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "2px 0" }} />

        <RoundIconButton active={customizeOpen} onClick={() => setCustomizeOpen((prev) => !prev)} title="Customize toolbar" label="More">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z" stroke="#444" strokeWidth="2" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.2 1.2 0 1 1-2.4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.2 1.2 0 1 1 0-2.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.2 1.2 0 1 1 2.4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.2 1.2 0 1 1 0 2.4h-.2a1 1 0 0 0-.9.6z" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RoundIconButton>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 z-30 flex gap-2">
        {shownCollaborators.map((artist) => {
          const isSelf = artist.id === selfCollaboratorId;
          const initials = artist.name
            .split(" ")
            .map((part) => part.charAt(0).toUpperCase())
            .join("")
            .slice(0, 2) || "?";
          const hasSpace = !isSelf && Boolean(artist.username);

          const avatar = (
            <span
              className="relative flex items-center justify-center overflow-hidden rounded-full"
              style={{
                width: 38,
                height: 38,
                background: "linear-gradient(135deg, #e8e0f0, #d1c4f8)",
                border: `3px solid ${artist.color}`,
                boxShadow: "0 3px 10px rgba(0,0,0,0.14)",
                flexShrink: 0,
              }}
            >
              {artist.avatarUrl ? (
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-bold" style={{ color: "#6b4fa8" }}>
                  {initials}
                </span>
              )}
              {isSelf && (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full"
                  style={{ background: "#22c55e", border: "2px solid white" }}
                />
              )}
            </span>
          );

          return (
            <div key={artist.id} className="group relative flex flex-col items-center">
              {hasSpace ? (
                <a
                  href={`/space/${artist.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    onJumpToCollaborator(artist.id);
                    window.open(`/space/${artist.username}`, "_blank");
                  }}
                  className="btn-smooth"
                  aria-label={`${artist.name}'s space`}
                >
                  {avatar}
                </a>
              ) : (
                <button
                  onClick={() => onJumpToCollaborator(artist.id)}
                  className="btn-smooth"
                  aria-label={isSelf ? `${artist.name} (you)` : `Jump to ${artist.name}`}
                >
                  {avatar}
                </button>
              )}

              {/* Hover tooltip */}
              <div
                className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                style={{
                  background: "rgba(255,255,255,0.96)",
                  color: "var(--foreground)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                {isSelf ? `${artist.name} (you)` : artist.name}
                {hasSpace && (
                  <span className="ml-1 text-[10px]" style={{ color: "var(--purple)" }}>
                    · visit space ↗
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-auto absolute bottom-4 right-4 z-30 flex flex-col gap-2.5">
        {toolbarControls.some((control) => control.id === "undo" && control.enabled) ? (
          <button
            onClick={onUndo}
            className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
            title="Undo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 7h10a6 6 0 0 1 0 12H9" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 7l4-4M3 7l4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        {toolbarControls.some((control) => control.id === "redo" && control.enabled) ? (
          <button
            onClick={onRedo}
            className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
            title="Redo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 7H11a6 6 0 0 0 0 12h4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 7l-4-4M21 7l-4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        {toolbarControls.some((control) => control.id === "export" && control.enabled) ? (
          <button
            onClick={onExport}
            className="btn-smooth flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: "var(--pink)",
              boxShadow: "0 4px 14px rgba(255,107,157,0.4)",
            }}
            title="Export PNG"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v13" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 12l4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 20h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}