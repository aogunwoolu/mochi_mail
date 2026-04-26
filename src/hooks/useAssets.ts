"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Sticker, WashiTape, PlacedSticker, PaperBackground, CustomFont, MailStamp, EnvelopeStyle, ViewerIdentity } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

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

function createLinedPaper(name: string, base: string, lineColor: string, accentColor: string): PaperBackground {
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

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110.5, 0);
  ctx.lineTo(110.5, canvas.height);
  ctx.stroke();

  for (let y = 92; y < canvas.height; y += 42) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
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

function createDottedPaper(name: string, base: string, dotColor: string): PaperBackground {
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
  ctx.fillStyle = dotColor;
  for (let y = 28; y < canvas.height; y += 32) {
    for (let x = 28; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    id: generateId(),
    name,
    imageData: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

function createStampAsset(name: string, glyph: string, bgA: string, bgB: string): MailStamp {
  const canvas = document.createElement("canvas");
  canvas.width = 140;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { id: generateId(), name, imageData: "", width: canvas.width, height: canvas.height };
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, bgA);
  gradient.addColorStop(1, bgB);
  ctx.fillStyle = gradient;
  ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.setLineDash([]);

  ctx.font = "64px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(glyph, canvas.width / 2, canvas.height / 2 + 4);

  return {
    id: generateId(),
    name,
    imageData: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

function createEnvelopeAsset(name: string, body: string, flap: string, accent: string): EnvelopeStyle {
  const canvas = document.createElement("canvas");
  canvas.width = 820;
  canvas.height = 520;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { id: generateId(), name, imageData: "", width: canvas.width, height: canvas.height };
  }

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(40, 110, 740, 320, 28);
  ctx.fill();

  ctx.fillStyle = flap;
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

  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(40, 110, 740, 320, 28);
  ctx.stroke();

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
    createDottedPaper("Mochi Dots", "#fffdf8", "rgba(244, 168, 198, 0.5)"),
    createLinedPaper("Cottage Lines", "#fffdfa", "rgba(121, 166, 226, 0.34)", "rgba(255, 173, 186, 0.5)"),
  ];
}

function getDefaultStamps(): MailStamp[] {
  if (typeof document === "undefined") return [];
  return [
    createStampAsset("Sakura Post", "🌸", "#ff95ba", "#ffbfd4"),
    createStampAsset("Moonlight Mail", "🌙", "#8c83ff", "#c4b5fd"),
    createStampAsset("Berry Ribbon", "🎀", "#ff7ea8", "#ffb4c9"),
  ];
}

function getDefaultEnvelopes(): EnvelopeStyle[] {
  if (typeof document === "undefined") return [];
  return [
    createEnvelopeAsset("Blush Envelope", "#fff2f5", "#ffd7e4", "rgba(255, 133, 176, 0.45)"),
    createEnvelopeAsset("Butter Envelope", "#fff6d9", "#ffe38f", "rgba(250, 190, 72, 0.48)"),
    createEnvelopeAsset("Sky Envelope", "#eef8ff", "#d7ecff", "rgba(103, 176, 241, 0.48)"),
  ];
}

function assetStorageKey(user: ViewerIdentity): string {
  const id = user.accountId ?? user.id ?? "guest";
  return `mochimail_assets:${id}`;
}

type AssetPayload = {
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  stamps: MailStamp[];
  envelopes: EnvelopeStyle[];
  customFonts: CustomFont[];
  placedItems: PlacedSticker[];
  selectedPaperId: string | null;
  selectedAssetId: string | null;
};

function loadAssetPayload(storageKey: string): AssetPayload | null {
  if (!globalThis.window) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as AssetPayload) : null;
  } catch {
    return null;
  }
}

