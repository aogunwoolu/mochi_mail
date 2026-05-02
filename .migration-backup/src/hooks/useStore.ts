"use client";

import { useState, useCallback, useEffect } from "react";
import { StoreItem, Sticker, WashiTape, PaperBackground, CustomFont, MailStamp, EnvelopeStyle, ViewerIdentity } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type VisualAsset = Sticker | WashiTape | PaperBackground | MailStamp | EnvelopeStyle;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const STORE_KEY = "mochimail_store";
const COLLECTION_KEY = "mochimail_store_collection";

function storeKeyFor(user: ViewerIdentity): string {
  const id = user.accountId ?? user.id ?? "guest";
  return `${STORE_KEY}:${id}`;
}

function collectionKeyFor(user: ViewerIdentity): string {
  const id = user.accountId ?? user.id ?? "guest";
  return `${COLLECTION_KEY}:${id}`;
}

function loadStore(key: string): StoreItem[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return getDefaultStoreItems();
    const parsed = JSON.parse(raw) as StoreItem[];
    const migrated = parsed.map((item) => {
      if (item.id === "default_paper") {
        return {
          ...item,
          name: "Strawberry Graph Paper",
          imageData: makeGraphPaper(),
          tags: ["paper", "graph", "cute"],
        };
      }
      return item;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return getDefaultStoreItems();
  }
}

function saveStore(items: StoreItem[]) {
  if (!globalThis.window) return;
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function saveStoreByKey(key: string, items: StoreItem[]) {
  if (!globalThis.window) return;
  localStorage.setItem(key, JSON.stringify(items));
}

function loadCollection(key: string): string[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(ids: string[]) {
  if (!globalThis.window) return;
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(ids));
}

function saveCollectionByKey(key: string, ids: string[]) {
  if (!globalThis.window) return;
  localStorage.setItem(key, JSON.stringify(ids));
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!globalThis.document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

// Generate a simple pixel art as default content
function makePixelHeart(): string {
  const data = createCanvas(80, 80);
  if (!data) return "";
  const { canvas, ctx } = data;
  const pixels = [
    [2, 0], [3, 0], [5, 0], [6, 0],
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
    [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    [3, 6], [4, 6], [5, 6],
    [4, 7],
  ];
  ctx.fillStyle = "#ff6b9d";
  pixels.forEach(([x, y]) => ctx.fillRect(x * 8 + 4, y * 8 + 4, 8, 8));
  return canvas.toDataURL("image/png");
}

function makePixelStar(): string {
  const data = createCanvas(80, 80);
  if (!data) return "";
  const { canvas, ctx } = data;
  const pixels = [
    [4, 0], [4, 1],
    [3, 2], [4, 2], [5, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
    [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    [2, 6], [3, 6], [5, 6], [6, 6],
    [1, 7], [2, 7], [6, 7], [7, 7],
  ];
  ctx.fillStyle = "#fbbf24";
  pixels.forEach(([x, y]) => ctx.fillRect(x * 8 + 4, y * 8 + 4, 8, 8));
  return canvas.toDataURL("image/png");
}

function makeWashiStripe(): string {
  const data = createCanvas(240, 48);
  if (!data) return "";
  const { canvas, ctx } = data;
  ctx.fillStyle = "#a78bfa";
  ctx.fillRect(0, 0, 240, 48);
  ctx.fillStyle = "#c4b5fd";
  for (let x = 0; x < 240; x += 16) {
    if ((x / 16) % 2 === 0) {
      ctx.fillRect(x, 0, 8, 48);
    }
  }
  return canvas.toDataURL("image/png");
}

function makeGraphPaper(): string {
  const data = createCanvas(1200, 800);
  if (!data) return "";
  const { canvas, ctx } = data;

  ctx.fillStyle = "#fffaf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const step = 24;
  const majorEvery = 5;
  for (let y = 0, row = 0; y <= canvas.height; y += step, row += 1) {
    ctx.strokeStyle = row % majorEvery === 0 ? "rgba(244, 114, 182, 0.28)" : "rgba(255, 201, 187, 0.3)";
    ctx.lineWidth = row % majorEvery === 0 ? 1.4 : 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0, col = 0; x <= canvas.width; x += step, col += 1) {
    ctx.strokeStyle = col % majorEvery === 0 ? "rgba(244, 114, 182, 0.28)" : "rgba(255, 201, 187, 0.3)";
    ctx.lineWidth = col % majorEvery === 0 ? 1.4 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

function makeStoreStamp(): string {
  const data = createCanvas(140, 160);
  if (!data) return "";
  const { canvas, ctx } = data;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#ff8eb9");
  gradient.addColorStop(1, "#ffc6d8");
  ctx.fillStyle = gradient;
  ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.setLineDash([]);
  ctx.font = "64px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.fillText("💌", canvas.width / 2, canvas.height / 2 + 4);
  return canvas.toDataURL("image/png");
}

function makeStoreEnvelope(): string {
  const data = createCanvas(820, 520);
  if (!data) return "";
  const { canvas, ctx } = data;
  ctx.fillStyle = "#fff3f7";
  ctx.beginPath();
  ctx.roundRect(40, 110, 740, 320, 28);
  ctx.fill();
  ctx.fillStyle = "#ffd6e4";
  ctx.beginPath();
  ctx.moveTo(60, 128);
  ctx.lineTo(410, 315);
  ctx.lineTo(760, 128);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(60, 408);
  ctx.lineTo(410, 236);
  ctx.lineTo(760, 408);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 133, 176, 0.45)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(40, 110, 740, 320, 28);
  ctx.stroke();
  return canvas.toDataURL("image/png");
}

function getDefaultStoreItems(): StoreItem[] {
  // Only generate defaults in browser
  if (typeof document === "undefined") return [];
  return [
    {
      id: "default_heart",
      name: "Pixel Heart",
      imageData: makePixelHeart(),
      type: "sticker",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 42,
      createdAt: Date.now() - 86400000,
      width: 80,
      height: 80,
      tags: ["love", "pixel", "cute"],
    },
    {
      id: "default_star",
      name: "Pixel Star",
      imageData: makePixelStar(),
      type: "sticker",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 38,
      createdAt: Date.now() - 172800000,
      width: 80,
      height: 80,
      tags: ["star", "pixel", "gold"],
    },
    {
      id: "default_washi",
      name: "Lavender Stripe",
      imageData: makeWashiStripe(),
      type: "washi",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 27,
      createdAt: Date.now() - 259200000,
      opacity: 0.7,
      width: 240,
      height: 48,
      tags: ["purple", "stripe", "classic"],
    },
    {
      id: "default_paper",
      name: "Strawberry Graph Paper",
      imageData: makeGraphPaper(),
      type: "background",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 19,
      createdAt: Date.now() - 345600000,
      width: 1200,
      height: 800,
      tags: ["paper", "graph", "cute"],
    },
    {
      id: "default_stamp",
      name: "Love Letter Stamp",
      imageData: makeStoreStamp(),
      type: "stamp",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 14,
      createdAt: Date.now() - 432000000,
      width: 140,
      height: 160,
      tags: ["stamp", "mail", "cute"],
    },
    {
      id: "default_envelope",
      name: "Blush Envelope",
      imageData: makeStoreEnvelope(),
      type: "envelope",
      authorName: "MochiTeam",
      authorId: "system",
      downloads: 11,
      createdAt: Date.now() - 518400000,
      width: 820,
      height: 520,
      tags: ["envelope", "mail", "pink"],
    },
  ];
}

export function useStore(user: ViewerIdentity) {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [collection, setCollection] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sticker" | "washi" | "background" | "font" | "stamp" | "envelope">("all");
  const [hydratedRemote, setHydratedRemote] = useState(false);
  const ownerId = user.isGuest ? null : (user.accountId ?? user.id ?? null);
  const storeKey = storeKeyFor(user);
  const collectionKey = collectionKeyFor(user);

  useEffect(() => {
    const localStore = loadStore(storeKey);
    const localCollection = loadCollection(collectionKey);
    setStoreItems(localStore);
    setCollection(localCollection);

    if (!ownerId) {
      setHydratedRemote(true);
      return;
    }

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
          .from("store_states")
          .select("payload")
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (cancelled) return;
        const payload = (data?.payload ?? null) as { storeItems?: StoreItem[]; collection?: string[] } | null;
        if (payload) {
          const nextStore = payload.storeItems ?? localStore;
          const nextCollection = payload.collection ?? localCollection;
          setStoreItems(nextStore);
          setCollection(nextCollection);
          saveStoreByKey(storeKey, nextStore);
          saveCollectionByKey(collectionKey, nextCollection);
        }
      } catch {
        // Keep local fallback.
      } finally {
        if (!cancelled) setHydratedRemote(true);
      }
    };

    void loadRemote();
    return () => {
      cancelled = true;
    };
  }, [ownerId, storeKey, collectionKey]);

  useEffect(() => {
    if (!hydratedRemote) return;
    saveStoreByKey(storeKey, storeItems);
    saveCollectionByKey(collectionKey, collection);
    if (!ownerId) return;

    const timeout = globalThis.setTimeout(() => {
      void (async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase
            .from("store_states")
            .upsert({ owner_id: ownerId, payload: ({ storeItems, collection } as unknown as Json), updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
        } catch {
          // Local state already saved.
        }
      })();
    }, 350);

    return () => globalThis.clearTimeout(timeout);
  }, [hydratedRemote, ownerId, storeKey, collectionKey, storeItems, collection]);

  const publishToStore = useCallback(
    (
      item: VisualAsset | CustomFont,
      itemType: StoreItem["type"],
      authorName: string,
      authorId: string,
      tags: string[] = []
    ) => {
      const isWashi = itemType === "washi";
      const isFont = itemType === "font";
      const fontItem = isFont ? (item as CustomFont) : null;
      const visualItem: VisualAsset | null = "glyphs" in item ? null : item;
      const previewGlyph = fontItem ? (fontItem.glyphs["A"] ?? fontItem.glyphs["a"] ?? Object.values(fontItem.glyphs)[0] ?? "") : "";
      const storeItem: StoreItem = {
        id: generateId(),
        name: item.name,
        imageData: isFont ? previewGlyph : (visualItem?.imageData ?? ""),
        type: itemType,
        authorName,
        authorId,
        downloads: 0,
        createdAt: Date.now(),
        opacity: isWashi ? (item as WashiTape).opacity : undefined,
        width: isFont ? fontItem?.glyphWidth ?? 52 : (visualItem?.width ?? 80),
        height: isFont ? fontItem?.glyphHeight ?? 64 : (visualItem?.height ?? 80),
        tags,
        fontData: isFont ? fontItem ?? undefined : undefined,
      };
      setStoreItems((prev) => {
        const updated = [storeItem, ...prev];
        saveStoreByKey(storeKey, updated);
        return updated;
      });
      return storeItem;
    },
    [storeKey]
  );

  const addToCollection = useCallback(
    (itemId: string) => {
      if (collection.includes(itemId)) return;
      setCollection((prev) => {
        const updated = [...prev, itemId];
        saveCollectionByKey(collectionKey, updated);
        return updated;
      });
      // Increment download count
      setStoreItems((prev) => {
        const updated = prev.map((item) =>
          item.id === itemId ? { ...item, downloads: item.downloads + 1 } : item
        );
        saveStoreByKey(storeKey, updated);
        return updated;
      });
    },
    [collection, collectionKey, storeKey]
  );

  const removeFromCollection = useCallback((itemId: string) => {
    setCollection((prev) => {
      const updated = prev.filter((id) => id !== itemId);
      saveCollectionByKey(collectionKey, updated);
      return updated;
    });
  }, [collectionKey]);

  const isInCollection = useCallback(
    (itemId: string) => collection.includes(itemId),
    [collection]
  );

  const filteredItems = storeItems.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStoreItemAsAsset = useCallback(
    (itemId: string): Sticker | WashiTape | PaperBackground | CustomFont | MailStamp | EnvelopeStyle | null => {
      const item = storeItems.find((i) => i.id === itemId);
      if (!item) return null;
      if (item.type === "washi") {
        return {
          id: item.id,
          name: item.name,
          imageData: item.imageData,
          opacity: item.opacity ?? 0.7,
          width: item.width,
          height: item.height,
        } as WashiTape;
      }
      if (item.type === "background") {
        return {
          id: item.id,
          name: item.name,
          imageData: item.imageData,
          width: item.width,
          height: item.height,
        } as PaperBackground;
      }
      if (item.type === "stamp") {
        return {
          id: item.id,
          name: item.name,
          imageData: item.imageData,
          width: item.width,
          height: item.height,
        } as MailStamp;
      }
      if (item.type === "envelope") {
        return {
          id: item.id,
          name: item.name,
          imageData: item.imageData,
          width: item.width,
          height: item.height,
        } as EnvelopeStyle;
      }
      if (item.type === "font" && item.fontData) {
        return {
          ...item.fontData,
          id: item.fontData.id || item.id,
          name: item.fontData.name || item.name,
        } as CustomFont;
      }
      return {
        id: item.id,
        name: item.name,
        imageData: item.imageData,
        width: item.width,
        height: item.height,
      } as Sticker;
    },
    [storeItems]
  );

  return {
    storeItems: filteredItems,
    allStoreItems: storeItems,
    collection,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    publishToStore,
    addToCollection,
    removeFromCollection,
    isInCollection,
    getStoreItemAsAsset,
  };
}
