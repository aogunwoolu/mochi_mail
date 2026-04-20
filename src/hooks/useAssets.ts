"use client";

import { useState, useCallback, useEffect } from "react";
import { Sticker, WashiTape, PlacedSticker, PaperBackground, CustomFont } from "@/types";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createPaperPattern(
  name: string,
  base: string,
  lineMinor: string,
  lineMajor: string
): PaperBackground {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      id: generateId(),
      name,
      imageData: "",
      width: canvas.width,
      height: canvas.height,
    };
  }

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const step = 24;
  const majorEvery = 5;
  for (let y = 0, row = 0; y <= canvas.height; y += step, row += 1) {
    ctx.strokeStyle = row % majorEvery === 0 ? lineMajor : lineMinor;
    ctx.lineWidth = row % majorEvery === 0 ? 1.4 : 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0, col = 0; x <= canvas.width; x += step, col += 1) {
    ctx.strokeStyle = col % majorEvery === 0 ? lineMajor : lineMinor;
    ctx.lineWidth = col % majorEvery === 0 ? 1.4 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  return {
    id: generateId(),
    name,
    imageData: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

function getDefaultPapers(): PaperBackground[] {
  if (typeof document === "undefined") return [];
  return [
    createPaperPattern(
      "Pink Picnic",
      "#fff8fb",
      "rgba(255, 187, 214, 0.22)",
      "rgba(255, 129, 174, 0.34)"
    ),
    createPaperPattern(
      "Mint Grid",
      "#f4fffb",
      "rgba(168, 236, 210, 0.25)",
      "rgba(93, 201, 158, 0.33)"
    ),
    createPaperPattern(
      "Lavender Dream",
      "#faf7ff",
      "rgba(206, 190, 255, 0.26)",
      "rgba(150, 122, 245, 0.34)"
    ),
  ];
}

export function useAssets() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [washiTapes, setWashiTapes] = useState<WashiTape[]>([]);
  const [papers, setPapers] = useState<PaperBackground[]>([]);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<PaperBackground | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedSticker[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Sticker | WashiTape | null>(null);

  useEffect(() => {
    const defaults = getDefaultPapers();
    setPapers(defaults);
    if (defaults.length > 0) {
      setSelectedPaper(defaults[0]);
    }
  }, []);

  const addSticker = useCallback((name: string, imageData: string, width: number, height: number) => {
    const sticker: Sticker = { id: generateId(), name, imageData, width, height };
    setStickers((prev) => [...prev, sticker]);
    return sticker;
  }, []);

  const addWashiTape = useCallback((name: string, imageData: string, opacity: number, width: number, height: number) => {
    const tape: WashiTape = { id: generateId(), name, imageData, opacity, width, height };
    setWashiTapes((prev) => [...prev, tape]);
    return tape;
  }, []);

  const addPaper = useCallback((name: string, imageData: string, width: number, height: number) => {
    const paper: PaperBackground = { id: generateId(), name, imageData, width, height };
    setPapers((prev) => [...prev, paper]);
    return paper;
  }, []);

  const addCustomFont = useCallback((
    name: string,
    glyphs: Record<string, string>,
    glyphWidth = 52,
    glyphHeight = 64
  ) => {
    const font: CustomFont = {
      id: generateId(),
      name,
      glyphs,
      glyphWidth,
      glyphHeight,
    };
    setCustomFonts((prev) => [...prev, font]);
    return font;
  }, []);

  const placeItem = useCallback((asset: Sticker | WashiTape, x: number, y: number) => {
    const isWashi = "opacity" in asset;
    const placed: PlacedSticker = {
      id: generateId(),
      stickerId: asset.id,
      x,
      y,
      imageData: asset.imageData,
      width: asset.width,
      height: asset.height,
      type: isWashi ? "washi" : "sticker",
      opacity: isWashi ? (asset as WashiTape).opacity : 1,
    };
    setPlacedItems((prev) => [...prev, placed]);
    return placed;
  }, []);

  const shiftPlacedItems = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    setPlacedItems((prev) =>
      prev.map((item) => ({
        ...item,
        x: item.x + dx,
        y: item.y + dy,
      }))
    );
  }, []);

  const removeSticker = useCallback((id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const removeWashiTape = useCallback((id: string) => {
    setWashiTapes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removePaper = useCallback((id: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== id));
    setSelectedPaper((prev) => (prev?.id === id ? null : prev));
  }, []);

  const removeCustomFont = useCallback((id: string) => {
    setCustomFonts((prev) => prev.filter((font) => font.id !== id));
  }, []);

  const undoLastPlacement = useCallback(() => {
    setPlacedItems((prev) => prev.slice(0, -1));
  }, []);

  return {
    stickers,
    washiTapes,
    papers,
    customFonts,
    selectedPaper,
    placedItems,
    selectedAsset,
    setSelectedPaper,
    setSelectedAsset,
    addSticker,
    addWashiTape,
    addPaper,
    addCustomFont,
    placeItem,
    shiftPlacedItems,
    removeSticker,
    removeWashiTape,
    removePaper,
    removeCustomFont,
    undoLastPlacement,
  };
}