function saveAssetPayload(storageKey: string, payload: AssetPayload) {
  if (!globalThis.window) return;
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function useAssets(user: ViewerIdentity) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [washiTapes, setWashiTapes] = useState<WashiTape[]>([]);
  const [papers, setPapers] = useState<PaperBackground[]>([]);
  const [stamps, setStamps] = useState<MailStamp[]>([]);
  const [envelopes, setEnvelopes] = useState<EnvelopeStyle[]>([]);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<PaperBackground | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedSticker[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Sticker | WashiTape | null>(null);
  const [hydratedRemote, setHydratedRemote] = useState(false);
  const boardPersistenceDisabledRef = useRef(false);
  const ownerId = user.isGuest ? null : (user.accountId ?? user.id ?? null);
  const storageKey = useMemo(() => assetStorageKey(user), [user]);

  useEffect(() => {
    const defaults = {
      papers: getDefaultPapers(),
      stamps: getDefaultStamps(),
      envelopes: getDefaultEnvelopes(),
    };
    const local = loadAssetPayload(storageKey);

    if (local) {
      setStickers(local.stickers ?? []);
      setWashiTapes(local.washiTapes ?? []);
      setPapers(local.papers?.length ? local.papers : defaults.papers);
      setStamps(local.stamps?.length ? local.stamps : defaults.stamps);
      setEnvelopes(local.envelopes?.length ? local.envelopes : defaults.envelopes);
      setCustomFonts(local.customFonts ?? []);
      setPlacedItems(local.placedItems ?? []);
      const selected = (local.papers ?? []).find((p) => p.id === local.selectedPaperId)
        ?? defaults.papers.find((p) => p.id === local.selectedPaperId)
        ?? (local.papers?.[0] ?? defaults.papers[0] ?? null);
      setSelectedPaper(selected ?? null);
    } else {
      setPapers(defaults.papers);
      setStamps(defaults.stamps);
      setEnvelopes(defaults.envelopes);
      setSelectedPaper(defaults.papers[0] ?? null);
    }

    if (!ownerId) {
      setHydratedRemote(true);
      return;
    }

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
          .from("asset_states")
          .select("payload")
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (cancelled) return;

        const remote = (data?.payload ?? null) as AssetPayload | null;
        if (remote) {
          setStickers(remote.stickers ?? []);
          setWashiTapes(remote.washiTapes ?? []);
          setPapers(remote.papers?.length ? remote.papers : defaults.papers);
          setStamps(remote.stamps?.length ? remote.stamps : defaults.stamps);
          setEnvelopes(remote.envelopes?.length ? remote.envelopes : defaults.envelopes);
          setCustomFonts(remote.customFonts ?? []);
          setPlacedItems(remote.placedItems ?? []);
          const selected = (remote.papers ?? []).find((p) => p.id === remote.selectedPaperId)
            ?? defaults.papers.find((p) => p.id === remote.selectedPaperId)
            ?? (remote.papers?.[0] ?? defaults.papers[0] ?? null);
          setSelectedPaper(selected ?? null);
          const allAssets = [...(remote.stickers ?? []), ...(remote.washiTapes ?? [])];
          const selectedAssetValue = allAssets.find((a) => a.id === remote.selectedAssetId) ?? null;
          setSelectedAsset(selectedAssetValue ?? null);
          saveAssetPayload(storageKey, {
            stickers: remote.stickers ?? [],
            washiTapes: remote.washiTapes ?? [],
            papers: remote.papers?.length ? remote.papers : defaults.papers,
            stamps: remote.stamps?.length ? remote.stamps : defaults.stamps,
            envelopes: remote.envelopes?.length ? remote.envelopes : defaults.envelopes,
            customFonts: remote.customFonts ?? [],
            placedItems: remote.placedItems ?? [],
            selectedPaperId: selected?.id ?? null,
            selectedAssetId: selectedAssetValue?.id ?? null,
          });
        }
      } catch {
        // Keep local/default fallback.
      } finally {
        if (!cancelled) setHydratedRemote(true);
      }
    };

    void loadRemote();
    return () => {
      cancelled = true;
    };
  }, [ownerId, storageKey]);

  useEffect(() => {
    if (!hydratedRemote) return;
    const payload: AssetPayload = {
      stickers,
      washiTapes,
      papers,
      stamps,
      envelopes,
      customFonts,
      placedItems,
      selectedPaperId: selectedPaper?.id ?? null,
      selectedAssetId: selectedAsset?.id ?? null,
    };

    saveAssetPayload(storageKey, payload);
    if (!ownerId) return;

    const timeout = globalThis.setTimeout(() => {
      void (async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase
            .from("asset_states")
            .upsert({ owner_id: ownerId, payload: (payload as unknown as Json), updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
        } catch {
          // Local payload already saved.
        }
      })();
    }, 350);

    return () => globalThis.clearTimeout(timeout);
  }, [
    ownerId,
    storageKey,
    hydratedRemote,
    stickers,
    washiTapes,
    papers,
    stamps,
    envelopes,
    customFonts,
    placedItems,
    selectedPaper,
    selectedAsset,
  ]);

  const addSticker = useCallback((name: string, imageData: string, width: number, height: number, isAnimated = false) => {
    const sticker: Sticker = { id: generateId(), name, imageData, width, height, isAnimated };
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

  const addStamp = useCallback((name: string, imageData: string, width: number, height: number) => {
    const stamp: MailStamp = { id: generateId(), name, imageData, width, height };
    setStamps((prev) => [...prev, stamp]);
    return stamp;
  }, []);

  const addEnvelope = useCallback((name: string, imageData: string, width: number, height: number) => {
    const envelope: EnvelopeStyle = { id: generateId(), name, imageData, width, height };
    setEnvelopes((prev) => [...prev, envelope]);
    return envelope;
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
      rotation: 0,
      type: isWashi ? "washi" : "sticker",
      opacity: isWashi ? asset.opacity : 1,
      isAnimated: !isWashi && Boolean(asset.isAnimated),
    };
    setPlacedItems((prev) => [...prev, placed]);
    return placed;
  }, []);

  const placeTextItem = useCallback((text: string, x: number, y: number, color: string, size: number, font: string) => {
    const safeText = text.trim() || "Text";
    const lines = safeText.split("\n");
    const width = Math.max(180, Math.min(680, Math.max(...lines.map((line) => line.length), 6) * size * 0.62));
    const height = Math.max(size * 1.6, lines.length * size * 1.45 + 14);
    const placed: PlacedSticker = {
      id: generateId(),
      stickerId: "text",
      x,
      y,
      imageData: "",
      width,
      height,
      rotation: 0,
      type: "text",
      opacity: 1,
      text: safeText,
      textColor: color,
      textSize: size,
      textFont: font,
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

  const updatePlacedItem = useCallback((id: string, updates: Partial<PlacedSticker>) => {
    setPlacedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
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

  const removeStamp = useCallback((id: string) => {
    setStamps((prev) => prev.filter((stamp) => stamp.id !== id));
  }, []);

  const removeEnvelope = useCallback((id: string) => {
    setEnvelopes((prev) => prev.filter((envelope) => envelope.id !== id));
  }, []);

  const removeCustomFont = useCallback((id: string) => {
    setCustomFonts((prev) => prev.filter((font) => font.id !== id));
  }, []);

  const undoLastPlacement = useCallback(() => {
    setPlacedItems((prev) => prev.slice(0, -1));
  }, []);

  const applySharedCanvasState = useCallback((state: {
    placedItems?: PlacedSticker[];
    selectedPaper?: PaperBackground | null;
  }) => {
    if (state.placedItems) {
      setPlacedItems(state.placedItems);
    }

    if (state.selectedPaper !== null && state.selectedPaper !== undefined) {
      const selected: PaperBackground = state.selectedPaper;
      setPapers((prev) => {
        if (prev.some((paper) => paper.id === selected.id)) return prev;
        return [...prev, selected] as PaperBackground[];
      });
      setSelectedPaper(selected);
    }
  }, []);

  const saveBoardState = useCallback(async (drawingData: string | null, currentPlacedItems: PlacedSticker[], currentSelectedPaper: PaperBackground | null, roomId?: string | null) => {
    if (!user?.id || user.isGuest || boardPersistenceDisabledRef.current) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await (supabase
      .from("studio_boards") as any)
      .upsert({
        created_by: user.id,
        room_id: roomId ?? "personal",
        drawing_data: drawingData,
        placed_items: currentPlacedItems,
        selected_paper: currentSelectedPaper,
        updated_at: new Date().toISOString(),
      }, { onConflict: "created_by,room_id" });
    if (error) {
      const message = String(error.message ?? "").toLowerCase();
      if (message.includes("relation") || message.includes("permission") || message.includes("does not exist")) {
        boardPersistenceDisabledRef.current = true;
        return;
      }
      console.warn("Failed to save board state:", error);
    }
  }, [user?.id, user.isGuest]);

  const loadBoardState = useCallback(async (roomId?: string | null) => {
    if (!user?.id || user.isGuest || boardPersistenceDisabledRef.current) return;
    const supabase = createSupabaseBrowserClient();
    // For shared rooms load the most recently updated board from any participant;
    // for personal boards restrict to the owner.
    const isSharedRoom = !!roomId;
    const baseQuery = (supabase.from("studio_boards") as any)
      .select("drawing_data, placed_items, selected_paper")
      .eq("room_id", roomId ?? "personal");
    const { data, error } = await (
      isSharedRoom
        ? baseQuery.order("updated_at", { ascending: false }).limit(1).single()
        : baseQuery.eq("created_by", user.id).single()
    );

    if (error && error.code !== "PGRST116") {
      const message = String(error.message ?? "").toLowerCase();
      if (message.includes("relation") || message.includes("permission") || message.includes("does not exist")) {
        boardPersistenceDisabledRef.current = true;
        return null;
      }
      console.warn("Failed to load board state:", error);
      return null;
    }

    if (data) {
      return {
        drawingData: (data as any).drawing_data as string | null,
        placedItems: ((data as any).placed_items ?? []) as PlacedSticker[],
        selectedPaper: ((data as any).selected_paper ?? null) as PaperBackground | null,
      };
    }
    return null;
  }, [user?.id, user.isGuest]);

  return {
    stickers,
    washiTapes,
    papers,
    stamps,
    envelopes,
    customFonts,
    selectedPaper,
    placedItems,
    selectedAsset,
    setSelectedPaper,
    setSelectedAsset,
    addSticker,
    addWashiTape,
    addPaper,
    addStamp,
    addEnvelope,
    addCustomFont,
    placeItem,
    placeTextItem,
    shiftPlacedItems,
    updatePlacedItem,
    removeSticker,
    removeWashiTape,
    removePaper,
    removeStamp,
    removeEnvelope,
    removeCustomFont,
    undoLastPlacement,
    applySharedCanvasState,
    saveBoardState,
    loadBoardState,
  };
}
