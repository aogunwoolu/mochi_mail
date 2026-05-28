
import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { strokeToPath2D } from "@/lib/canvas/strokeUtils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DrawingCanvasHandle } from "@/components/DrawingCanvas";
import type { PaperBackground, PlacedSticker } from "@/types";
import type { Database, Json } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStroke = {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  size: number;
  pts: [number, number, number][];
  layerIndex?: number;
};

type LiveStrokePayload = {
  artistId: string;
  strokeId: string;
  pts: [number, number, number][];
  color: string;
  size: number;
  tool: "pen" | "eraser";
  isLast: boolean;
  layerIndex?: number;
};

type BoardUpdatePayload = {
  senderId: string;
  ts: number;
  placedItems: PlacedSticker[];
  selectedPaper: PaperBackground | null;
};

type PlacedItemAddPayload = { senderId: string; item: PlacedSticker };
type PlacedItemRemovePayload = { senderId: string; itemId: string };

export type UseStrokeSyncOptions = {
  hasSession: boolean;
  /** null while the room is still being created/joined — gates all DB + channel work */
  collabScope: string | null;
  activeRoomId: string | null;
  selfIdRef: React.RefObject<string>;
  canvasRef: React.RefObject<DrawingCanvasHandle | null>;
  remoteStrokeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  placedItems: PlacedSticker[];
  selectedPaper: PaperBackground | null | undefined;
  applySharedCanvasState: (state: {
    placedItems?: PlacedSticker[];
    selectedPaper?: PaperBackground | null | undefined;
  }) => void;
  onRemotePlacedItemAdd: (item: PlacedSticker) => void;
  onRemotePlacedItemRemove: (itemId: string) => void;
  saveBoardState: (
    drawingData: string | null,
    items: PlacedSticker[],
    paper: PaperBackground | null,
    roomId?: string | null
  ) => Promise<void>;
  loadBoardState: (roomId?: string | null) => Promise<{
    drawingData: string | null;
    placedItems: PlacedSticker[];
    selectedPaper: PaperBackground | null;
  } | null | undefined>;
};

// ─── Render helper ────────────────────────────────────────────────────────────

