
import React, { useState, useRef, useEffect, useCallback } from "react";
import { StoreItem, Sticker, WashiTape, PaperBackground, CustomFont, MailStamp, EnvelopeStyle } from "@/types";

type AssetCategory = "all" | "sticker" | "washi" | "background" | "stamp" | "envelope" | "font";

interface FlatAsset {
  id: string;
  name: string;
  imageData: string;
  assetType: Exclude<StoreItem["type"], "kit">;
  pixelated: boolean;
  opacity?: number;
}

function categoryLabel(c: AssetCategory): string {
  if (c === "all") return "All";
  if (c === "sticker") return "Stickers";
  if (c === "washi") return "Tape";
  if (c === "background") return "Paper";
  if (c === "stamp") return "Stamps";
  if (c === "envelope") return "Envelopes";
  return "Fonts";
}

function typeLabel(t: FlatAsset["assetType"]): string {
  if (t === "background") return "Paper";
  if (t === "washi") return "Washi Tape";
  if (t === "font") return "Font";
  if (t === "stamp") return "Stamp";
  if (t === "envelope") return "Envelope";
  return "Sticker";
}

interface PublishModalProps {
  userStickers: Sticker[];
  userWashiTapes: WashiTape[];
  userPapers: PaperBackground[];
  userStamps: MailStamp[];
  userEnvelopes: EnvelopeStyle[];
  userFonts: CustomFont[];
  onPublish: (
    item: Sticker | WashiTape | PaperBackground | CustomFont | MailStamp | EnvelopeStyle,
    itemType: StoreItem["type"],
    tags: string[]
  ) => void;
  onClose: () => void;
}

const CATEGORIES: AssetCategory[] = ["all", "sticker", "washi", "background", "stamp", "envelope", "font"];

