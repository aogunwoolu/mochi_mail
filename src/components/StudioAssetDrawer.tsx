
import React, { useMemo } from "react";
import { BrushSettings, CustomFont, PaperBackground, Sticker, WashiTape, ScrapbookKit, ScrapbookKitElement, StoreItem, ViewerIdentity } from "@/types";
import FontTracerCreator from "./FontTracerCreator";
import StickerCreator from "./StickerCreator";
import WashiTapeCreator from "./WashiTapeCreator";
import ScrapbookView from "./ScrapbookView";
import { exportImageAsset, exportFont } from "@/lib/exportAsset";
import { getSwatchShadow } from "@/lib/swatchUtils";

export type DrawerSection = "assets" | "paper" | "scrapbook" | "extras" | "fonts";

export type GifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  gifUrl: string;
  width: number;
  height: number;
};

const SECTION_LABELS: Record<DrawerSection, string> = {
  assets: "Stickers & Tape",
  paper: "Paper",
  scrapbook: "Scrapbook",
  extras: "Extras",
  fonts: "Fonts",
};


function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>{title}</p>
        {note ? <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>{note}</p> : null}
      </div>
    </div>
  );
}

function SectionChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-smooth whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all"
      style={{ background: active ? "var(--pink)" : "transparent", color: active ? "white" : "var(--muted-strong)" }}
    >
      {label}
    </button>
  );
}


export interface StudioAssetDrawerProps {
  assetCount: number;
  activeSection: DrawerSection;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  kitLibrary: ScrapbookKit[];
  shopKits: StoreItem[];
  viewer: ViewerIdentity;
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  brushSettings: BrushSettings;
  customColor: string;
  colorChoices: string[];
  gifQuery: string;
  gifResults: GifSearchResult[];
  gifLoading: boolean;
  gifError: string | null;
  gifUrlInput: string;
  assetSearch: string;
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
  onClear: () => void;
  setCustomColor: (value: string) => void;
  setGifQuery: (value: string) => void;
  searchGifs: () => void;
  addGifFromResult: (result: GifSearchResult) => void;
  setGifUrlInput: (value: string) => void;
  addGifFromUrl: () => void;
  onAddKitElement: (el: ScrapbookKitElement) => void;
  onAddKit: (kit: ScrapbookKit) => void;
  onAddKitToLibrary: (kit: ScrapbookKit) => void;
  onRemoveKit: (id: string) => void;
  onPublishKit: (kit: ScrapbookKit, publishToShop: boolean) => void;
  setAssetSearch: (value: string) => void;
}

