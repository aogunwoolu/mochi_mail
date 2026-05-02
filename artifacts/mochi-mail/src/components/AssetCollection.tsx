"use client";

import React from "react";
import { Sticker, WashiTape, Tool } from "@/types";

interface AssetCollectionProps {
  stickers: Sticker[];
  washiTapes: WashiTape[];
  selectedAsset: Sticker | WashiTape | null;
  onSelectAsset: (asset: Sticker | WashiTape, tool: Tool) => void;
  onDeselectAsset: () => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
}

export default function AssetCollection({
  stickers,
  washiTapes,
  selectedAsset,
  onSelectAsset,
  onDeselectAsset,
  onDeleteSticker,
  onDeleteWashi,
}: AssetCollectionProps) {
  const hasAssets = stickers.length > 0 || washiTapes.length > 0;

  if (!hasAssets) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ border: "1px dashed var(--border-strong)", background: "var(--surface)" }}>
        <div className="text-2xl">📦</div>
        <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Your collection is empty!
          <br />
          Create stickers & tape above
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        📦 Collection
      </div>

      {stickers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>Stickers</div>
          <div className="flex flex-wrap gap-2">
            {stickers.map((sticker) => (
              <div key={sticker.id} className="group relative">
                <button
                  onClick={() => selectedAsset?.id === sticker.id ? onDeselectAsset() : onSelectAsset(sticker, "sticker")}
                  className={`btn-smooth flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl p-1 ${
                    selectedAsset?.id === sticker.id ? "glow-pink" : ""
                  }`}
                  style={{
                    background: selectedAsset?.id === sticker.id ? "rgba(255,107,157,0.15)" : "var(--surface)",
                    border: selectedAsset?.id === sticker.id ? "1px solid rgba(255,107,157,0.4)" : "1px solid var(--border)",
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
        </div>
      )}

      {washiTapes.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>Washi Tape</div>
          <div className="flex flex-col gap-2">
            {washiTapes.map((tape) => (
              <div key={tape.id} className="group relative">
                <button
                  onClick={() => selectedAsset?.id === tape.id ? onDeselectAsset() : onSelectAsset(tape, "washi")}
                  className={`btn-smooth flex w-full items-center overflow-hidden rounded-xl p-2 ${
                    selectedAsset?.id === tape.id ? "glow-mint" : ""
                  }`}
                  style={{
                    background: selectedAsset?.id === tape.id ? "rgba(110,231,183,0.1)" : "var(--surface)",
                    border: selectedAsset?.id === tape.id ? "1px solid rgba(110,231,183,0.3)" : "1px solid var(--border)",
                  }}
                  title={tape.name}
                >
                  <div className="h-6 w-full overflow-hidden rounded" style={{ opacity: tape.opacity }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tape.imageData} alt={tape.name} className="h-full w-full object-cover" style={{ imageRendering: "pixelated" }} />
                  </div>
                </button>
                <button
                  onClick={() => onDeleteWashi(tape.id)}
                  className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[8px] text-white group-hover:flex"
                  style={{ background: "var(--pink)" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