export default function PublishModal({
  userStickers,
  userWashiTapes,
  userPapers,
  userStamps,
  userEnvelopes,
  userFonts,
  onPublish,
  onClose,
}: Readonly<PublishModalProps>) {
  const [category, setCategory] = useState<AssetCategory>("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<FlatAsset["assetType"] | null>(null);
  const [assetName, setAssetName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const allAssets: FlatAsset[] = [
    ...userStickers.map((s) => ({ id: s.id, name: s.name, imageData: s.imageData, assetType: "sticker" as const, pixelated: true })),
    ...userWashiTapes.map((t) => ({ id: t.id, name: t.name, imageData: t.imageData, assetType: "washi" as const, pixelated: false, opacity: t.opacity })),
    ...userPapers.map((p) => ({ id: p.id, name: p.name, imageData: p.imageData, assetType: "background" as const, pixelated: false })),
    ...userStamps.map((s) => ({ id: s.id, name: s.name, imageData: s.imageData, assetType: "stamp" as const, pixelated: true })),
    ...userEnvelopes.map((e) => ({ id: e.id, name: e.name, imageData: e.imageData, assetType: "envelope" as const, pixelated: false })),
    ...userFonts.map((f) => ({
      id: f.id,
      name: f.name,
      imageData: f.glyphs["A"] ?? f.glyphs["a"] ?? Object.values(f.glyphs)[0] ?? "",
      assetType: "font" as const,
      pixelated: false,
    })),
  ];

  const visibleAssets = allAssets.filter((a) => {
    if (category !== "all" && a.assetType !== category) return false;
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.assetType.includes(q);
    }
    return true;
  });

  const selectedAsset = selectedId && selectedType
    ? allAssets.find((a) => a.id === selectedId && a.assetType === selectedType) ?? null
    : null;

  const selectAsset = useCallback((a: FlatAsset) => {
    setSelectedId(a.id);
    setSelectedType(a.assetType);
    setAssetName(a.name);
    setTags([]);
    setTagInput("");
  }, []);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().replace(/,+$/, "");
    if (!trimmed || tags.includes(trimmed) || tags.length >= 10) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handlePublish = () => {
    if (!selectedAsset || !selectedType) return;

    const originalFont = selectedType === "font"
      ? userFonts.find((f) => f.id === selectedAsset.id) ?? null
      : null;
    const originalSticker = selectedType === "sticker"
      ? userStickers.find((s) => s.id === selectedAsset.id) ?? null
      : null;
    const originalWashi = selectedType === "washi"
      ? userWashiTapes.find((t) => t.id === selectedAsset.id) ?? null
      : null;
    const originalPaper = selectedType === "background"
      ? userPapers.find((p) => p.id === selectedAsset.id) ?? null
      : null;
    const originalStamp = selectedType === "stamp"
      ? userStamps.find((s) => s.id === selectedAsset.id) ?? null
      : null;
    const originalEnvelope = selectedType === "envelope"
      ? userEnvelopes.find((e) => e.id === selectedAsset.id) ?? null
      : null;

    const original = originalFont ?? originalSticker ?? originalWashi ?? originalPaper ?? originalStamp ?? originalEnvelope;
    if (!original) return;

    const named = assetName.trim() || original.name;
    const namedOriginal = { ...original, name: named };

    onPublish(namedOriginal, selectedType, tags);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const canPublish = !!selectedAsset && assetName.trim().length > 0;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="animate-fade-in relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
        style={{
          background: "var(--background)",
          border: "1.5px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          maxHeight: "90vh",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-base font-bold">Publish to Store</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Share your creations with the community
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-sm"
            style={{ background: "var(--surface)", color: "var(--muted)" }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">

          {/* ── Left: Asset picker ─────────────────────────────── */}
          <div
            className="flex shrink-0 flex-col sm:w-64"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            {/* Category pills */}
            <div
              className="flex shrink-0 gap-1 overflow-x-auto px-3 py-2 scrollbar-none"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="btn-smooth shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: category === c ? "rgba(167,139,250,0.18)" : "transparent",
                    color: category === c ? "var(--lavender)" : "var(--muted)",
                  }}
                >
                  {categoryLabel(c)}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative shrink-0 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search assets…"
                className="input-soft w-full py-1.5 pl-7 pr-3 text-xs outline-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <span className="absolute left-5.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--muted)" }}>🔍</span>
            </div>

            {/* Grid */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {visibleAssets.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: "var(--muted)" }}>
                  {allAssets.length === 0
                    ? "Create some assets in the studio first."
                    : "No assets match."}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {visibleAssets.map((a) => {
                    const isSelected = a.id === selectedId && a.assetType === selectedType;
                    return (
                      <button
                        key={`${a.assetType}-${a.id}`}
                        onClick={() => selectAsset(a)}
                        className="btn-smooth group flex flex-col items-center gap-1 rounded-xl p-1.5"
                        style={{
                          background: isSelected ? "rgba(255,107,157,0.12)" : "var(--surface)",
                          border: isSelected
                            ? "1.5px solid rgba(255,107,157,0.55)"
                            : "1.5px solid var(--border)",
                          outline: "none",
                        }}
                        title={a.name}
                      >
                        <div
                          className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-lg"
                          style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.imageData}
                            alt={a.name}
                            className="h-full w-full object-cover"
                            style={{
                              imageRendering: a.pixelated ? "pixelated" : "auto",
                              opacity: a.assetType === "washi" ? (a.opacity ?? 0.7) : 1,
                            }}
                          />
                          {isSelected && (
                            <div
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ background: "rgba(255,107,157,0.25)" }}
                            >
                              <span className="text-lg">✓</span>
                            </div>
                          )}
                        </div>
                        <span
                          className="w-full truncate text-center text-[9px] leading-tight"
                          style={{ color: isSelected ? "var(--pink)" : "var(--muted)" }}
                        >
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Details ─────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            {!selectedAsset ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-2xl"
                  style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
                >
                  <span className="text-3xl opacity-30">🖼️</span>
                </div>
                <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
                  Pick an asset from the left to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Preview */}
                <div
                  className="relative flex items-center justify-center overflow-hidden rounded-2xl"
                  style={{
                    height: "180px",
                    background: "var(--surface)",
                    border: "1.5px solid var(--border)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedAsset.imageData}
                    alt={selectedAsset.name}
                    className="h-full w-full object-contain p-3"
                    style={{
                      imageRendering: selectedAsset.pixelated ? "pixelated" : "auto",
                      opacity: selectedAsset.assetType === "washi" ? (selectedAsset.opacity ?? 0.7) : 1,
                    }}
                  />
                  <span
                    className="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "rgba(167,139,250,0.2)", color: "var(--lavender)" }}
                  >
                    {typeLabel(selectedAsset.assetType)}
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                  >
                    Listing name
                  </label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Give your listing a name…"
                    className="input-soft w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                    maxLength={60}
                  />
                  <p className="mt-0.5 text-right text-[10px]" style={{ color: "var(--muted)" }}>
                    {assetName.length}/60
                  </p>
                </div>

                {/* Tags */}
                <div>
                  <label
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                  >
                    Tags
                    <span className="ml-1 normal-case tracking-normal font-normal" style={{ color: "var(--muted)" }}>
                      — press Enter or comma to add
                    </span>
                  </label>
                  <div
                    className="flex min-h-10 flex-wrap gap-1.5 rounded-xl px-3 py-2 cursor-text"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    onClick={() => tagInputRef.current?.focus()}
                  >
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: "rgba(167,139,250,0.18)", color: "var(--lavender)" }}
                      >
                        {tag}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                          className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
                          tabIndex={-1}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={addTag}
                      placeholder={tags.length === 0 ? "cute, pixel, pastel…" : ""}
                      className="min-w-20 flex-1 bg-transparent text-xs outline-none"
                      style={{ color: "var(--foreground)" }}
                      maxLength={30}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted)" }}>
                    {tags.length}/10 tags · Help people discover your work
                  </p>
                </div>

                {/* Publish button */}
                <button
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className="btn-smooth mt-auto w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-30"
                  style={{
                    background: canPublish
                      ? "linear-gradient(135deg, var(--pink), var(--lavender))"
                      : "var(--surface)",
                  }}
                >
                  Publish to Store ✨
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
