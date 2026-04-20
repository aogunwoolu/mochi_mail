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
  { value: '"Courier New", monospace', label: "Courier New" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: '"Trebuchet MS", sans-serif', label: "Trebuchet" },
  { value: '"Comic Sans MS", cursive', label: "Comic Sans" },
] as const;

type SelectedAsset = Sticker | WashiTape;
type DrawerSection = "assets" | "paper" | "type" | "extras" | "fonts";

interface StudioToolbarProps {
  brushSettings: BrushSettings;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  onUndo: () => void;
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
  onSaveSticker: (name: string, imageData: string, w: number, h: number) => void;
  onSaveWashi: (
    name: string,
    imageData: string,
    opacity: number,
    w: number,
    h: number
  ) => void;
  onSaveCustomFont: (
    name: string,
    glyphs: Record<string, string>,
    glyphWidth: number,
    glyphHeight: number
  ) => void;
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
  gifName: string;
  gifUrl: string;
  colorChoices: string[];
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
  onSaveCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  setCustomColor: (value: string) => void;
  setGifName: (value: string) => void;
  setGifUrl: (value: string) => void;
  addGifSticker: () => void;
  addScrapbookPack: () => void;
}

function getSwatchShadow(isSelected: boolean, color: string): string {
  if (isSelected) return `0 0 0 2px white, 0 0 0 3.5px ${color}`;
  if (color === "#ffffff") return "inset 0 0 0 1px rgba(0,0,0,0.12)";
  return "none";
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

function getToolbarStatusLabel(
  selectedAsset: SelectedAsset | null,
  tool: BrushSettings["tool"],
  textSize: number,
  size: number
): string {
  if (selectedAsset) return "asset ready";
  if (tool === "text") return `${textSize}px type`;
  return `${size}px brush`;
}

function SectionChip({
  active,
  label,
  onClick,
}: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="btn-smooth rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{
        background: active ? "rgba(255,107,157,0.16)" : "var(--surface)",
        color: active ? "var(--pink)" : "var(--muted-strong)",
        border: active ? "1px solid rgba(255,107,157,0.3)" : "1px solid var(--border)",
      }}
    >
      {label}
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
  gifName,
  gifUrl,
  colorChoices,
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
  setGifName,
  setGifUrl,
  addGifSticker,
  addScrapbookPack,
}: Readonly<StudioAssetDrawerProps>) {
  return (
    <div
      className="glass-strong animate-slide-up"
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        borderTop: "1px solid var(--border-strong)",
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <h3 className="text-sm font-semibold">Tools & Assets</h3>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Your brush controls, asset library, paper presets, and scrapbook tools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-full px-3 py-1 text-[10px] font-semibold sm:block" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
            {assetCount} assets · {customFonts.length} fonts
          </div>
          <button
            onClick={onClose}
            className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <SectionChip active={activeSection === "assets"} label="Assets" onClick={() => onSelectSection("assets")} />
        <SectionChip active={activeSection === "paper"} label="Paper" onClick={() => onSelectSection("paper")} />
        <SectionChip active={activeSection === "type"} label="Type" onClick={() => onSelectSection("type")} />
        <SectionChip active={activeSection === "extras"} label="Scrapbook" onClick={() => onSelectSection("extras")} />
        <SectionChip active={activeSection === "fonts"} label="Fonts" onClick={() => onSelectSection("fonts")} />
      </div>

      <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {activeSection === "assets" ? (
            <div className="space-y-4">
              <div className="panel-soft p-4">
                <SectionTitle title="Stickers" note="Tap to place on the canvas." />
                {stickers.length === 0 ? (
                  <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    No stickers yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stickers.map((sticker) => (
                      <div key={sticker.id} className="group relative">
                        <button
                          onClick={() => {
                            if (selectedAsset?.id === sticker.id) {
                              onDeselectAsset();
                            } else {
                              onSelectSticker(sticker);
                              onClose();
                            }
                          }}
                          className={`btn-smooth flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl p-1 ${selectedAsset?.id === sticker.id ? "glow-pink" : ""}`}
                          style={{
                            background: selectedAsset?.id === sticker.id ? "rgba(255,107,157,0.18)" : "var(--surface)",
                            border: selectedAsset?.id === sticker.id ? "1px solid rgba(255,107,157,0.35)" : "1px solid var(--border)",
                          }}
                          title={sticker.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sticker.imageData} alt={sticker.name} className="max-h-full max-w-full object-contain" style={{ imageRendering: "pixelated" }} />
                        </button>
                        <button
                          onClick={() => onDeleteSticker(sticker.id)}
                          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex"
                          style={{ background: "var(--pink)" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <StickerCreator onSave={onSaveSticker} />
                </div>
              </div>

              <div className="panel-soft p-4">
                <SectionTitle title="Tape" note="Select a roll, then drag to lay it down." />
                {washiTapes.length === 0 ? (
                  <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    No tape rolls yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {washiTapes.map((tape) => (
                      <div key={tape.id} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (selectedAsset?.id === tape.id) {
                              onDeselectAsset();
                            } else {
                              onSelectWashi(tape);
                              onClose();
                            }
                          }}
                          className={`btn-smooth flex h-11 flex-1 items-center overflow-hidden rounded-xl px-3 ${selectedAsset?.id === tape.id ? "glow-mint" : ""}`}
                          style={{
                            background: selectedAsset?.id === tape.id ? "rgba(110,231,183,0.14)" : "var(--surface)",
                            border: selectedAsset?.id === tape.id ? "1px solid rgba(110,231,183,0.35)" : "1px solid var(--border)",
                          }}
                        >
                          <div className="h-5 w-full overflow-hidden rounded" style={{ opacity: tape.opacity }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tape.imageData} alt={tape.name} className="h-full w-full object-cover" style={{ imageRendering: "pixelated" }} />
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
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <WashiTapeCreator onSave={onSaveWashi} />
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "paper" ? (
            <div className="space-y-4">
              <div className="panel-soft p-4">
                <SectionTitle title="Paper" note="Choose a stationery base for the infinite canvas." />
                {papers.length === 0 ? (
                  <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    No paper backgrounds available.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {papers.map((paper) => (
                      <div key={paper.id} className="group relative">
                        <button
                          onClick={() => {
                            onSelectPaper(paper);
                            onClose();
                          }}
                          className="btn-smooth w-full overflow-hidden rounded-2xl p-1"
                          style={{
                            background: selectedPaper?.id === paper.id ? "rgba(103,212,241,0.15)" : "var(--surface)",
                            border: selectedPaper?.id === paper.id ? "1px solid rgba(103,212,241,0.4)" : "1px solid var(--border)",
                          }}
                        >
                          <div className="mb-1.5 aspect-4/3 overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={paper.imageData} alt={paper.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="truncate px-1 pb-1 text-[10px] font-semibold" style={{ color: "var(--muted-strong)" }}>
                            {paper.name}
                          </div>
                        </button>
                        {papers.length > 1 ? (
                          <button
                            onClick={() => onDeletePaper(paper.id)}
                            className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex"
                            style={{ background: "var(--sky)" }}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeSection === "type" ? (
            <div className="space-y-4 lg:col-span-2">
            <div className="panel-soft p-4">
              <SectionTitle title="Type & Color" note="Adjust type settings, pick colors, and switch fonts." />
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
                      const isSelected = brushSettings.color === color;
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            onBrushChange({ color, tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool });
                            onDeselectAsset();
                          }}
                          className="btn-smooth rounded-full"
                          style={{
                            width: isSelected ? 24 : 20,
                            height: isSelected ? 24 : 20,
                            background: color,
                            boxShadow: getSwatchShadow(isSelected, color),
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
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                    {customFonts.map((font) => (
                      <option key={font.id} value={`custom:${font.id}`}>{font.name}</option>
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
              <SectionTitle title="Scrapbook Lab" note="Build deeper stationery elements and animated pieces." />
              <div className="grid gap-3">
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                    Starter Pack
                  </p>
                  <p className="mb-3 text-xs" style={{ color: "var(--muted-strong)" }}>
                    Frames, labels, and ephemera for more detailed pages.
                  </p>
                  <button
                    onClick={addScrapbookPack}
                    className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: "rgba(251,146,60,0.18)", color: "var(--coral)" }}
                  >
                    + Add Scrapbook Pack
                  </button>
                </div>

                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                    GIF / Image Import
                  </p>
                  <input
                    value={gifName}
                    onChange={(e) => setGifName(e.target.value)}
                    placeholder="Name"
                    className="mb-2 w-full rounded-lg border px-2 py-2 text-xs outline-none"
                    style={{ borderColor: "var(--border)", background: "white" }}
                  />
                  <input
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    placeholder="https://...gif"
                    className="mb-2 w-full rounded-lg border px-2 py-2 text-xs outline-none"
                    style={{ borderColor: "var(--border)", background: "white" }}
                  />
                  <button
                    onClick={addGifSticker}
                    className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: "rgba(103,212,241,0.18)", color: "var(--sky)" }}
                  >
                    + Add GIF Element
                  </button>
                </div>
              </div>
            </div>
            </div>
          ) : null}

          {activeSection === "fonts" ? (
            <div className="space-y-4 lg:col-span-2">
            <div className="panel-soft p-4">
              <SectionTitle title="Font Lab" note="Trace a lettering set and reuse it anywhere." />
              <FontTracerCreator onSave={onSaveCustomFont} />
              {customFonts.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {customFonts.map((font) => (
                    <div key={font.id} className="group flex items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
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
              ) : null}
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
}: Readonly<StudioToolbarProps>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>("assets");
  const [gifUrl, setGifUrl] = useState("");
  const [gifName, setGifName] = useState("Animated Deco");
  const [customColor, setCustomColor] = useState(brushSettings.color);

  useEffect(() => {
    setCustomColor(brushSettings.color);
  }, [brushSettings.color]);

  const isStickerActive = brushSettings.tool === "sticker" && selectedAsset !== null;
  const isWashiActive = brushSettings.tool === "washi" && selectedAsset !== null;
  const selectedTextFont = brushSettings.textFont ?? BUILTIN_TEXT_FONTS[0].value;
  const selectedTextSize = brushSettings.textSize ?? 34;

  const assetCount = stickers.length + washiTapes.length + papers.length;

  const colorChoices = useMemo(() => PASTEL_COLORS.slice(0, 10), []);

  const addGifSticker = useCallback(() => {
    const src = gifUrl.trim();
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxEdge = 220;
      const ratio = img.width / img.height;
      const width = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const height = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;
      onSaveSticker(gifName.trim() || "Animated Deco", src, width, height);
      setGifUrl("");
      setDrawerOpen(true);
    };
    img.src = src;
  }, [gifName, gifUrl, onSaveSticker]);

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
      if (tool === "pen" || tool === "eraser" || tool === "text") {
        onDeselectAsset();
      }
    },
    [onBrushChange, onDeselectAsset]
  );

  const openSection = useCallback((section: DrawerSection) => {
    setActiveSection(section);
    setDrawerOpen(true);
  }, []);

  const toolbarStatus = getToolbarStatusLabel(
    selectedAsset,
    brushSettings.tool,
    selectedTextSize,
    brushSettings.size
  );

  return (
    <div className="relative z-20 shrink-0" style={{ borderTop: "1px solid var(--border-strong)" }}>
      {drawerOpen ? (
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
          gifName={gifName}
          gifUrl={gifUrl}
          colorChoices={colorChoices}
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
          setGifName={setGifName}
          setGifUrl={setGifUrl}
          addGifSticker={addGifSticker}
          addScrapbookPack={addScrapbookPack}
        />
      ) : null}

      <div className="glass-strong flex h-15 items-center gap-2 overflow-x-auto px-3">
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl p-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {[
            { tool: "pen" as const, icon: "✏️", label: "Pen" },
            { tool: "text" as const, icon: "T", label: "Text" },
            { tool: "eraser" as const, icon: "⌫", label: "Erase" },
          ].map(({ tool, icon, label }) => {
            const isActive = brushSettings.tool === tool && !isStickerActive && !isWashiActive;
            return (
              <button
                key={tool}
                onClick={() => setTool(tool)}
                className="btn-smooth flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
                style={{
                  background: isActive ? "rgba(167,139,250,0.22)" : "transparent",
                  color: isActive ? "var(--lavender)" : "var(--muted)",
                  border: isActive ? "1px solid rgba(167,139,250,0.35)" : "1px solid transparent",
                  fontFamily: tool === "text" ? '"Space Mono", monospace' : undefined,
                }}
                title={label}
              >
                <span className="text-sm">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="btn-smooth flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold"
            style={{
              background: drawerOpen ? "rgba(255,107,157,0.15)" : "transparent",
              color: drawerOpen ? "var(--pink)" : "var(--muted-strong)",
            }}
          >
            <span className="h-4 w-4 rounded-full border" style={{ background: brushSettings.color, borderColor: "rgba(0,0,0,0.08)", boxShadow: getSwatchShadow(true, brushSettings.color) }} />
            <span>Assets</span>
          </button>
          <div className="hidden text-[10px] sm:block" style={{ color: "var(--muted)" }}>
            {toolbarStatus}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1 rounded-xl p-1 md:flex" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {[
            { id: "assets" as const, label: "Assets" },
            { id: "paper" as const, label: "Paper" },
            { id: "type" as const, label: "Type" },
            { id: "extras" as const, label: "Scrap" },
            { id: "fonts" as const, label: "Fonts" },
          ].map((section) => {
            const selected = drawerOpen && activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => openSection(section.id)}
                className="btn-smooth rounded-lg px-2 py-1 text-[10px] font-semibold"
                style={{
                  background: selected ? "rgba(255,107,157,0.14)" : "transparent",
                  color: selected ? "var(--pink)" : "var(--muted-strong)",
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
            {brushSettings.tool === "text" ? "Type" : "Brush"}
          </span>
          <input
            type="range"
            min={brushSettings.tool === "text" ? 12 : 2}
            max={brushSettings.tool === "text" ? 120 : 32}
            value={brushSettings.tool === "text" ? selectedTextSize : brushSettings.size}
            onChange={(e) =>
              brushSettings.tool === "text"
                ? onBrushChange({ textSize: Number(e.target.value) })
                : onBrushChange({ size: Number(e.target.value) })
            }
            className="min-w-20 flex-1"
            title={brushSettings.tool === "text" ? "Text size" : "Brush size"}
          />
          <span className="w-10 text-right text-[10px] font-semibold" style={{ color: "var(--muted-strong)" }}>
            {brushSettings.tool === "text" ? `${selectedTextSize}px` : `${brushSettings.size}px`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-xl p-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {[
            { label: "↩", onClick: onUndo, title: "Undo" },
            { label: "⌫", onClick: onClear, title: "Clear all" },
            { label: "↓", onClick: onExport, title: "Export PNG" },
          ].map((button) => (
            <button
              key={button.title}
              onClick={button.onClick}
              className="btn-smooth flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold"
              style={{ color: "var(--muted)", background: "transparent" }}
              title={button.title}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