export default function StudioAssetDrawer({
  assetCount, activeSection, stickers, washiTapes, papers, customFonts,
  kitLibrary, shopKits, viewer,
  selectedAsset, selectedPaper, brushSettings,
  customColor, colorChoices, gifQuery, gifResults, gifLoading, gifError, gifUrlInput,
  assetSearch, onClose, onSelectSection, onSelectSticker, onSelectWashi, onSelectPaper,
  onDeselectAsset, onDeleteSticker, onDeleteWashi, onDeletePaper, onDeleteCustomFont,
  onSaveSticker, onSaveWashi, onSaveCustomFont, onBrushChange, onClear,
  setCustomColor, setGifQuery, searchGifs, addGifFromResult, setGifUrlInput, addGifFromUrl,
  onAddKitElement, onAddKit, onAddKitToLibrary, onRemoveKit, onPublishKit,
  setAssetSearch,
}: Readonly<StudioAssetDrawerProps>) {
  const query = assetSearch.trim().toLowerCase();
  const filteredStickers = useMemo(() => stickers.filter((s) => s.name.toLowerCase().includes(query)), [stickers, query]);
  const filteredWashi = useMemo(() => washiTapes.filter((w) => w.name.toLowerCase().includes(query)), [washiTapes, query]);
  const filteredPapers = useMemo(() => papers.filter((p) => p.name.toLowerCase().includes(query)), [papers, query]);
  const filteredFonts = useMemo(() => customFonts.filter((f) => f.name.toLowerCase().includes(query)), [customFonts, query]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Studio</h3>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(167,139,250,0.12)", color: "var(--lavender)" }}>
            {assetCount} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="btn-smooth rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "rgba(251,146,60,0.1)", color: "var(--coral)" }}
          >
            Clear canvas
          </button>
          <button
            onClick={onClose}
            className="btn-smooth flex h-9 w-9 items-center justify-center rounded-full text-lg font-light"
            style={{ background: "rgba(0,0,0,0.05)", color: "var(--muted-strong)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div
        className="flex gap-1.5 overflow-x-auto px-4 pb-2"
        style={{ scrollbarWidth: "none", borderBottom: "1px solid rgba(186,156,214,0.15)" }}
      >
        {(["assets", "paper", "scrapbook", "extras", "fonts"] as DrawerSection[]).map((s) => (
          <SectionChip key={s} active={activeSection === s} label={SECTION_LABELS[s]} onClick={() => onSelectSection(s)} />
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(186,156,214,0.12)" }}>
        <div
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
          style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(186,156,214,0.2)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" stroke="#aaa" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#aaa" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            placeholder="Search stickers, paper, fonts…"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--foreground)" }}
          />
          {assetSearch ? (
            <button onClick={() => setAssetSearch("")} className="text-sm leading-none" style={{ color: "var(--muted)", flexShrink: 0 }} aria-label="Clear search">×</button>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* ── Stickers & Tape ── */}
        {activeSection === "assets" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel-soft p-4">
              <SectionTitle title="Stickers" note="Pick one, then click on the canvas to place it." />
              {filteredStickers.length === 0
                ? <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>No stickers match your search.</div>
                : (
                  <div className="grid grid-cols-4 gap-2 xl:grid-cols-5">
                    {filteredStickers.map((sticker) => {
                      const selected = selectedAsset?.id === sticker.id;
                      return (
                        <div key={sticker.id} className="group relative">
                          <button
                            onClick={() => { selected ? onDeselectAsset() : (onSelectSticker(sticker), onClose()); }}
                            className={`btn-smooth flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl p-1 ${selected ? "glow-pink" : ""}`}
                            style={{ background: selected ? "rgba(255,107,157,0.18)" : "var(--surface)", border: selected ? "1px solid rgba(255,107,157,0.35)" : "1px solid var(--border)" }}
                            title={sticker.name}
                          >
                            <img src={sticker.imageData} alt={sticker.name} className="max-h-full max-w-full object-contain" />
                          </button>
                          <button onClick={() => onDeleteSticker(sticker.id)} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex" style={{ background: "var(--pink)" }}>✕</button>
                          <button onClick={() => exportImageAsset(sticker.name, viewer.name, sticker.imageData)} className="absolute -left-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex" style={{ background: "var(--lavender)" }} title="Download PNG">↓</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              <div className="mt-4"><StickerCreator onSave={onSaveSticker} /></div>
            </div>

            <div className="panel-soft p-4">
              <SectionTitle title="Washi Tape" note="Choose a tape, then drag across the canvas to apply it." />
              {filteredWashi.length === 0
                ? <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>No tape rolls match your search.</div>
                : (
                  <div className="space-y-2">
                    {filteredWashi.map((tape) => {
                      const selected = selectedAsset?.id === tape.id;
                      return (
                        <div key={tape.id} className="flex items-center gap-2">
                          <button
                            onClick={() => { selected ? onDeselectAsset() : (onSelectWashi(tape), onClose()); }}
                            className={`btn-smooth flex h-11 flex-1 items-center overflow-hidden rounded-xl px-3 ${selected ? "glow-mint" : ""}`}
                            style={{ background: selected ? "rgba(110,231,183,0.14)" : "var(--surface)", border: selected ? "1px solid rgba(110,231,183,0.35)" : "1px solid var(--border)" }}
                          >
                            <div className="h-5 w-full overflow-hidden rounded" style={{ opacity: tape.opacity }}>
                              <img src={tape.imageData} alt={tape.name} className="h-full w-full object-cover" />
                            </div>
                          </button>
                          <button onClick={() => exportImageAsset(tape.name, viewer.name, tape.imageData)} className="btn-smooth flex h-9 w-9 items-center justify-center rounded-lg text-xs" style={{ color: "var(--lavender)", background: "var(--surface)" }} title="Download PNG">↓</button>
                          <button onClick={() => onDeleteWashi(tape.id)} className="btn-smooth flex h-9 w-9 items-center justify-center rounded-lg text-xs" style={{ color: "var(--muted)", background: "var(--surface)" }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              <div className="mt-4"><WashiTapeCreator onSave={onSaveWashi} /></div>
            </div>
          </div>
        )}

        {/* ── Paper ── */}
        {activeSection === "paper" && (
          <div className="panel-soft p-4">
            <SectionTitle title="Paper" note="Choose a background for your canvas." />
            {filteredPapers.length === 0
              ? <div className="rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>No paper backgrounds match your search.</div>
              : (
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {filteredPapers.map((paper) => {
                    const selected = selectedPaper?.id === paper.id;
                    return (
                      <div key={paper.id} className="group relative">
                        <button
                          onClick={() => { onSelectPaper(paper); onClose(); }}
                          className="btn-smooth w-full overflow-hidden rounded-2xl p-1"
                          style={{ background: selected ? "rgba(103,212,241,0.15)" : "var(--surface)", border: selected ? "1px solid rgba(103,212,241,0.4)" : "1px solid var(--border)" }}
                        >
                          <div className="mb-1.5 aspect-4/3 overflow-hidden rounded-xl">
                            <img src={paper.imageData} alt={paper.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="truncate px-1 pb-1 text-[10px] font-semibold" style={{ color: "var(--muted-strong)" }}>{paper.name}</div>
                        </button>
                        <button onClick={() => exportImageAsset(paper.name, viewer.name, paper.imageData)} className="absolute -left-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex" style={{ background: "var(--lavender)" }} title="Download PNG">↓</button>
                        {filteredPapers.length > 1 && (
                          <button onClick={() => onDeletePaper(paper.id)} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex" style={{ background: "var(--sky)" }}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {/* ── Scrapbook ── */}
        {activeSection === "scrapbook" && (
          <ScrapbookView
            kitLibrary={kitLibrary}
            shopKits={shopKits}
            userStickers={stickers}
            viewer={viewer}
            onAddElement={onAddKitElement}
            onAddKit={onAddKit}
            onAddKitToLibrary={onAddKitToLibrary}
            onRemoveKit={onRemoveKit}
            onPublishKit={onPublishKit}
          />
        )}

        {/* ── Extras (GIFs) ── */}
        {activeSection === "extras" && (
          <div className="panel-soft p-4 flex flex-col gap-5">

            {/* GIF Search */}
            <div>
              <SectionTitle title="Animated GIFs" note="Search Giphy or paste a GIF URL to add it as a sticker." />
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="mb-2 flex gap-2">
                  <input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchGifs(); }} placeholder="cats, sparkle, retro..." className="w-full rounded-lg border px-2 py-2 text-xs outline-none" style={{ borderColor: "var(--border)", background: "white" }} />
                  <button onClick={searchGifs} className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(103,212,241,0.2)", color: "#0e7490" }}>Search</button>
                </div>
                {gifError && <p className="mb-2 text-[11px]" style={{ color: "var(--coral)" }}>{gifError}</p>}
                {gifLoading && <p className="mb-2 text-[11px]" style={{ color: "var(--muted)" }}>Loading GIFs...</p>}
                {gifResults.length > 0
                  ? (
                    <div className="mb-3 grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                      {gifResults.map((gif) => (
                        <button key={gif.id} onClick={() => addGifFromResult(gif)} className="btn-smooth overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "white" }} title={`Add ${gif.title}`}>
                          <img src={gif.previewUrl} alt={gif.title} className="h-20 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )
                  : <p className="mb-3 text-[11px]" style={{ color: "var(--muted)" }}>Search for a GIF and click a result to add it.</p>}
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Or paste GIF URL</p>
                <div className="flex gap-2">
                  <input value={gifUrlInput} onChange={(e) => setGifUrlInput(e.target.value)} placeholder="https://...gif" className="w-full rounded-lg border px-2 py-2 text-xs outline-none" style={{ borderColor: "var(--border)", background: "white" }} />
                  <button onClick={addGifFromUrl} className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(103,212,241,0.2)", color: "#0e7490" }}>Add</button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Font Lab ── */}
        {activeSection === "fonts" && (
          <div className="panel-soft p-4">
            <SectionTitle title="Font Lab" note="Trace your own handwriting and use it as a font." />
            <FontTracerCreator onSave={onSaveCustomFont} />
            {filteredFonts.length > 0
              ? (
                <div className="mt-4 space-y-2">
                  {filteredFonts.map((font) => (
                    <div key={font.id} className="group flex items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <button onClick={() => onBrushChange({ textFont: `custom:${font.id}`, tool: "text" })} className="btn-smooth flex-1 text-left" style={{ color: "var(--muted-strong)" }}>
                        <div className="text-xs font-semibold">{font.name}</div>
                        <div className="text-[10px]" style={{ color: "var(--muted)" }}>Use this traced font for text mode</div>
                      </button>
                      <button onClick={() => exportFont(font, viewer.name)} className="btn-smooth rounded-lg px-2 py-1 text-[10px]" style={{ background: "rgba(167,139,250,0.15)", color: "var(--lavender)" }} title="Download font as JSON">↓ Export</button>
                      <button onClick={() => onDeleteCustomFont(font.id)} className="btn-smooth rounded-lg px-2 py-1 text-[10px]" style={{ background: "rgba(251,146,60,0.15)", color: "var(--coral)" }}>Delete</button>
                    </div>
                  ))}
                </div>
              )
              : <div className="mt-4 rounded-xl px-3 py-4 text-xs" style={{ background: "var(--surface)", color: "var(--muted)" }}>No fonts match your search.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
