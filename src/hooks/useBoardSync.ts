"use client";

import { useCallback, useEffect, useRef } from "react";
import { Doc, Map as YMap } from "yjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SupabaseYjsProvider } from "@/lib/collab/supabaseYjsProvider";
import type { DrawingCanvasHandle } from "@/components/DrawingCanvas";
import type { PaperBackground, PlacedSticker } from "@/types";

type UseBoardSyncOptions = {
  hasSession: boolean;
  collabScope: string;
  activeRoomId: string | null;
  selfIdRef: React.RefObject<string>;
  canvasRef: React.RefObject<DrawingCanvasHandle | null>;
  worldOffsetRef: React.RefObject<{ x: number; y: number }>;
  placedItems: PlacedSticker[];
  selectedPaper: PaperBackground | undefined;
  applySharedCanvasState: (state: { placedItems?: PlacedSticker[]; selectedPaper?: PaperBackground | null }) => void;
  saveBoardState: (drawingData: string | null, items: PlacedSticker[], paper: PaperBackground | null, roomId?: string | null) => Promise<void>;
  loadBoardState: (roomId?: string | null) => Promise<{ drawingData: string | null; placedItems: PlacedSticker[]; selectedPaper: PaperBackground | null } | null | undefined>;
};

export function useBoardSync({
  hasSession,
  collabScope,
  activeRoomId,
  selfIdRef,
  canvasRef,
  worldOffsetRef,
  placedItems,
  selectedPaper,
  applySharedCanvasState,
  saveBoardState,
  loadBoardState,
}: UseBoardSyncOptions) {
  // Yjs internals
  const yDocRef = useRef<Doc | null>(null);
  const yBoardMapRef = useRef<YMap<string> | null>(null);
  const yProviderRef = useRef<SupabaseYjsProvider | null>(null);
  const isBoardSyncReadyRef = useRef(false);
  const isApplyingRemoteBoardRef = useRef(false);
  const hasRemoteBoardEventRef = useRef(false);
  const lastAppliedBoardTsRef = useRef(0);
  const lastSyncedItemsFingerprintRef = useRef("");
  const lastSyncedDrawingRef = useRef<string | null>(null);
  const lastDrawingPublishAtRef = useRef(0);
  const lastPersistedDrawingRef = useRef<string | null>(null);

  // Drawing dirty flags — set from outside via markDrawingDirty / markDrawingProgress
  const drawingDirtyRef = useRef(false);
  const persistDrawingDirtyRef = useRef(false);
  const persistItemsDirtyRef = useRef(false);

  // Mirror of activeRoomId for use inside setInterval closures
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);

  // Stable refs for placedItems / selectedPaper (used as fallbacks in remote apply)
  const placedItemsRef = useRef(placedItems);
  const selectedPaperRef = useRef(selectedPaper ?? null);
  useEffect(() => {
    placedItemsRef.current = placedItems;
    selectedPaperRef.current = selectedPaper ?? null;
  }, [placedItems, selectedPaper]);

  // Load board state from the database when session or room changes.
  useEffect(() => {
    const init = async () => {
      const boardState = await loadBoardState(activeRoomId);
      if (!boardState) return;
      if (hasRemoteBoardEventRef.current) return;

      if (boardState.placedItems.length > 0) {
        applySharedCanvasState({ placedItems: boardState.placedItems, selectedPaper: boardState.selectedPaper });
      }
      if (boardState.drawingData) {
        canvasRef.current?.setCanvasImageData(boardState.drawingData);
        lastSyncedDrawingRef.current = boardState.drawingData;
        lastPersistedDrawingRef.current = boardState.drawingData;
      }
      lastSyncedItemsFingerprintRef.current = JSON.stringify({
        p: boardState.placedItems,
        paper: boardState.selectedPaper?.id ?? null,
      });
      lastAppliedBoardTsRef.current = Date.now();

      const boardMap = yBoardMapRef.current;
      if (hasSession && boardMap && !boardMap.has("ts")) {
        boardMap.doc?.transact(() => {
          boardMap.set("senderId", selfIdRef.current ?? "");
          boardMap.set("ts", String(Date.now()));
          boardMap.set("placedItems", JSON.stringify(boardState.placedItems));
          boardMap.set("selectedPaper", JSON.stringify(boardState.selectedPaper ?? null));
          boardMap.set("drawingData", boardState.drawingData ?? "");
          boardMap.set("drawingOffsetX", String(worldOffsetRef.current?.x ?? 0));
          boardMap.set("drawingOffsetY", String(worldOffsetRef.current?.y ?? 0));
        }, "seed-from-db");
      }
    };

    hasRemoteBoardEventRef.current = false;
    void init();
  }, [hasSession, loadBoardState, applySharedCanvasState, collabScope]);

  // Save to the database every 5 seconds when dirty.
  useEffect(() => {
    const timer = globalThis.setInterval(async () => {
      if (!persistItemsDirtyRef.current && !persistDrawingDirtyRef.current) return;

      let drawingData = lastPersistedDrawingRef.current;
      if (persistDrawingDirtyRef.current) {
        drawingData = canvasRef.current?.getCanvasImageData() ?? null;
        lastPersistedDrawingRef.current = drawingData;
        persistDrawingDirtyRef.current = false;
      }

      await saveBoardState(drawingData, placedItems, selectedPaper ?? null, activeRoomIdRef.current);
      persistItemsDirtyRef.current = false;
    }, 5000);

    return () => globalThis.clearInterval(timer);
  }, [placedItems, selectedPaper, saveBoardState]);

  useEffect(() => {
    persistItemsDirtyRef.current = true;
  }, [placedItems, selectedPaper]);

  // Yjs CRDT sync for real-time board collaboration.
  useEffect(() => {
    if (!hasSession) {
      isBoardSyncReadyRef.current = false;
      yBoardMapRef.current = null;
      yDocRef.current = null;
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const doc = new Doc();
    const boardMap = doc.getMap<string>("board");
    const provider = new SupabaseYjsProvider({
      supabase,
      roomName: `mochimail-studio-board:${collabScope}`,
      doc,
      senderId: selfIdRef.current ?? "",
    });

    yDocRef.current = doc;
    yBoardMapRef.current = boardMap;
    yProviderRef.current = provider;
    isBoardSyncReadyRef.current = true;
    provider.connect();

    const parseJson = <T,>(value: string | undefined): T | null => {
      if (typeof value !== "string") return null;
      try { return JSON.parse(value) as T; } catch { return null; }
    };

    const applyRemoteBoardState = () => {
      const incomingTs = Number(boardMap.get("ts"));
      if (!Number.isFinite(incomingTs) || incomingTs <= lastAppliedBoardTsRef.current) return;
      if (boardMap.get("senderId") === selfIdRef.current) return;

      const nextPlacedItems = parseJson<PlacedSticker[]>(boardMap.get("placedItems"));
      const nextSelectedPaper = parseJson<PaperBackground | null>(boardMap.get("selectedPaper"));
      const drawingDataRaw = boardMap.get("drawingData");
      const drawingOffsetX = Number(boardMap.get("drawingOffsetX") ?? "0");
      const drawingOffsetY = Number(boardMap.get("drawingOffsetY") ?? "0");

      const hasPlacedItems = nextPlacedItems !== null;
      const hasSelectedPaper = nextSelectedPaper !== null;
      const hasDrawing = typeof drawingDataRaw === "string";
      if (!hasPlacedItems && !hasSelectedPaper && !hasDrawing) return;

      hasRemoteBoardEventRef.current = true;
      lastAppliedBoardTsRef.current = incomingTs;
      isApplyingRemoteBoardRef.current = true;

      try {
        if (hasPlacedItems || hasSelectedPaper) {
          const resolvedItems = nextPlacedItems ?? placedItemsRef.current;
          const resolvedPaper = nextSelectedPaper ?? selectedPaperRef.current;
          lastSyncedItemsFingerprintRef.current = JSON.stringify({
            p: resolvedItems,
            paper: resolvedPaper?.id ?? null,
          });
          applySharedCanvasState({
            ...(hasPlacedItems ? { placedItems: resolvedItems } : {}),
            ...(hasSelectedPaper ? { selectedPaper: resolvedPaper } : {}),
          });
        }
        if (hasDrawing) {
          const incomingDrawing = drawingDataRaw || null;
          const shiftX = (Number.isFinite(drawingOffsetX) ? drawingOffsetX : 0) - (worldOffsetRef.current?.x ?? 0);
          const shiftY = (Number.isFinite(drawingOffsetY) ? drawingOffsetY : 0) - (worldOffsetRef.current?.y ?? 0);
          canvasRef.current?.setCanvasImageData(incomingDrawing, { shiftX, shiftY });
          lastSyncedDrawingRef.current = incomingDrawing;
          lastPersistedDrawingRef.current = incomingDrawing;
          drawingDirtyRef.current = false;
        }
      } finally {
        isApplyingRemoteBoardRef.current = false;
      }
    };

    boardMap.observe(applyRemoteBoardState);

    // Publish drawing changes at most every 160ms.
    const drawingTimer = globalThis.setInterval(() => {
      if (!isBoardSyncReadyRef.current || !yBoardMapRef.current) return;
      if (!drawingDirtyRef.current) return;
      const now = Date.now();
      if (now - lastDrawingPublishAtRef.current < 160) return;

      const drawingData = canvasRef.current?.getCanvasImageData() ?? null;
      if (drawingData === lastSyncedDrawingRef.current) {
        drawingDirtyRef.current = false;
        return;
      }

      const nextTs = Date.now();
      yBoardMapRef.current.doc?.transact(() => {
        yBoardMapRef.current?.set("senderId", selfIdRef.current ?? "");
        yBoardMapRef.current?.set("ts", String(nextTs));
        yBoardMapRef.current?.set("drawingData", drawingData ?? "");
        yBoardMapRef.current?.set("drawingOffsetX", String(worldOffsetRef.current?.x ?? 0));
        yBoardMapRef.current?.set("drawingOffsetY", String(worldOffsetRef.current?.y ?? 0));
      }, "publish-drawing");

      lastDrawingPublishAtRef.current = now;
      lastSyncedDrawingRef.current = drawingData;
      lastAppliedBoardTsRef.current = nextTs;
      drawingDirtyRef.current = false;
    }, 120);

    return () => {
      boardMap.unobserve(applyRemoteBoardState);
      globalThis.clearInterval(drawingTimer);
      isBoardSyncReadyRef.current = false;
      yBoardMapRef.current = null;
      yDocRef.current = null;
      const p = yProviderRef.current;
      yProviderRef.current = null;
      void p?.destroy();
      doc.destroy();
    };
  }, [hasSession, collabScope]);

  // Publish item/paper changes to Yjs when their fingerprint changes.
  useEffect(() => {
    if (!hasSession) return;
    if (!isBoardSyncReadyRef.current || !yBoardMapRef.current) return;
    if (isApplyingRemoteBoardRef.current) return;

    const fingerprint = JSON.stringify({ p: placedItems, paper: selectedPaper?.id ?? null });
    if (fingerprint === lastSyncedItemsFingerprintRef.current) return;

    const timer = globalThis.setTimeout(() => {
      const nextTs = Date.now();
      yBoardMapRef.current?.doc?.transact(() => {
        yBoardMapRef.current?.set("senderId", selfIdRef.current ?? "");
        yBoardMapRef.current?.set("ts", String(nextTs));
        yBoardMapRef.current?.set("placedItems", JSON.stringify(placedItems));
        yBoardMapRef.current?.set("selectedPaper", JSON.stringify(selectedPaper ?? null));
      }, "publish-items");
      lastSyncedItemsFingerprintRef.current = fingerprint;
      lastAppliedBoardTsRef.current = nextTs;
    }, 120);

    return () => globalThis.clearTimeout(timer);
  }, [hasSession, placedItems, selectedPaper]);

  const markDrawingDirty = useCallback(() => {
    drawingDirtyRef.current = true;
    persistDrawingDirtyRef.current = true;
  }, []);

  const markDrawingProgress = useCallback(() => {
    drawingDirtyRef.current = true;
  }, []);

  return { markDrawingDirty, markDrawingProgress };
}
