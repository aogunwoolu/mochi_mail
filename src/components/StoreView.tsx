"use client";

import React, { useState } from "react";
import { StoreItem, Sticker, WashiTape, PaperBackground, CustomFont } from "@/types";

type StoreFilterType = "all" | "sticker" | "washi" | "background" | "font";

interface StoreViewProps {
  storeItems: StoreItem[];
  filterType: StoreFilterType;
  setFilterType: (type: StoreFilterType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isInCollection: (id: string) => boolean;
  addToCollection: (id: string) => void;
  removeFromCollection: (id: string) => void;
  onAddToAssets: (item: StoreItem) => void;
  // For publishing
  userStickers: Sticker[];
  userWashiTapes: WashiTape[];
  userPapers: PaperBackground[];
  userFonts: CustomFont[];
  onPublish: (item: Sticker | WashiTape | PaperBackground | CustomFont, itemType: StoreItem["type"], tags: string[]) => void;
}

function filterLabel(type: StoreFilterType): string {
  if (type === "all") return "All";
  if (type === "sticker") return "Stickers";
  if (type === "washi") return "Tape";
  if (type === "background") return "Paper";
  return "Fonts";
}

function itemTypeLabel(type: StoreItem["type"]): string {
  if (type === "background") return "Paper";
  if (type === "washi") return "Washi Tape";
  if (type === "font") return "Font";
  return "Sticker";
}

export default function StoreView({
  storeItems,
  filterType,
  setFilterType,
  searchQuery,
  setSearchQuery,
  isInCollection,
  addToCollection,
  removeFromCollection,
  onAddToAssets,
  userStickers,
  userWashiTapes,
  userPapers,
  userFonts,
  onPublish,
}: Readonly<StoreViewProps>) {
  const [showPublish, setShowPublish] = useState(false);
  const [publishTags, setPublishTags] = useState("");
  const [selectedPublish, setSelectedPublish] = useState<{ id: string; type: StoreItem["type"] } | null>(null);

  const allUserAssets = [
    ...userStickers.map((s) => ({ ...s, assetType: "sticker" as const })),
    ...userWashiTapes.map((t) => ({ ...t, assetType: "washi" as const })),
    ...userPapers.map((p) => ({ ...p, assetType: "background" as const })),
    ...userFonts.map((f) => ({
      ...f,
      assetType: "font" as const,
      imageData: f.glyphs["A"] ?? f.glyphs["a"] ?? Object.values(f.glyphs)[0] ?? "",
      width: f.glyphWidth,
      height: f.glyphHeight,
    })),
  ];

  const handlePublish = () => {
    if (!selectedPublish) return;
    const item = allUserAssets.find(
      (asset) => asset.id === selectedPublish.id && asset.assetType === selectedPublish.type
    );
    if (!item) return;
    const tags = publishTags.split(",").map((t) => t.trim()).filter(Boolean);
    onPublish(item, selectedPublish.type, tags);
    setShowPublish(false);
    setPublishTags("");
    setSelectedPublish(null);
  };

  return (
    <div className="animate-fade-in panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Community Store</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Share your stickers, washi tape, paper themes, and custom fonts.
          </p>
        </div>
      </div>
      {/* Search + Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stickers, tape, paper, or fonts..."
            className="input-soft py-2.5 pl-10 pr-4 text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>🔍</span>
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface)" }}>
          {(["all", "sticker", "washi", "background", "font"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold capitalize`}
              style={{
                background: filterType === type ? "rgba(167,139,250,0.2)" : "transparent",
                color: filterType === type ? "var(--lavender)" : "var(--muted)",
              }}
            >
              {filterLabel(type)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowPublish(!showPublish)}
          className="btn-smooth rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", color: "white" }}
        >
          + Publish
        </button>
      </div>

      {/* Publish panel */}
      {showPublish && (
        <div className="panel-soft mb-4 animate-fade-in p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pink)" }}>
            Publish to Store
          </div>
          {allUserAssets.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: "var(--muted)" }}>
              No assets to publish. Create stickers or tape first!
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {allUserAssets.map((asset) => (
                  <button
                    key={`${asset.assetType}-${asset.id}`}
                    onClick={() => setSelectedPublish({ id: asset.id, type: asset.assetType })}
                    className={`btn-smooth flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl p-1`}
                    style={{
                      background:
                        selectedPublish?.id === asset.id && selectedPublish.type === asset.assetType
                          ? "rgba(255,107,157,0.15)"
                          : "var(--surface)",
                      border:
                        selectedPublish?.id === asset.id && selectedPublish.type === asset.assetType
                          ? "1px solid rgba(255,107,157,0.4)"
                          : "1px solid var(--border)",
                    }}
                  >
                    <div className={`overflow-hidden rounded ${asset.assetType === "background" || asset.assetType === "font" ? "h-10 w-14" : "h-14 w-14"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.imageData} alt={asset.name} className="h-full w-full object-cover" style={{ imageRendering: asset.assetType === "background" || asset.assetType === "font" ? "auto" : "pixelated" }} />
                    </div>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={publishTags}
                onChange={(e) => setPublishTags(e.target.value)}
                placeholder="Tags (comma separated)..."
                className="input-soft mb-3 px-3 py-2 text-xs outline-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <button
                onClick={handlePublish}
                disabled={!selectedPublish}
                className="btn-smooth w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-30"
                style={{ background: "var(--pink)" }}
              >
                Publish ✨
              </button>
            </>
          )}
        </div>
      )}

      {/* Store Grid */}
      {storeItems.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-5xl opacity-40">🏪</div>
          <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            {searchQuery ? "No matching goodies found" : "Store is empty"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {storeItems.map((item) => {
            const inCollection = isInCollection(item.id);
            return (
              <div
                key={item.id}
                className="glass group rounded-2xl p-3 transition-all hover:scale-[1.02]"
              >
                <div className={`mb-2 flex items-center justify-center overflow-hidden rounded-xl ${item.type === "background" || item.type === "font" ? "aspect-4/3" : "aspect-square"}`} style={{ background: "rgba(255,255,255,0.03)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageData}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    style={{ imageRendering: item.type === "background" || item.type === "font" ? "auto" : "pixelated", opacity: item.type === "washi" ? item.opacity ?? 0.7 : 1 }}
                  />
                </div>
                <div className="mb-1 truncate text-sm font-semibold">{item.name}</div>
                <div className="mb-2 flex items-center justify-between text-[10px]" style={{ color: "var(--muted)" }}>
                  <span>{item.authorName}</span>
                  <span>{item.downloads} ⬇</span>
                </div>
                <div className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  {itemTypeLabel(item.type)}
                </div>
                {item.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => inCollection ? removeFromCollection(item.id) : addToCollection(item.id)}
                    className={`btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold`}
                    style={{
                      background: inCollection ? "rgba(110,231,183,0.15)" : "var(--surface)",
                      color: inCollection ? "var(--mint)" : "var(--muted-strong)",
                      border: inCollection ? "1px solid rgba(110,231,183,0.3)" : "1px solid var(--border)",
                    }}
                  >
                    {inCollection ? "✓ Saved" : "♡ Save"}
                  </button>
                  <button
                    onClick={() => onAddToAssets(item)}
                    className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--surface)", color: "var(--lavender)", border: "1px solid var(--border)" }}
                    title="Add to your assets"
                  >
                    {item.type === "background" || item.type === "font" ? "Use" : "+"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