function renderSyncStroke(ctx: CanvasRenderingContext2D, stroke: SyncStroke) {
  if (!stroke.pts?.length) return;
  const isEraser = stroke.tool === "eraser";
  const outline = getStroke(stroke.pts, {
    size: isEraser ? stroke.size * 2.5 : stroke.size,
    thinning: isEraser ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false,
  });
  if (!outline.length) return;
  ctx.save();
  if (isEraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
  } else {
    ctx.fillStyle = stroke.color;
  }
  ctx.fill(strokeToPath2D(outline));
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type LiveAccumulated = {
  strokeId: string;
  allPts: [number, number, number][];
  color: string;
  size: number;
  tool: "pen" | "eraser";
};

function appendDeltaPts(
  acc: LiveAccumulated,
  newPts: [number, number, number][] | undefined,
) {
  if (newPts?.length) {
    for (const pt of newPts) acc.allPts.push(pt);
  }
}

function commitAccToCanvas(
  canvasRef: React.RefObject<{ getCanvas: () => HTMLCanvasElement | null } | null>,
  acc: LiveAccumulated,
  strokeId: string,
) {
  const dc = canvasRef.current?.getCanvas();
  if (!dc) {
    console.warn("[commitAccToCanvas] No canvas available from canvasRef!");
    return;
  }
  const ctx = dc.getContext("2d");
  if (!ctx) {
    console.warn("[commitAccToCanvas] Could not get 2d context!");
    return;
  }
  renderSyncStroke(ctx, { id: strokeId, tool: acc.tool, color: acc.color, size: acc.size, pts: acc.allPts });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStrokeSync({
  hasSession,
  collabScope,
  activeRoomId,
  selfIdRef,
  canvasRef,
  remoteStrokeCanvasRef,
  placedItems,
  selectedPaper,
  applySharedCanvasState,
  onRemotePlacedItemAdd,
  onRemotePlacedItemRemove,
  saveBoardState,
  loadBoardState,
}: UseStrokeSyncOptions) {
  const onRemotePlacedItemAddRef = useRef(onRemotePlacedItemAdd);
  const onRemotePlacedItemRemoveRef = useRef(onRemotePlacedItemRemove);
  onRemotePlacedItemAddRef.current = onRemotePlacedItemAdd;
  onRemotePlacedItemRemoveRef.current = onRemotePlacedItemRemove;
  type Channel = ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]>;
  const channelRef = useRef<Channel | null>(null);

  // Each artist's live (in-progress) stroke — accumulated from delta broadcasts
  // so the remote overlay always shows the full stroke, not just each chunk.
  const remoteActiveStrokesRef = useRef<Map<string, LiveAccumulated>>(new Map());
  const renderedStrokeIdsRef = useRef<Set<string>>(new Set());
  const strokeRafRef = useRef<number | null>(null);
  
  // Completed remote strokes that need to be rendered in the main canvas
  // (separate from local strokes so they don't get cleared on undo)
  // Using state so changes trigger re-renders in DrawingCanvas
  const [remoteCompletedStrokes, setRemoteCompletedStrokes] = useState<SyncStroke[]>([]);
  
  // Strokes loaded from database on initial load
  const [dbStrokes, setDbStrokes] = useState<SyncStroke[]>([]);

  // Board metadata (items / paper) sync guards
  const hasReceivedRemoteBoardRef = useRef(false);
  const lastAppliedBoardTsRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const lastSyncedItemsFingerprintRef = useRef("");
  const persistDirtyRef = useRef(false);

  // Whether the initial DB load has completed (gate DB writes until then)
  const isSessionReadyRef = useRef(false);

  // Stable refs so setInterval / setTimeout closures always see fresh values
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  const placedItemsRef = useRef(placedItems);
  const selectedPaperRef = useRef<PaperBackground | null>(selectedPaper ?? null);

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => {
    placedItemsRef.current = placedItems;
    selectedPaperRef.current = selectedPaper ?? null;
  }, [placedItems, selectedPaper]);

  // ── Remote stroke rendering ─────────────────────────────────────────────────

  const renderRemoteStrokes = useCallback(() => {
    const canvas = remoteStrokeCanvasRef.current;
    if (!canvas) {
      console.warn("[renderRemoteStrokes] No remote stroke canvas available!");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[renderRemoteStrokes] Could not get canvas context!");
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of remoteActiveStrokesRef.current.values()) {
      renderSyncStroke(ctx, {
        id: stroke.strokeId,
        tool: stroke.tool,
        color: stroke.color,
        size: stroke.size,
        pts: stroke.allPts,
      });
    }
    strokeRafRef.current =
      remoteActiveStrokesRef.current.size > 0
        ? requestAnimationFrame(renderRemoteStrokes)
        : null;
  }, [remoteStrokeCanvasRef]);

  // ── Initial load: replay stroke history + board metadata ───────────────────

  useEffect(() => {
    if (!hasSession || !collabScope) return;

    // Reset guards on scope change
    isSessionReadyRef.current = false;
    hasReceivedRemoteBoardRef.current = false;
    renderedStrokeIdsRef.current.clear();

    const init = async () => {
      // 1. Load placed items + paper from studio_boards
      const boardState = await loadBoardState(activeRoomId);
      if (boardState && !hasReceivedRemoteBoardRef.current) {
        if (boardState.placedItems.length > 0 || boardState.selectedPaper) {
          applySharedCanvasState({
            placedItems: boardState.placedItems,
            selectedPaper: boardState.selectedPaper,
          });
        }
        lastSyncedItemsFingerprintRef.current = JSON.stringify({
          p: boardState.placedItems,
          paper: boardState.selectedPaper?.id ?? null,
        });
        lastAppliedBoardTsRef.current = Date.now();
      }

      // 2. Load and replay all strokes from board_strokes
      const supabase = createSupabaseBrowserClient();
      const { data: rows, error } = await supabase
        .from("board_strokes")
        .select("id, tool, color, size, points")
        .eq("room_id", collabScope)
        .order("seq", { ascending: true })
        .limit(10000);

      if (error) {
        const msg = String(error.message ?? "").toLowerCase();
        if (
          !msg.includes("relation") &&
          !msg.includes("does not exist") &&
          !msg.includes("permission")
        ) {
          console.warn("[useStrokeSync] stroke load error:", error.message);
        }
      } else if (rows?.length) {
        // Store DB strokes in state so DrawingCanvas can render them properly
        const loadedStrokes: SyncStroke[] = rows.map(row => {
          const raw = row.points as unknown;
          let pts: [number, number, number][];
          let layerIndex = 0;
          if (Array.isArray(raw)) {
            pts = raw as [number, number, number][];
          } else if (raw && typeof raw === "object" && "pts" in (raw as object)) {
            const wrapped = raw as { v?: number; l?: number; pts: unknown };
            pts = (wrapped.pts as [number, number, number][]) ?? [];
            layerIndex = wrapped.l ?? 0;
          } else {
            pts = [];
          }
          return {
            id: row.id,
            tool: row.tool === "eraser" ? "eraser" : "pen",
            color: row.color ?? "#000000",
            size: row.size ?? 4,
            pts,
            layerIndex,
          };
        });
        setDbStrokes(loadedStrokes);
        for (const stroke of loadedStrokes) {
          renderedStrokeIdsRef.current.add(stroke.id);
        }
      }

      // 3. Snapshot replayed canvas as the undo baseline for this session
      canvasRef.current?.setSessionBase?.();
      isSessionReadyRef.current = true;
    };

    void init();
  }, [hasSession, collabScope, activeRoomId]);

  // ── Realtime broadcast channel ─────────────────────────────────────────────

  useEffect(() => {
    if (!hasSession || !collabScope) return;

    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`mochimail:${collabScope}`, {
        config: { broadcast: { self: false } },
      })
      // Live stroke points while another user is drawing
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const data = payload as LiveStrokePayload;
        if (!data?.artistId) {
          console.warn("[useStrokeSync] Received stroke with no artistId, ignoring");
          return;
        }
        if (data.artistId === selfIdRef.current) {
          return;
        }

        if (data.isLast) {
          const acc = remoteActiveStrokesRef.current.get(data.artistId);
          if (acc) appendDeltaPts(acc, data.pts);
          remoteActiveStrokesRef.current.delete(data.artistId);
          renderedStrokeIdsRef.current.add(data.strokeId);
          if (acc) {
            // Store the completed stroke so DrawingCanvas can render it in the correct layer
            setRemoteCompletedStrokes(prev => [...prev, {
              id: data.strokeId,
              tool: acc.tool,
              color: acc.color,
              size: acc.size,
              pts: acc.allPts,
              layerIndex: data.layerIndex ?? 0,
            }]);
            commitAccToCanvas(canvasRef, acc, data.strokeId);
          }
          // One extra render to wipe the completed stroke off the live overlay
          requestAnimationFrame(renderRemoteStrokes);
        } else {
          const existing = remoteActiveStrokesRef.current.get(data.artistId);
          if (existing?.strokeId === data.strokeId) {
            appendDeltaPts(existing, data.pts);
          } else {
            remoteActiveStrokesRef.current.set(data.artistId, {
              strokeId: data.strokeId,
              allPts: data.pts ? [...data.pts] : [],
              color: data.color,
              size: data.size,
              tool: data.tool,
            });
          }
          if (!strokeRafRef.current) {
            strokeRafRef.current = requestAnimationFrame(renderRemoteStrokes);
          }
        }
      })
      // Placed-items and paper changes from collaborators (bulk sync)
      .on("broadcast", { event: "board-update" }, ({ payload }) => {
        const data = payload as BoardUpdatePayload;
        if (!data?.senderId || data.senderId === selfIdRef.current) return;
        if (!Number.isFinite(data.ts) || data.ts <= lastAppliedBoardTsRef.current) return;

        hasReceivedRemoteBoardRef.current = true;
        lastAppliedBoardTsRef.current = data.ts;
        isApplyingRemoteRef.current = true;
        try {
          applySharedCanvasState({
            placedItems: data.placedItems,
            selectedPaper: data.selectedPaper,
          });
          lastSyncedItemsFingerprintRef.current = JSON.stringify({
            p: data.placedItems,
            paper: data.selectedPaper?.id ?? null,
          });
          persistDirtyRef.current = true;
        } finally {
          isApplyingRemoteRef.current = false;
        }
      })
      // Delta events: immediate add/remove for placed items (GIFs, stickers, text)
      .on("broadcast", { event: "placed-item-add" }, ({ payload }) => {
        const data = payload as PlacedItemAddPayload;
        if (!data?.senderId || data.senderId === selfIdRef.current || !data.item) return;
        onRemotePlacedItemAddRef.current(data.item);
        persistDirtyRef.current = true;
      })
      .on("broadcast", { event: "placed-item-remove" }, ({ payload }) => {
        const data = payload as PlacedItemRemovePayload;
        if (!data?.senderId || data.senderId === selfIdRef.current || !data.itemId) return;
        onRemotePlacedItemRemoveRef.current(data.itemId);
        persistDirtyRef.current = true;
      });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      if (strokeRafRef.current) {
        cancelAnimationFrame(strokeRafRef.current);
        strokeRafRef.current = null;
      }
      remoteActiveStrokesRef.current.clear();
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [hasSession, collabScope, renderRemoteStrokes]);

  // ── Items / paper broadcast (debounced 120 ms) ─────────────────────────────

  useEffect(() => {
    if (!hasSession || !collabScope) return;
    if (isApplyingRemoteRef.current) return;

    const fingerprint = JSON.stringify({
      p: placedItems,
      paper: selectedPaper?.id ?? null,
    });
    if (fingerprint === lastSyncedItemsFingerprintRef.current) return;

    const timer = globalThis.setTimeout(() => {
      const ch = channelRef.current;
      if (!ch) return;
      const ts = Date.now();
      void ch.send({
        type: "broadcast",
        event: "board-update",
        payload: {
          senderId: selfIdRef.current,
          ts,
          placedItems,
          selectedPaper: selectedPaper ?? null,
        },
      });
      lastSyncedItemsFingerprintRef.current = fingerprint;
      lastAppliedBoardTsRef.current = ts;
    }, 120);

    return () => globalThis.clearTimeout(timer);
  }, [hasSession, placedItems, selectedPaper]);

  // ── Items / paper DB persistence (every 3 s when dirty) ───────────────────

  useEffect(() => {
    persistDirtyRef.current = true;
  }, [placedItems, selectedPaper]);

  useEffect(() => {
    const id = globalThis.setInterval(async () => {
      if (!persistDirtyRef.current) return;
      persistDirtyRef.current = false;
      await saveBoardState(
        null,
        placedItemsRef.current,
        selectedPaperRef.current,
        activeRoomIdRef.current,
      );
    }, 3000);
    return () => globalThis.clearInterval(id);
  }, [saveBoardState]);

  // ── Public API ─────────────────────────────────────────────────────────────

  // Send a live stroke update during drawing (fire-and-forget broadcast)
  const broadcastStroke = useCallback(
    (
      strokeId: string,
      pts: [number, number, number][],
      color: string,
      size: number,
      tool: "pen" | "eraser",
      isLast: boolean,
      layerIndex = 0,
    ) => {
      const ch = channelRef.current;
      if (!ch) {
        console.warn("[broadcastStroke] No channel available - stroke not broadcast", { hasSession, collabScope, strokeId, pts: pts.length });
        return;
      }
      void ch.send({
        type: "broadcast",
        event: "stroke",
        payload: { artistId: selfIdRef.current, strokeId, pts, color, size, tool, isLast, layerIndex },
      });
    },
    [hasSession, collabScope],
  );

  // Persist a completed stroke to the DB immediately (called on pointer-up)
  const saveStroke = useCallback(
    async (
      strokeId: string,
      pts: [number, number, number][],
      color: string,
      size: number,
      tool: "pen" | "eraser",
      layerIndex = 0,
    ) => {
      if (!hasSession || !collabScope || !isSessionReadyRef.current) return;
      renderedStrokeIdsRef.current.add(strokeId);
      const supabase = createSupabaseBrowserClient();
      // Encode layerIndex into the points payload so it survives a page refresh.
      // Old strokes stored as plain arrays default to layer 0 on load.
      const pointsPayload: Json = layerIndex !== 0
        ? ({ v: 2, l: layerIndex, pts } as unknown as Json)
        : (pts as unknown as Json);
      const { error } = await supabase.from("board_strokes").insert({
        id: strokeId,
        room_id: collabScope,
        artist_id: selfIdRef.current ?? "unknown",
        tool,
        color,
        size,
        points: pointsPayload,
        seq: Date.now(),
      });
      if (error) {
        const msg = String(error.message ?? "").toLowerCase();
        if (
          !msg.includes("relation") &&
          !msg.includes("does not exist") &&
          !msg.includes("permission")
        ) {
          console.warn("[useStrokeSync] Failed to save stroke:", error.message);
        }
      }
    },
    [hasSession, collabScope],
  );

  // Delete a stroke from the DB (called on undo)
  const deleteStroke = useCallback(
    async (strokeId: string) => {
      if (!hasSession || !collabScope) return;
      renderedStrokeIdsRef.current.delete(strokeId);
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from("board_strokes")
        .delete()
        .eq("id", strokeId)
        .eq("room_id", collabScope);
    },
    [hasSession, collabScope],
  );

  // Re-insert a stroke that was previously deleted (called on redo)
  const restoreStroke = useCallback(
    async (stroke: SyncStroke) => {
      await saveStroke(stroke.id, stroke.pts, stroke.color, stroke.size, stroke.tool, stroke.layerIndex ?? 0);
    },
    [saveStroke],
  );

  const broadcastPlacedItemAdd = useCallback((item: PlacedSticker) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: "broadcast",
      event: "placed-item-add",
      payload: { senderId: selfIdRef.current, item } satisfies PlacedItemAddPayload,
    });
  }, []);

  const broadcastPlacedItemRemove = useCallback((itemId: string) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: "broadcast",
      event: "placed-item-remove",
      payload: { senderId: selfIdRef.current, itemId } satisfies PlacedItemRemovePayload,
    });
  }, []);

  const clearDbStrokes = useCallback(() => {
    setDbStrokes([]);
    setRemoteCompletedStrokes([]);
  }, []);

  return {
    broadcastStroke,
    saveStroke,
    deleteStroke,
    restoreStroke,
    broadcastPlacedItemAdd,
    broadcastPlacedItemRemove,
    remoteCompletedStrokes,
    dbStrokes,
    clearDbStrokes,
  };
}
