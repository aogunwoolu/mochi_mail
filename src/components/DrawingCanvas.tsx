
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { getStroke } from "perfect-freehand";
import { strokeOpts, strokeToPath2D } from "@/lib/canvas/strokeUtils";
import {
  BrushSettings,
  CustomFont,
  PaperBackground,
  PlacedSticker,
  Sticker,
  WashiTape,
} from "@/types";
import type { SyncStroke } from "@/hooks/useStrokeSync";

// ─── Public handle (exposed via ref) ─────────────────────────────────────────

export interface DrawingCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getCanvasImageData: () => string | null;
  setCanvasImageData: (
    imageData: string | null,
    options?: { shiftX?: number; shiftY?: number },
  ) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  /** Full composite including current animated-GIF frame — use for static PNG export. */
  getCompositeCanvas: () => HTMLCanvasElement;
  /**
   * Static layers only (background + strokes + overlay stickers, no animated GIFs).
   * Use as the base for animated export; call drawAnimatedLayer() each rAF tick on top.
   */
  getBaseCanvas: () => HTMLCanvasElement;
  /**
   * Draws the current animated-GIF frames onto an external canvas context.
   * Call inside a requestAnimationFrame loop to record a live animation.
   */
  drawAnimatedLayer: (ctx: CanvasRenderingContext2D) => void;
  shiftContent: (dx: number, dy: number) => void;
  /** Called after the initial stroke replay so undo has a clean baseline. */
  setSessionBase?: () => void;
  /**
   * Swap the layerIndex of all in-session strokes between two layers.
   * Call this when the user reorders layers so stroke z-order updates immediately.
   */
  swapStrokeLayers: (layerA: number, layerB: number) => void;
}

// ─── Local stroke entry (lightweight — no pixel data) ────────────────────────

type LocalStrokeEntry = {
  id: string;
  pts: [number, number, number][];
  color: string;
  size: number;
  tool: "pen" | "eraser";
  layerIndex: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  brushSettings: BrushSettings;
  placedItems: PlacedSticker[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  customFonts?: CustomFont[];
  onPlaceAsset: (asset: Sticker | WashiTape, x: number, y: number, layerIndex?: number) => void;
  onAddTextItem?: (item: PlacedSticker) => PlacedSticker | void;
  onUpdatePlacedItem?: (id: string, updates: Partial<PlacedSticker>) => void;
  removePlacedItem?: (id: string) => void;
  /** @deprecated use removePlacedItem */
  removeAnimatedSticker?: (id: string) => void;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  width?: number;
  height?: number;
  fillContainer?: boolean;
  backgroundMode?: "tile" | "cover";
  /**
   * Fired every ~16 ms while drawing and once with isLast=true on pointer-up.
   * The sync layer uses this to broadcast live strokes to collaborators.
   */
  onStrokeUpdate?: (
    strokeId: string,
    pts: [number, number, number][],
    color: string,
    size: number,
    tool: "pen" | "eraser",
    isLast: boolean,
    layerIndex: number,
  ) => void;
  /**
   * Fired once when a stroke is fully committed (pointer-up).
   * The sync layer uses this to persist the stroke to the DB immediately.
   */
  onStrokeComplete?: (
    strokeId: string,
    pts: [number, number, number][],
    color: string,
    size: number,
    tool: "pen" | "eraser",
    layerIndex: number,
  ) => void;
  /** Fired when the user undoes — sync layer should delete the stroke from DB. */
  onUndoStroke?: (strokeId: string) => void;
  /** Fired when the user redoes — sync layer should re-insert the stroke to DB. */
  onRedoStroke?: (stroke: LocalStrokeEntry) => void;
  /** Fired whenever the selected item changes (id or null). */
  onItemSelected?: (id: string | null) => void;
  /** Externally-controlled selected item id. Synced into internal state. */
  externalSelectedItemId?: string | null;
  /** @deprecated Drawing layer isolation removed - drawings now use the same layer system as items */
  drawingLayerIndex?: number;
  /** layerIndex assigned to newly placed stickers/text. */
  defaultLayerIndex?: number;
  /** Max layer index the UI should allow (layerCount - 1). */
  maxLayerIndex?: number;
  /** Current layer index for drawing strokes. If not provided, uses defaultLayerIndex. */
  currentDrawingLayer?: number;
  /** Display order of stable layer ids (position 0 = back, last = front). */
  layerOrder?: number[];
  /** Stable layer ids whose content should be hidden from rendering. */
  hiddenLayerIds?: number[];
  /** Remote strokes that should be rendered (live collaboration) */
  remoteStrokes?: SyncStroke[];
  /** Strokes loaded from database on initial load */
  dbStrokes?: SyncStroke[];
  /**
   * Fired every frame during a 2-finger gesture.
   * prevCx/prevCy = centroid last frame, cx/cy = centroid this frame.
   * scaleDelta = dist_this / dist_prev (1.0 = no zoom change).
   * One call handles both pan and zoom — do NOT adjust scroll separately.
   */
  onPinchZoom?: (scaleDelta: number, prevCx: number, prevCy: number, cx: number, cy: number) => void;
  /** Fired when the 2-finger gesture ends, with the final pan velocity (px/frame at 60fps). */
  onPinchGestureEnd?: (velX: number, velY: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  (
    {
      brushSettings,
      placedItems,
      selectedAsset,
      selectedPaper,
      customFonts = [],
      remoteStrokes,
      dbStrokes,
      onPlaceAsset,
      onAddTextItem,
      onUpdatePlacedItem,
      removePlacedItem,
      removeAnimatedSticker,
      backgroundOffsetX = 0,
      backgroundOffsetY = 0,
      width = 1200,
      height = 800,
      fillContainer = false,
      backgroundMode = "tile",
      onStrokeUpdate,
      onStrokeComplete,
      onUndoStroke,
      onRedoStroke,
      onItemSelected,
      externalSelectedItemId,
      drawingLayerIndex = 0,
      defaultLayerIndex = 0,
      maxLayerIndex = 4,
      currentDrawingLayer,
      layerOrder,
      hiddenLayerIds,
      onPinchZoom,
      onPinchGestureEnd,
    },
    ref,
  ) => {
    // Resolve layerOrder + hidden set, with backward-compatible default (identity).
    const resolvedLayerOrder = useMemo(
      () => layerOrder ?? Array.from({ length: maxLayerIndex + 1 }, (_, i) => i),
      [layerOrder, maxLayerIndex],
    );
    const hiddenSet = useMemo(() => new Set(hiddenLayerIds ?? []), [hiddenLayerIds]);
    // Stable lookup: stable id → display position
    const positionOf = useCallback(
      (id: number) => {
        const p = resolvedLayerOrder.indexOf(id);
        return p < 0 ? 0 : p;
      },
      [resolvedLayerOrder],
    );
    // Ref so closures inside render callbacks always see fresh order without invalidating
    const layerOrderRef = useRef(resolvedLayerOrder);
    layerOrderRef.current = resolvedLayerOrder;
    const hiddenSetRef = useRef(hiddenSet);
    hiddenSetRef.current = hiddenSet;
    // ── Canvas refs ──────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);         // pointer-capture only (transparent, no rendering)
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const activeStrokeCanvasRef = useRef<HTMLCanvasElement>(null);
    // Per-layer canvases — one per layer index so animated GIFs can be interleaved
    const layerCanvasRefs = useRef<(HTMLCanvasElement | null)[]>(
      Array.from({ length: 5 }, () => null)
    );

    // Stable ref so render functions always read the current drawing layer without
    // being listed as useCallback deps (avoids constant callback recreation).
    const currentDrawingLayerRef = useRef(currentDrawingLayer ?? defaultLayerIndex);

    // ── Drawing state ────────────────────────────────────────────────────────
    const isDrawing = useRef(false);
    const activePointerIdRef = useRef<number | null>(null);
    const activeStrokePointsRef = useRef<[number, number, number][]>([]);
    const preStrokeSnapshotRef = useRef<ImageData | null>(null);
    const lastStrokeBroadcastAtRef = useRef(0);
    const strokeDirtyRef = useRef(false);
    const frozenPointCountRef = useRef(0);
    const currentStrokeIdRef = useRef<string>("");

    // ── Undo / redo (stroke-based, no giant ImageData arrays) ────────────────
    // sessionBaseRef: GPU-backed snapshot of the canvas at session-start (after
    // replaying remote strokes). Only ONE bitmap is held instead of 30×115 MB.
    const sessionBaseRef = useRef<ImageBitmap | null>(null);
    const localStrokesRef = useRef<LocalStrokeEntry[]>([]);
    const undoneStrokesRef = useRef<LocalStrokeEntry[]>([]);
    
    // ── Remote strokes from collaborators ────────────────────────────────────
    // These persist across render cycles so they're not cleared by renderAllLayerCanvases
    const remoteStrokesRef = useRef<SyncStroke[]>([]);
    const [remoteStrokesVersion, setRemoteStrokesVersion] = useState(0);

    // ── Multi-touch pan / pinch refs ─────────────────────────────────────────
    // Tracks all active pointers by id so we can detect 2-finger gestures.
    const mtPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const isPinchPanRef = useRef(false);
    const pinchCentroidRef = useRef({ x: 0, y: 0 });
    const pinchDistRef = useRef(0);
    const pinchLastTimeRef = useRef(0);
    const pinchVelRef = useRef({ x: 0, y: 0 });

    // ── Washi / select drag refs ─────────────────────────────────────────────
    const washiStartRef = useRef<{ x: number; y: number } | null>(null);
    const changedDuringPointerRef = useRef(false);
    const selectionDragRef = useRef<{
      id: string;
      offsetX: number;
      offsetY: number;
    } | null>(null);
    const handleDragRef = useRef<{
      type: "resize" | "rotate";
      corner?: "nw" | "ne" | "sw" | "se";
      startMouseX: number;
      startMouseY: number;
      startItem: PlacedSticker;
      canvasRect: DOMRect;
      scaleX: number;
      scaleY: number;
    } | null>(null);

    // ── Misc ─────────────────────────────────────────────────────────────────
    const [textOverlay, setTextOverlay] = useState<{
      id: string;
      x: number;
      y: number;
      value: string;
    } | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Stable ref so selectItem closure never captures stale callback
    const onItemSelectedRef = useRef(onItemSelected);
    onItemSelectedRef.current = onItemSelected;

    const selectItem = useCallback((id: string | null) => {
      setSelectedItemId(id);
      onItemSelectedRef.current?.(id);
    }, []);

    // Sync external selection → internal (e.g. layer panel clicking an item)
    useEffect(() => {
      if (externalSelectedItemId !== undefined) {
        setSelectedItemId(externalSelectedItemId ?? null);
      }
    }, [externalSelectedItemId]);
    
    // Sync remote strokes from collaboration
    useEffect(() => {
      if (remoteStrokes && remoteStrokes.length > 0) {
        remoteStrokesRef.current = [...remoteStrokesRef.current, ...remoteStrokes];
        setRemoteStrokesVersion(v => v + 1);
      }
    }, [remoteStrokes]);
    
    // Sync DB strokes - these are the initial load from the database
    useEffect(() => {
      if (dbStrokes && dbStrokes.length > 0) {
        setRemoteStrokesVersion(v => v + 1);
      }
    }, [dbStrokes]);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [displayScale, setDisplayScale] = useState(1);
    const assetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const paperImageRef = useRef<HTMLImageElement | null>(null);
    // Keep currentDrawingLayerRef in sync on every render so render callbacks always
    // read the correct layer without being listed as useCallback deps.
    currentDrawingLayerRef.current = currentDrawingLayer ?? defaultLayerIndex;

    // Stable ref so getCompositeCanvas closure always sees fresh placedItems
    // Items sorted by display position (back→front) — used for render + hit detection
    const sortedByLayer = useMemo(
      () => [...placedItems].sort((a, b) => positionOf(a.layerIndex ?? 0) - positionOf(b.layerIndex ?? 0)),
      [placedItems, positionOf],
    );

    // Stable ref so getCompositeCanvas / drawAnimatedLayer always see the correct render order
    const placedItemsRef = useRef(sortedByLayer);
    placedItemsRef.current = sortedByLayer;
    // DOM refs for animated <img> elements — these are in the live document so the
    // browser advances their GIF frames. drawAnimatedLayer() reads from here.
    const animatedImgRefsRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const rafIdRef = useRef<number | null>(null);
    // Stable ref so handlePointerMove can call handlePointerUp without a dep cycle
    const handlePointerUpRef = useRef<((e?: React.PointerEvent<HTMLCanvasElement>) => void) | null>(null);

    // Full accumulated points for the current stroke — used for broadcasting and DB
    // persistence.  activeStrokePointsRef is trimmed by the freeze algorithm (for
    // render perf), so we keep a separate unbounded copy here.
    const allStrokePointsRef = useRef<[number, number, number][]>([]);
    const lastBroadcastIndexRef = useRef(0);

    // ── Overlay rendering (stickers / text) ──────────────────────────────────
    const renderItemsToCtx = useCallback((ctx: CanvasRenderingContext2D, items: PlacedSticker[]) => {
      const wrapLines = (text: string, maxWidth: number, font: string): string[] => {
        ctx.font = font;
        const lines: string[] = [];
        for (const hardLine of text.split("\n")) {
          const words = hardLine.split(" ");
          if (!words.length) { lines.push(""); continue; }
          let current = words[0] ?? "";
          for (let i = 1; i < words.length; i++) {
            const next = `${current} ${words[i]}`;
            if (ctx.measureText(next).width <= maxWidth) {
              current = next;
            } else {
              lines.push(current);
              current = words[i] ?? "";
            }
          }
          lines.push(current);
        }
        return lines;
      };

      items.forEach((item) => {
        if (item.type === "text") {
          const fontSize = Math.max(10, item.textSize ?? 28);
          const fontFamily = item.textFont?.startsWith("custom:")
            ? '"Space Mono", monospace'
            : (item.textFont ?? '"Space Mono", monospace');
          const lines = wrapLines(
            item.text ?? "",
            Math.max(40, item.width - 10),
            `${fontSize}px ${fontFamily}`,
          );
          ctx.save();
          ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
          ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.translate(-item.width / 2, -item.height / 2);
          ctx.globalAlpha = item.opacity;
          ctx.font = `${fontSize}px ${fontFamily}`;
          ctx.fillStyle = item.textColor ?? "#1e1e2e";
          ctx.textBaseline = "top";
          let y = 4;
          const lineHeight = fontSize * 1.35;
          lines.forEach((line) => {
            ctx.fillText(line, 4, y, Math.max(20, item.width - 8));
            y += lineHeight;
          });
          ctx.restore();
          ctx.globalAlpha = 1;
          return;
        }
        if (item.isAnimated) return;
        const img = assetImagesRef.current.get(item.id);
        if (img?.complete) {
          ctx.globalAlpha = item.opacity;
          ctx.save();
          ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
          ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      });
    }, []);

    // ── Shared stroke render helper ──────────────────────────────────────────
    // Renders all data (local + remote + db strokes + items) into `ctx` for a
    // contiguous range of display positions [fromPos..toPos] (inclusive).
    // Strokes/items are bucketed by stable id; we look up the id at each position
    // via layerOrderRef and skip ids marked hidden.
    const renderLayerRange = useCallback((
      ctx: CanvasRenderingContext2D,
      fromPos: number,
      toPos: number,
    ) => {
      type AnyStroke = { tool: string; pts: [number,number,number][]; color: string; size: number };

      const drawStroke = (s: AnyStroke) => {
        const isEraser = s.tool === "eraser";
        const outline = getStroke(s.pts, strokeOpts(s.size, isEraser));
        if (!outline.length) return;
        ctx.save();
        if (isEraser) { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,1)"; }
        else { ctx.fillStyle = s.color; }
        ctx.fill(strokeToPath2D(outline));
        ctx.restore();
      };

      // Index all stroke and item data by stable layer id
      const localById: Record<number, LocalStrokeEntry[]> = {};
      for (const s of localStrokesRef.current) {
        (localById[s.layerIndex] ??= []).push(s);
      }
      const remoteById: Record<number, SyncStroke[]> = {};
      for (const s of remoteStrokesRef.current) {
        (remoteById[s.layerIndex ?? 0] ??= []).push(s);
      }
      const dbById: Record<number, SyncStroke[]> = {};
      for (const s of (dbStrokes ?? [])) {
        (dbById[s.layerIndex ?? 0] ??= []).push(s);
      }
      const itemsById: Record<number, PlacedSticker[]> = {};
      for (const item of placedItemsRef.current) {
        if (item.isAnimated) continue;
        (itemsById[item.layerIndex ?? 0] ??= []).push(item);
      }

      const order = layerOrderRef.current;
      const hidden = hiddenSetRef.current;
      for (let pos = fromPos; pos <= toPos; pos++) {
        const id = order[pos];
        if (id === undefined || hidden.has(id)) continue;
        for (const s of (dbById[id] ?? [])) drawStroke(s);
        for (const s of (remoteById[id] ?? [])) drawStroke(s);
        for (const s of (localById[id] ?? [])) drawStroke(s);
        renderItemsToCtx(ctx, itemsById[id] ?? []);
      }
    }, [renderItemsToCtx, remoteStrokesVersion, dbStrokes]);

    // ── Per-layer canvas rendering ────────────────────────────────────────────
    // layerCanvasRefs[L] → renders exactly layer L
    // activeStrokeCanvas sits above layer currentDrawingLayer at z = L*3+3
    // animated GIF DOM items sit between layer canvases at z = L*3+2

    const renderAllLayerCanvases = useCallback(() => {
      for (let li = 0; li <= maxLayerIndex; li++) {
        const canvas = layerCanvasRefs.current[li];
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderLayerRange(ctx, li, li);
      }
    }, [renderLayerRange, maxLayerIndex]);

    const renderAllLayerCanvasesRef = useRef(renderAllLayerCanvases);
    renderAllLayerCanvasesRef.current = renderAllLayerCanvases;

    const renderAll = useCallback(() => {
      renderAllLayerCanvasesRef.current();
    }, []);

    useEffect(() => {
      renderAllLayerCanvases();
    }, [renderAllLayerCanvases, placedItems, remoteStrokesVersion, dbStrokes, currentDrawingLayer, resolvedLayerOrder, hiddenSet]);

    // ── Active stroke rendering (RAF loop) ───────────────────────────────────
    const renderActiveStroke = useCallback(() => {
      const pts = activeStrokePointsRef.current;
      if (!pts.length) return;

      const { tool, color, size } = brushSettings;
      const isEraser = tool === "eraser";

      const stroke = getStroke(pts, strokeOpts(size, isEraser));

      const path = strokeToPath2D(stroke);

      if (isEraser) {
        const activeLayerId = currentDrawingLayerRef.current ?? 0;
        const activeLayerPos = layerOrderRef.current.indexOf(activeLayerId);
        const canvas = layerCanvasRefs.current[activeLayerPos < 0 ? 0 : activeLayerPos];
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (preStrokeSnapshotRef.current) {
          ctx.putImageData(preStrokeSnapshotRef.current, 0, 0);
        }
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fill(path);
        ctx.restore();
      } else {
        const activeCanvas = activeStrokeCanvasRef.current;
        if (!activeCanvas) return;
        const activeCtx = activeCanvas.getContext("2d");
        if (!activeCtx) return;

        // Point-freeze algorithm: cap getStroke() work to ~14 pts, preventing
        // O(n²) lag on long strokes by committing the stable head incrementally.
        const FREEZE_AT = 10;
        const LIVE_WINDOW = 4;
        const OVERLAP = 8;

        const uncommitted = pts.length - frozenPointCountRef.current;
        if (uncommitted > FREEZE_AT + LIVE_WINDOW) {
          const newFreezeEnd = pts.length - LIVE_WINDOW;
          const headOutline = getStroke(pts.slice(0, newFreezeEnd), strokeOpts(size, false, false));
          const mainCtx = layerCanvasRefs.current[Math.max(0, layerOrderRef.current.indexOf(currentDrawingLayerRef.current ?? 0))]?.getContext("2d");
          if (mainCtx) {
            mainCtx.save();
            mainCtx.fillStyle = color;
            mainCtx.fill(strokeToPath2D(headOutline));
            mainCtx.restore();
          }
          activeStrokePointsRef.current = pts.slice(newFreezeEnd - OVERLAP);
          frozenPointCountRef.current = OVERLAP;
        }

        const livePts = activeStrokePointsRef.current;
        const liveStart = Math.max(0, frozenPointCountRef.current - OVERLAP);
        const liveOutline = getStroke(livePts.slice(liveStart), strokeOpts(size, false));
        activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        activeCtx.save();
        activeCtx.fillStyle = color;
        activeCtx.fill(strokeToPath2D(liveOutline));
        activeCtx.restore();
      }
    }, [brushSettings]);

    const renderLoop = useCallback(() => {
      if (strokeDirtyRef.current) {
        strokeDirtyRef.current = false;
        renderActiveStroke();
      }
      rafIdRef.current = requestAnimationFrame(renderLoop);
    }, [renderActiveStroke]);

    // ── Preload asset images ──────────────────────────────────────────────────
    useEffect(() => {
      const currentIds = new Set(placedItems.map((item) => item.id));
      for (const id of assetImagesRef.current.keys()) {
        if (!currentIds.has(id)) assetImagesRef.current.delete(id);
      }
      placedItems.forEach((item) => {
        if (!assetImagesRef.current.has(item.id)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = item.imageData;
          img.onload = () => renderAllLayerCanvasesRef.current();
          assetImagesRef.current.set(item.id, img);
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placedItems]);

    useEffect(() => {
      if (selectedAsset && !assetImagesRef.current.has(selectedAsset.id)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = selectedAsset.imageData;
        assetImagesRef.current.set(selectedAsset.id, img);
      }
    }, [selectedAsset]);

    const renderOverlay = useCallback(() => {
      // Render items to overlay canvas, separated by layer
      const above = overlayCanvasRef.current;
      if (above) {
        const ctx = above.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, above.width, above.height);
      }

    }, []);

    useEffect(() => { renderOverlay(); }, [renderOverlay]);

    // ── Background rendering ──────────────────────────────────────────────────
    const renderBackground = useCallback(() => {
      const background = backgroundCanvasRef.current;
      if (!background) return;
      const ctx = background.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, background.width, background.height);

      if (selectedPaper && paperImageRef.current?.complete) {
        const paper = paperImageRef.current;
        if (backgroundMode === "cover") {
          const srcW = paper.naturalWidth || paper.width || background.width;
          const srcH = paper.naturalHeight || paper.height || background.height;
          const srcRatio = srcW / srcH;
          const dstRatio = background.width / background.height;
          let drawW = background.width;
          let drawH = background.height;
          let offsetX = 0;
          let offsetY = 0;
          if (srcRatio > dstRatio) {
            drawH = background.height;
            drawW = drawH * srcRatio;
            offsetX = (background.width - drawW) / 2;
          } else {
            drawW = background.width;
            drawH = drawW / srcRatio;
            offsetY = (background.height - drawH) / 2;
          }
          ctx.drawImage(paper, offsetX, offsetY, drawW, drawH);
          return;
        }
        const tileW = paper.naturalWidth || paper.width || background.width;
        const tileH = paper.naturalHeight || paper.height || background.height;
        const startX = -((((backgroundOffsetX % tileW) + tileW) % tileW));
        const startY = -((((backgroundOffsetY % tileH) + tileH) % tileH));
        for (let y = startY; y < background.height; y += tileH) {
          for (let x = startX; x < background.width; x += tileW) {
            ctx.drawImage(paper, x, y, tileW, tileH);
          }
        }
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, background.width, background.height);
        ctx.strokeStyle = "rgba(175, 165, 200, 0.28)";
        ctx.lineWidth = 1;
        const lineSpacing = 32;
        const lineOffset = ((backgroundOffsetY % lineSpacing) + lineSpacing) % lineSpacing;
        for (
          let y = lineSpacing - lineOffset;
          y < background.height + lineSpacing;
          y += lineSpacing
        ) {
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(background.width, Math.round(y) + 0.5);
          ctx.stroke();
        }
      }
    }, [selectedPaper, backgroundOffsetX, backgroundOffsetY, backgroundMode]);

    useEffect(() => {
      if (!selectedPaper) {
        paperImageRef.current = null;
        renderBackground();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = selectedPaper.imageData;
      img.onload = () => {
        paperImageRef.current = img;
        renderBackground();
      };
      paperImageRef.current = img;
    }, [selectedPaper, renderBackground]);

    useEffect(() => {
      renderBackground();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]);

    // ── Input helpers ─────────────────────────────────────────────────────────
    const getCanvasPoint = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
        const rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (canvas.width / rect.width),
          y: (e.clientY - rect.top) * (canvas.height / rect.height),
          pressure: e.pressure || 0.5,
        };
      },
      [],
    );

    const pointHitsItem = useCallback(
      (x: number, y: number, item: PlacedSticker) => {
        const centerX = item.x + item.width / 2;
        const centerY = item.y + item.height / 2;
        const angle = (-item.rotation * Math.PI) / 180;
        const dx = x - centerX;
        const dy = y - centerY;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        return (
          localX >= -item.width / 2 &&
          localX <= item.width / 2 &&
          localY >= -item.height / 2 &&
          localY <= item.height / 2
        );
      },
      [],
    );

    const paintWashiStrip = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        from: { x: number; y: number },
        to: { x: number; y: number },
        tape: Sticker | WashiTape,
      ) => {
        const img = assetImagesRef.current.get(tape.id);
        if (!img?.complete) return;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);
        if (length < 2) return;
        ctx.save();
        ctx.translate(from.x, from.y);
        ctx.rotate(Math.atan2(dy, dx));
        const pattern = ctx.createPattern(img, "repeat");
        if (pattern) {
          ctx.globalAlpha = "opacity" in tape ? tape.opacity : 0.85;
          ctx.fillStyle = pattern;
          ctx.fillRect(0, -tape.height / 2, length, tape.height);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },
      [],
    );

    // ── Pointer handlers ──────────────────────────────────────────────────────
    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        // Track every pointer for pinch/pan detection
        mtPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (mtPointersRef.current.size >= 2) {
          // Capture this pointer so its pointermove events are guaranteed to reach
          // the canvas — without this, iOS only delivers moves for the primary pointer.
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }

          // Second finger — abort any in-progress stroke and enter pan/pinch mode
          if (isDrawing.current) {
            isDrawing.current = false;
            activeStrokePointsRef.current = [];
            allStrokePointsRef.current = [];
            if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
            activeStrokeCanvasRef.current?.getContext("2d")?.clearRect(
              0, 0,
              activeStrokeCanvasRef.current.width,
              activeStrokeCanvasRef.current.height,
            );
          }
          isPinchPanRef.current = true;
          const pts = [...mtPointersRef.current.values()];
          pinchCentroidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          const ddx = pts[1].x - pts[0].x;
          const ddy = pts[1].y - pts[0].y;
          pinchDistRef.current = Math.sqrt(ddx * ddx + ddy * ddy);
          e.preventDefault();
          return;
        }

        if (isPinchPanRef.current) { e.preventDefault(); return; }

        e.preventDefault();
        // Only allow primary pointer or if no pointer is active (prevents multi-touch drawing)
        if (!e.isPrimary && activePointerIdRef.current !== null) {
          return;
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore on unsupported browsers
        }
        activePointerIdRef.current = e.pointerId;
        const point = getCanvasPoint(e);

        if (brushSettings.tool === "text") {
          const target = [...sortedByLayer]
            .reverse()
            .find((item) => !hiddenSetRef.current.has(item.layerIndex ?? 0) && pointHitsItem(point.x, point.y, item));
          if (target?.type === "text") {
            selectItem(target.id);
            setTextOverlay({ id: target.id, x: target.x, y: target.y, value: target.text ?? "" });
            return;
          }
          const textSize = Math.max(
            12,
            brushSettings.textSize ?? Math.max(14, brushSettings.size * 3),
          );
          const textFont = brushSettings.textFont ?? '"Space Mono", monospace';
          const newItem: PlacedSticker = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            stickerId: "text",
            x: point.x,
            y: point.y,
            imageData: "",
            width: Math.max(190, textSize * 6.6),
            height: Math.max(58, textSize * 1.8),
            rotation: 0,
            type: "text",
            opacity: 1,
            text: "",
            textColor: brushSettings.color,
            textSize,
            textFont,
            layerIndex: defaultLayerIndex,
          };
          const created = onAddTextItem?.(newItem) ?? newItem;
          selectItem(created.id);
          setTextOverlay({
            id: created.id,
            x: created.x,
            y: created.y,
            value: created.text ?? "",
          });
          return;
        }

        if (brushSettings.tool === "select") {
          const target = [...sortedByLayer]
            .reverse()
            .find((item) => !hiddenSetRef.current.has(item.layerIndex ?? 0) && pointHitsItem(point.x, point.y, item));
          if (!target) {
            selectItem(null);
            selectionDragRef.current = null;
            activePointerIdRef.current = null;
            return;
          }
          selectItem(target.id);
          selectionDragRef.current = {
            id: target.id,
            offsetX: point.x - target.x,
            offsetY: point.y - target.y,
          };
          isDrawing.current = true;
          return;
        }

        if (brushSettings.tool === "sticker" && selectedAsset) {
          onPlaceAsset(
            selectedAsset,
            point.x - selectedAsset.width / 2,
            point.y - selectedAsset.height / 2,
            defaultLayerIndex,
          );
          activePointerIdRef.current = null;
          return;
        }

        if (brushSettings.tool === "washi" && selectedAsset) {
          changedDuringPointerRef.current = false;
          washiStartRef.current = { x: point.x, y: point.y };
          isDrawing.current = true;
          return;
        }

        // Pen / eraser — generate a fresh stroke ID
        currentStrokeIdRef.current = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        frozenPointCountRef.current = 0;

        if (brushSettings.tool === "eraser") {
          const activeLayerId = currentDrawingLayer ?? defaultLayerIndex;
          const activeLayerPos = layerOrderRef.current.indexOf(activeLayerId);
          const drawCanvas = layerCanvasRefs.current[activeLayerPos < 0 ? 0 : activeLayerPos];
          const drawCtx = drawCanvas?.getContext("2d");
          if (drawCtx && drawCanvas) {
            preStrokeSnapshotRef.current = drawCtx.getImageData(
              0,
              0,
              drawCanvas.width,
              drawCanvas.height,
            );
          }
        } else {
          preStrokeSnapshotRef.current = null;
          const ac = activeStrokeCanvasRef.current;
          if (ac) ac.getContext("2d")?.clearRect(0, 0, ac.width, ac.height);
        }

        activeStrokePointsRef.current = [[point.x, point.y, point.pressure]];
        allStrokePointsRef.current = [[point.x, point.y, point.pressure]];
        lastBroadcastIndexRef.current = 0;
        strokeDirtyRef.current = true;
        isDrawing.current = true;
        changedDuringPointerRef.current = true;
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(renderLoop);
      },
      [
        getCanvasPoint,
        sortedByLayer,
        pointHitsItem,
        selectedAsset,
        brushSettings.tool,
        brushSettings.textSize,
        brushSettings.textFont,
        brushSettings.color,
        brushSettings.size,
        onAddTextItem,
        onPlaceAsset,
        renderLoop,
        selectItem,
        currentDrawingLayer,
        defaultLayerIndex,
      ],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        // Keep multitouch map current
        if (mtPointersRef.current.has(e.pointerId)) {
          mtPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (isPinchPanRef.current && mtPointersRef.current.size >= 2) {
          e.preventDefault();
          const pts = [...mtPointersRef.current.values()];
          const cx = (pts[0].x + pts[1].x) / 2;
          const cy = (pts[0].y + pts[1].y) / 2;
          const ddx = pts[1].x - pts[0].x;
          const ddy = pts[1].y - pts[0].y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);

          // Track velocity for momentum after gesture end
          const now = performance.now();
          const dt = now - pinchLastTimeRef.current;
          pinchLastTimeRef.current = now;
          if (dt > 0 && dt < 200) {
            pinchVelRef.current = {
              x: (cx - pinchCentroidRef.current.x) / dt * 16,
              y: (cy - pinchCentroidRef.current.y) / dt * 16,
            };
          }

          // Fire ONE combined callback — parent handles pan+zoom in a single
          // scroll calculation to avoid double-write interference.
          const scaleDelta = pinchDistRef.current > 0 && dist > 0
            ? dist / pinchDistRef.current
            : 1;
          onPinchZoom?.(scaleDelta, pinchCentroidRef.current.x, pinchCentroidRef.current.y, cx, cy);

          pinchCentroidRef.current = { x: cx, y: cy };
          pinchDistRef.current = dist;
          return;
        }

        if (!isDrawing.current) return;
        // Only process events from the active pointer (prevents multi-touch issues)
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
          return;
        }
        // Apple Pencil hover detection — end stroke to prevent ghost lines
        if (e.pointerType === "pen" && e.buttons === 0) {
          handlePointerUpRef.current?.(e);
          return;
        }
        e.preventDefault();
        const point = getCanvasPoint(e);

        if (brushSettings.tool === "select" && selectionDragRef.current && onUpdatePlacedItem) {
          const drag = selectionDragRef.current;
          onUpdatePlacedItem(drag.id, {
            x: point.x - drag.offsetX,
            y: point.y - drag.offsetY,
          });
          return;
        }

        if (
          brushSettings.tool === "washi" &&
          selectedAsset &&
          washiStartRef.current
        ) {
          const overlay = overlayCanvasRef.current;
          if (!overlay) return;
          const octx = overlay.getContext("2d");
          if (!octx) return;
          octx.clearRect(0, 0, overlay.width, overlay.height);
          paintWashiStrip(octx, washiStartRef.current, { x: point.x, y: point.y }, selectedAsset);
          changedDuringPointerRef.current = true;
          return;
        }

        // Collect coalesced events for smooth high-frequency input
        const events =
          typeof e.nativeEvent.getCoalescedEvents === "function"
            ? e.nativeEvent.getCoalescedEvents()
            : [e.nativeEvent];

        const canvas = canvasRef.current;
        if (canvas) {
          // Hoist getBoundingClientRect outside the loop (one layout read per move)
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          for (const ev of events) {
            const pt: [number, number, number] = [
              (ev.clientX - rect.left) * scaleX,
              (ev.clientY - rect.top) * scaleY,
              ev.pressure || 0.5,
            ];
            activeStrokePointsRef.current.push(pt);
            allStrokePointsRef.current.push(pt); // unbounded — used for sync
          }
        }

        strokeDirtyRef.current = true;
        changedDuringPointerRef.current = true;

        // Throttle broadcast to ~60 fps; send only the NEW points since last
        // broadcast (delta) so remote users accumulate the full stroke.
        const now = performance.now();
        if (now - lastStrokeBroadcastAtRef.current >= 16) {
          lastStrokeBroadcastAtRef.current = now;
          const tool = brushSettings.tool === "eraser" ? "eraser" : "pen";
          const deltaPts = allStrokePointsRef.current.slice(lastBroadcastIndexRef.current);
          lastBroadcastIndexRef.current = allStrokePointsRef.current.length;
          if (deltaPts.length > 0) {
            onStrokeUpdate?.(
              currentStrokeIdRef.current,
              deltaPts,
              brushSettings.color,
              brushSettings.size,
              tool,
              false,
              currentDrawingLayer ?? defaultLayerIndex,
            );
          }
        }
      },
      [
        brushSettings.tool,
        brushSettings.color,
        brushSettings.size,
        selectedAsset,
        onUpdatePlacedItem,
        paintWashiStrip,
        onStrokeUpdate,
        getCanvasPoint,
        onPinchZoom,
        currentDrawingLayer,
        defaultLayerIndex,
      ],
    );

    const handlePointerUp = useCallback(
      (e?: React.PointerEvent<HTMLCanvasElement>) => {
        // Clean up multitouch tracking
        if (e) {
          mtPointersRef.current.delete(e.pointerId);
        } else {
          mtPointersRef.current.clear();
        }
        if (mtPointersRef.current.size < 2) {
          const wasPinching = isPinchPanRef.current;
          isPinchPanRef.current = false;
          if (wasPinching) {
            onPinchGestureEnd?.(pinchVelRef.current.x, pinchVelRef.current.y);
            pinchVelRef.current = { x: 0, y: 0 };
          }
        }
        // Still in pinch mode (one finger remains) — don't process as stroke end
        if (isPinchPanRef.current) return;

        if (e) {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
        // Only process pointer up for the active pointer
        if (e && activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
          return;
        }
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        const didDraw =
          isDrawing.current && activeStrokePointsRef.current.length > 0;

        if (didDraw) {
          renderActiveStroke();
          const tool: "pen" | "eraser" =
            brushSettings.tool === "eraser" ? "eraser" : "pen";
          const allPts = allStrokePointsRef.current;   // full unbounded history
          const { color, size } = brushSettings;
          const strokeId = currentStrokeIdRef.current;
          const strokeLayer = currentDrawingLayer ?? defaultLayerIndex;

          // Send any remaining unbroadcast points with isLast = true
          const remainingDelta = allPts.slice(lastBroadcastIndexRef.current);
          onStrokeUpdate?.(strokeId, remainingDelta, color, size, tool, true, strokeLayer);

          // Clear the active stroke canvas — the stroke now lives in localStrokesRef
          // and renderAll below will composite it at the correct layer depth.
          const ac = activeStrokeCanvasRef.current;
          if (ac) {
            ac.getContext("2d")?.clearRect(0, 0, ac.width, ac.height);
          }

          // Track this stroke locally for undo (full points)
          localStrokesRef.current.push({ id: strokeId, pts: allPts, color, size, tool, layerIndex: strokeLayer });
          undoneStrokesRef.current = []; // clear redo stack on new stroke

          // Re-render everything in correct layer order so the new stroke appears
          // at its proper depth relative to items and strokes on other layers.
          renderAll();

          // Persist immediately with full accumulated points
          onStrokeComplete?.(strokeId, allPts, color, size, tool, strokeLayer);
          currentStrokeIdRef.current = "";
        } else if (isDrawing.current) {
          // Washi — commit the overlay-canvas preview to the active layer canvas
          if (brushSettings.tool === "washi" && washiStartRef.current) {
            const ov = overlayCanvasRef.current;
            const activeLayerId = currentDrawingLayer ?? defaultLayerIndex;
            const activeLayerPos = layerOrderRef.current.indexOf(activeLayerId);
            const dc = layerCanvasRefs.current[activeLayerPos < 0 ? 0 : activeLayerPos];
            if (ov && dc) {
              dc.getContext("2d")?.drawImage(ov, 0, 0);
              ov.getContext("2d")?.clearRect(0, 0, ov.width, ov.height);
            }
          }
        }

        activeStrokePointsRef.current = [];
        allStrokePointsRef.current = [];
        lastBroadcastIndexRef.current = 0;
        preStrokeSnapshotRef.current = null;
        isDrawing.current = false;
        activePointerIdRef.current = null;
        washiStartRef.current = null;
        selectionDragRef.current = null;
        changedDuringPointerRef.current = false;
      },
      [renderActiveStroke, onStrokeUpdate, onStrokeComplete, brushSettings, onPinchGestureEnd, renderAll, currentDrawingLayer, defaultLayerIndex],
    );
    handlePointerUpRef.current = handlePointerUp;

    // ── Canvas operations ─────────────────────────────────────────────────────
    const clearCanvas = useCallback(() => {
      for (let li = 0; li <= maxLayerIndex; li++) {
        const canvas = layerCanvasRefs.current[li];
        if (!canvas) continue;
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
      // Reset local undo history — clearing is not undoable
      localStrokesRef.current = [];
      undoneStrokesRef.current = [];
      // Also drop completed remote strokes, otherwise the next re-render
      // (e.g. dbStrokes → []) paints them right back onto the layer canvases
      remoteStrokesRef.current = [];
      setRemoteStrokesVersion((v) => v + 1);
      // Update the session base to reflect the cleared state
      const canvas0 = layerCanvasRefs.current[0];
      if (canvas0) {
        void createImageBitmap(canvas0).then((bitmap) => {
          sessionBaseRef.current?.close();
          sessionBaseRef.current = bitmap;
        });
      }
    }, [maxLayerIndex]);

    const undo = useCallback(() => {
      const last = localStrokesRef.current[localStrokesRef.current.length - 1];
      if (!last) return;
      localStrokesRef.current = localStrokesRef.current.slice(0, -1);
      undoneStrokesRef.current = [...undoneStrokesRef.current, last];
      renderAll();
      onUndoStroke?.(last.id);
    }, [onUndoStroke, renderAll]);

    const redo = useCallback(() => {
      const next = undoneStrokesRef.current[undoneStrokesRef.current.length - 1];
      if (!next) return;
      undoneStrokesRef.current = undoneStrokesRef.current.slice(0, -1);
      localStrokesRef.current = [...localStrokesRef.current, next];
      renderAll();
      onRedoStroke?.(next);
    }, [onRedoStroke, renderAll]);

    const setSessionBase = useCallback(() => {
      const w = width;
      const h = height;
      const composite = document.createElement("canvas");
      composite.width = w;
      composite.height = h;
      const ctx = composite.getContext("2d");
      if (!ctx) return;
      for (let li = 0; li <= maxLayerIndex; li++) {
        const lc = layerCanvasRefs.current[li];
        if (lc) ctx.drawImage(lc, 0, 0);
      }
      // ImageBitmap is GPU-backed — far cheaper than a 115 MB ImageData array
      void createImageBitmap(composite).then((bitmap) => {
        sessionBaseRef.current?.close();
        sessionBaseRef.current = bitmap;
        localStrokesRef.current = [];
        undoneStrokesRef.current = [];
      });
    }, [width, height, maxLayerIndex]);

    // Draws background + strokes + static stickers. No GIFs — use as animation base.
    const getBaseCanvas = useCallback(() => {
      const w = canvasRef.current?.width ?? width;
      const h = canvasRef.current?.height ?? height;
      const base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      const ctx = base.getContext("2d");
      if (!ctx) return base;

      // Draw background
      if (backgroundCanvasRef.current) {
        ctx.drawImage(backgroundCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
      }

      // Group local strokes by stable layer id
      const strokesById: Record<number, LocalStrokeEntry[]> = {};
      for (const stroke of localStrokesRef.current) {
        if (!strokesById[stroke.layerIndex]) strokesById[stroke.layerIndex] = [];
        strokesById[stroke.layerIndex].push(stroke);
      }

      // Group DB strokes by stable layer id
      const dbStrokesById: Record<number, SyncStroke[]> = {};
      for (const stroke of (dbStrokes ?? [])) {
        const li = stroke.layerIndex ?? 0;
        if (!dbStrokesById[li]) dbStrokesById[li] = [];
        dbStrokesById[li].push(stroke);
      }

      // Group items by stable layer id
      const itemsById: Record<number, PlacedSticker[]> = {};
      for (const item of placedItemsRef.current) {
        if (item.isAnimated) continue;
        const layerIdx = item.layerIndex ?? 0;
        if (!itemsById[layerIdx]) itemsById[layerIdx] = [];
        itemsById[layerIdx].push(item);
      }

      const drawStroke = (s: { tool: string; pts: [number, number, number][]; color: string; size: number }) => {
        const isEraser = s.tool === "eraser";
        const outline = getStroke(s.pts, strokeOpts(s.size, isEraser));
        if (!outline.length) return;
        ctx.save();
        if (isEraser) { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,1)"; }
        else { ctx.fillStyle = s.color; }
        ctx.fill(strokeToPath2D(outline));
        ctx.restore();
      };

      // Render in display order (back→front), skipping hidden layer ids
      const order = layerOrderRef.current;
      const hidden = hiddenSetRef.current;
      for (let pos = 0; pos < order.length; pos++) {
        const id = order[pos]!;
        if (hidden.has(id)) continue;
        for (const s of (dbStrokesById[id] ?? [])) drawStroke(s);
        for (const s of (strokesById[id] ?? [])) drawStroke(s);
        renderItemsToCtx(ctx, itemsById[id] ?? []);
      }

      // Draw active stroke if any
      if (activeStrokeCanvasRef.current) ctx.drawImage(activeStrokeCanvasRef.current, 0, 0);

      return base;
    }, [width, height, maxLayerIndex, renderItemsToCtx, dbStrokes]);

    // Stamps current animated-GIF frames onto an external context. Call each rAF tick.
    // Uses animatedImgRefsRef (live DOM elements) so the browser's GIF frame
    // advancement is captured, not the frozen preloaded copies in assetImagesRef.
    const drawAnimatedLayer = useCallback((ctx: CanvasRenderingContext2D) => {
      const hidden = hiddenSetRef.current;
      for (const item of placedItemsRef.current) {
        if (!item.isAnimated) continue;
        if (hidden.has(item.layerIndex ?? 0)) continue;
        const img = animatedImgRefsRef.current.get(item.id);
        if (!img || img.naturalWidth === 0) continue;
        ctx.save();
        ctx.globalAlpha = item.opacity;
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }, []);

    const getCompositeCanvas = useCallback(() => {
      const base = getBaseCanvas();
      const ctx = base.getContext("2d");
      if (ctx) drawAnimatedLayer(ctx);
      return base;
    }, [getBaseCanvas, drawAnimatedLayer]);

    const shiftSingleCanvas = useCallback(
      (canvas: HTMLCanvasElement | null, dx: number, dy: number) => {
        if (!canvas || (dx === 0 && dy === 0)) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const temp = document.createElement("canvas");
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tempCtx = temp.getContext("2d");
        if (!tempCtx) return;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(temp, dx, dy);
      },
      [],
    );

    const shiftContent = useCallback(
      (dx: number, dy: number) => {
        for (let li = 0; li <= maxLayerIndex; li++) {
          shiftSingleCanvas(layerCanvasRefs.current[li], dx, dy);
        }
        shiftSingleCanvas(activeStrokeCanvasRef.current, dx, dy);
        shiftSingleCanvas(overlayCanvasRef.current, dx, dy);
        // Shift the session base too so undo remains aligned
        const base = sessionBaseRef.current;
        if (base && (dx !== 0 || dy !== 0)) {
          const w = layerCanvasRefs.current[0]?.width ?? 0;
          const h = layerCanvasRefs.current[0]?.height ?? 0;
          if (w && h) {
            const composite = document.createElement("canvas");
            composite.width = w;
            composite.height = h;
            const ctx = composite.getContext("2d");
            if (ctx) {
              for (let li = 0; li <= maxLayerIndex; li++) {
                const lc = layerCanvasRefs.current[li];
                if (lc) ctx.drawImage(lc, 0, 0);
              }
              void createImageBitmap(composite).then((bitmap) => {
                base.close();
                sessionBaseRef.current = bitmap;
              });
            }
          }
        }
      },
      [shiftSingleCanvas, maxLayerIndex],
    );

    const getCanvasImageData = useCallback(() => {
      return getBaseCanvas().toDataURL("image/png");
    }, [getBaseCanvas]);

    const setCanvasImageData = useCallback(
      (imageData: string | null, options?: { shiftX?: number; shiftY?: number }) => {
        const canvas = layerCanvasRefs.current[0];
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (!imageData) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const shiftX = options?.shiftX ?? 0;
          const shiftY = options?.shiftY ?? 0;
          ctx.drawImage(img, shiftX, shiftY, canvas.width, canvas.height);
        };
        img.src = imageData;
      },
      [],
    );

    // ── Cleanup ImageBitmap on unmount ────────────────────────────────────────
    useEffect(() => {
      return () => {
        sessionBaseRef.current?.close();
        sessionBaseRef.current = null;
      };
    }, []);

    // Track container CSS size so textarea font size matches canvas render scale
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const obs = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width > 0) setDisplayScale(entry.contentRect.width / width);
      });
      obs.observe(el);
      return () => obs.disconnect();
    }, [width]);

    // Auto-expand textarea height as user types
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [textOverlay?.value]);

    // ── Imperative handle ─────────────────────────────────────────────────────
    const swapStrokeLayers = useCallback((layerA: number, layerB: number) => {
      localStrokesRef.current = localStrokesRef.current.map((s) => {
        if (s.layerIndex === layerA) return { ...s, layerIndex: layerB };
        if (s.layerIndex === layerB) return { ...s, layerIndex: layerA };
        return s;
      });
      renderAll();
    }, [renderAll]);

    useImperativeHandle(ref, () => ({
      getCanvas: () => layerCanvasRefs.current[0],
      getCanvasImageData,
      setCanvasImageData,
      clearCanvas,
      undo,
      redo,
      getCompositeCanvas,
      getBaseCanvas,
      drawAnimatedLayer,
      shiftContent,
      setSessionBase,
      swapStrokeLayers,
    }));

    // ── Cursor ────────────────────────────────────────────────────────────────
    let cursor = "crosshair";
    if (brushSettings.tool === "eraser") cursor = "cell";
    else if (brushSettings.tool === "washi") cursor = "col-resize";
    else if (brushSettings.tool === "text") cursor = "text";
    else if (brushSettings.tool === "select") cursor = "default";

    const selectedItem = selectedItemId
      ? (placedItems.find((item) => item.id === selectedItemId) ?? null)
      : null;

    const animatedItems = useMemo(
      () => sortedByLayer.filter((item) => item.isAnimated),
      [sortedByLayer],
    );

    const deleteItem = (id: string) => {
      (removePlacedItem ?? removeAnimatedSticker)?.(id);
      selectItem(null);
    };

    const deleteSelectedItem = () => {
      if (!selectedItem) return;
      deleteItem(selectedItem.id);
    };

    const nudgeRotation = (delta: number) => {
      if (!selectedItem || !onUpdatePlacedItem) return;
      onUpdatePlacedItem(selectedItem.id, {
        rotation: ((selectedItem.rotation + delta) % 360 + 360) % 360,
      });
    };

    const startHandleDrag = useCallback(
      (
        e: React.PointerEvent,
        type: "resize" | "rotate",
        corner?: "nw" | "ne" | "sw" | "se",
      ) => {
        if (!selectedItem || !onUpdatePlacedItem) return;
        e.stopPropagation();
        e.preventDefault();
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}

        const canvasEl = canvasRef.current;
        if (!canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;
        const startItem = { ...selectedItem };
        const startMouseX = (e.clientX - rect.left) * scaleX;
        const startMouseY = (e.clientY - rect.top) * scaleY;

        handleDragRef.current = { type, corner, startMouseX, startMouseY, startItem, canvasRect: rect, scaleX, scaleY };

        let rafId: number | null = null;
        let pending: Partial<PlacedSticker> | null = null;

        const flush = () => {
          if (pending) { onUpdatePlacedItem(startItem.id, pending); pending = null; }
          rafId = null;
        };

        const onMove = (me: PointerEvent) => {
          const item = startItem;
          const R = (item.rotation * Math.PI) / 180;
          const cosR = Math.cos(R);
          const sinR = Math.sin(R);
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          const mouseX = (me.clientX - rect.left) * scaleX;
          const mouseY = (me.clientY - rect.top) * scaleY;

          if (type === "rotate") {
            const startAngle = Math.atan2(startMouseY - cy, startMouseX - cx);
            const currentAngle = Math.atan2(mouseY - cy, mouseX - cx);
            const delta = (currentAngle - startAngle) * (180 / Math.PI);
            pending = { rotation: ((item.rotation + delta) % 360 + 360) % 360 };
          } else {
            const c = corner!;
            const getCorner = (w: "nw" | "ne" | "sw" | "se") => {
              const lx = w[1] === "e" ? item.width / 2 : -item.width / 2;
              const ly = w[0] === "s" ? item.height / 2 : -item.height / 2;
              return { x: cx + lx * cosR - ly * sinR, y: cy + lx * sinR + ly * cosR };
            };
            const opp: Record<string, "nw" | "ne" | "sw" | "se"> = { se: "nw", nw: "se", ne: "sw", sw: "ne" };
            const anchor = getCorner(opp[c]);
            const dx = mouseX - anchor.x;
            const dy = mouseY - anchor.y;
            const localDx = dx * cosR + dy * sinR;
            const signX = c[1] === "e" ? 1 : -1;
            const aspect = item.width / item.height;
            const newW = Math.max(24, signX * localDx);
            const newH = Math.max(24, newW / aspect);
            const dlx = c[1] === "e" ? newW / 2 : -newW / 2;
            const dly = c[0] === "s" ? newH / 2 : -newH / 2;
            const newCX = anchor.x + dlx * cosR - dly * sinR;
            const newCY = anchor.y + dlx * sinR + dly * cosR;
            pending = { x: newCX - newW / 2, y: newCY - newH / 2, width: newW, height: newH };
          }

          if (rafId === null) rafId = requestAnimationFrame(flush);
        };

        const onUp = () => {
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
          if (pending) { onUpdatePlacedItem(startItem.id, pending); pending = null; }
          handleDragRef.current = null;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      },
      [selectedItem, onUpdatePlacedItem],
    );

    const commitTextBlock = useCallback(
      (text: string, id: string) => {
        if (!onUpdatePlacedItem) return;
        const nextText = text.trim();
        if (!nextText) return;
        const fontSize = Math.max(
          10,
          brushSettings.textSize ?? Math.max(14, brushSettings.size * 3),
        );
        const lines = nextText.split("\n");
        const longest = Math.max(...lines.map((l) => l.length), 4);
        onUpdatePlacedItem(id, {
          text: nextText,
          textColor: brushSettings.color,
          textSize: fontSize,
          textFont: brushSettings.textFont ?? '"Space Mono", monospace',
          width: Math.max(160, Math.min(760, longest * fontSize * 0.62)),
          height: Math.max(fontSize * 1.6, lines.length * fontSize * 1.4 + 14),
        });
      },
      [onUpdatePlacedItem, brushSettings.color, brushSettings.size, brushSettings.textSize, brushSettings.textFont],
    );

    const textFontSize = Math.max(
      10,
      brushSettings.textSize ?? Math.max(14, brushSettings.size * 3),
    );
    const textFontFamily = brushSettings.textFont?.startsWith("custom:")
      ? '"Space Mono", monospace'
      : (brushSettings.textFont ?? '"Space Mono", monospace');

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div
        ref={containerRef}
        className={fillContainer ? "relative h-full w-full" : "relative"}
        style={fillContainer ? undefined : { width, height }}
      >
        {/* z-stack (back → front) for maxLayerIndex=4:
              z:0   background
              z:1   layerCanvasRefs[0]   — layer 0 strokes/stickers
              z:2   animated items layer 0  (DOM <img>)
              z:3   activeStrokeCanvas   — live preview when drawing on layer 0
              z:4   layerCanvasRefs[1]   — layer 1
              z:5   animated items layer 1
              z:6   activeStrokeCanvas   — live preview when drawing on layer 1
              … (formula: layer L canvas = L*3+1, items = L*3+2, active stroke = L*3+3)
              z:16  canvasRef            — transparent pointer-capture only (maxLayerIndex*3+4)
              z:17  overlayCanvasRef     — washi tape preview / UI */}
        <canvas
          ref={backgroundCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ imageRendering: "crisp-edges", width: "100%", height: "100%", zIndex: 0 }}
        />

        {/* Layer canvases — one per layer, z-indexed so DOM animated items can sit between them */}
        {Array.from({ length: maxLayerIndex + 1 }, (_, li) => (
          <canvas
            key={li}
            ref={(el) => { layerCanvasRefs.current[li] = el; }}
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0"
            style={{ width: "100%", height: "100%", zIndex: li * 3 + 1 }}
          />
        ))}

        {/* Active stroke preview — z-index tracks currentDrawingLayer so it sits above that layer */}
        <canvas
          ref={activeStrokeCanvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%", zIndex: Math.max(0, positionOf(currentDrawingLayer ?? defaultLayerIndex)) * 3 + 3 }}
        />

        {/* Pointer capture canvas — transparent, sits above all layer canvases, handles all touch/mouse events */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ touchAction: "none", cursor, width: "100%", height: "100%", zIndex: maxLayerIndex * 3 + 4, opacity: 0 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        <canvas
          ref={overlayCanvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%", zIndex: maxLayerIndex * 3 + 5 }}
        />

        {animatedItems.map((item) => {
          const itemId = item.layerIndex ?? 0;
          const itemPos = Math.max(0, positionOf(itemId));
          const itemZIndex = itemPos * 3 + 2;
          const isLayerHidden = hiddenSet.has(itemId);
          return (
          <div
            key={item.id}
            className="group absolute"
            style={{
              left: `${(item.x / width) * 100}%`,
              top: `${(item.y / height) * 100}%`,
              width: `${(item.width / width) * 100}%`,
              height: `${(item.height / height) * 100}%`,
              pointerEvents: "none",
              zIndex: itemZIndex,
              display: isLayerHidden ? "none" : undefined,
            }}
          >
            {/* GIF render — pointer-events-none so drawing still works over it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => {
                if (el) animatedImgRefsRef.current.set(item.id, el);
                else animatedImgRefsRef.current.delete(item.id);
              }}
              src={item.imageData}
              crossOrigin="anonymous"
              alt=""
              className="absolute inset-0 h-full w-full"
              style={{
                opacity: item.opacity,
                transform: `rotate(${item.rotation}deg)`,
                transformOrigin: "center",
                pointerEvents: "none",
              }}
            />
            {/* Delete button — inside top-right, doesn't overlap corner handles */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                deleteItem(item.id);
              }}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                background: "rgba(185,28,28,0.85)",
                pointerEvents: "auto",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                zIndex: 10,
              }}
              title="Remove GIF"
            >
              ×
            </button>
          </div>
          );
        })}

        {brushSettings.tool === "select" && selectedItem !== null ? (
          <>
            {/* Rotated container: selection border + corner handles + rotation handle */}
            <div
              style={{
                position: "absolute",
                left: `${((selectedItem.x + selectedItem.width / 2) / width) * 100}%`,
                top: `${((selectedItem.y + selectedItem.height / 2) / height) * 100}%`,
                width: `${(selectedItem.width / width) * 100}%`,
                height: `${(selectedItem.height / height) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${selectedItem.rotation}deg)`,
                transformOrigin: "center",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              {/* Selection border */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  border: "1.5px dashed rgba(109,40,217,0.6)",
                  borderRadius: 3,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.7)",
                }}
              />

              {/* Rotation handle — above top-center with larger hit area */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -40,
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  pointerEvents: "auto",
                  cursor: "grab",
                  touchAction: "none",
                  userSelect: "none",
                  padding: 8,
                  margin: -8,
                }}
                onPointerDown={(e) => startHandleDrag(e, "rotate")}
              >
                <div
                  style={{
                    width: 1,
                    height: 22,
                    background: "rgba(109,40,217,0.45)",
                  }}
                />
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "white",
                    border: "2.5px solid rgba(109,40,217,0.85)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    marginTop: -1,
                  }}
                />
              </div>

              {/* Invisible hit area for dragging the item - covers the selection box */}
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  cursor: "move",
                  pointerEvents: "auto",
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  if (!selectedItem || !onUpdatePlacedItem) return;
                  e.stopPropagation();
                  e.preventDefault();
                  const canvasEl = canvasRef.current;
                  if (!canvasEl) return;
                  const rect = canvasEl.getBoundingClientRect();
                  const scaleX = canvasEl.width / rect.width;
                  const scaleY = canvasEl.height / rect.height;
                  const offsetX = (e.clientX - rect.left) * scaleX - selectedItem.x;
                  const offsetY = (e.clientY - rect.top) * scaleY - selectedItem.y;
                  const id = selectedItem.id;
                  try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
                  let rafId: number | null = null;
                  let pendingX = selectedItem.x;
                  let pendingY = selectedItem.y;
                  const flush = () => {
                    onUpdatePlacedItem(id, { x: pendingX, y: pendingY });
                    rafId = null;
                  };
                  const onMove = (me: PointerEvent) => {
                    pendingX = (me.clientX - rect.left) * scaleX - offsetX;
                    pendingY = (me.clientY - rect.top) * scaleY - offsetY;
                    if (rafId === null) rafId = requestAnimationFrame(flush);
                  };
                  const onUp = () => {
                    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
                    onUpdatePlacedItem(id, { x: pendingX, y: pendingY });
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                  };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                }}
              />

              {/* Corner resize handles - larger with invisible hit area */}
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <div
                  key={corner}
                  style={{
                    position: "absolute",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: corner[0] === "n" ? "flex-start" : "flex-end",
                    justifyContent: corner[1] === "w" ? "flex-start" : "flex-end",
                    cursor: `${corner}-resize`,
                    pointerEvents: "auto",
                    touchAction: "none",
                    userSelect: "none",
                    ...(corner[0] === "n" ? { top: -8 } : { bottom: -8 }),
                    ...(corner[1] === "w" ? { left: -8 } : { right: -8 }),
                    padding: 6,
                  }}
                  onPointerDown={(e) => startHandleDrag(e, "resize", corner)}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: "white",
                      border: "2.5px solid rgba(109,40,217,0.85)",
                      borderRadius: 3,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Non-rotated action toolbar — centered below item */}
            <div
              className="absolute flex items-center"
              style={{
                left: `${((selectedItem.x + selectedItem.width / 2) / width) * 100}%`,
                top: `${((selectedItem.y + selectedItem.height) / height) * 100}%`,
                transform: "translate(-50%, 10px)",
                background: "rgba(255,255,255,0.97)",
                border: "1px solid rgba(109,40,217,0.15)",
                borderRadius: 24,
                padding: "3px 6px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
                gap: 2,
                zIndex: 20,
                userSelect: "none",
                whiteSpace: "nowrap",
              }}
            >
              {/* Rotate CCW */}
              <button
                className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-base transition-colors hover:bg-violet-50"
                style={{ color: "#6d28d9" }}
                onClick={() => nudgeRotation(-15)}
                title="Rotate left 15°"
              >
                ↺
              </button>

              {/* Rotate CW */}
              <button
                className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-base transition-colors hover:bg-violet-50"
                style={{ color: "#6d28d9" }}
                onClick={() => nudgeRotation(15)}
                title="Rotate right 15°"
              >
                ↻
              </button>

              <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.1)", margin: "0 2px" }} />

              {/* Opacity slider — for stickers and washi */}
              {selectedItem.type !== "text" && (
                <div className="flex items-center gap-1" style={{ padding: "0 2px" }}>
                  <span
                    style={{
                      fontSize: 9,
                      color: "#9ca3af",
                      letterSpacing: "0.04em",
                      fontFamily: "monospace",
                      lineHeight: 1,
                    }}
                  >
                    α
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedItem.opacity}
                    onChange={(e) =>
                      onUpdatePlacedItem?.(selectedItem.id, {
                        opacity: parseFloat(e.target.value),
                      })
                    }
                    style={{ width: 52, accentColor: "#7c3aed", cursor: "pointer" }}
                  />
                </div>
              )}

              {/* Edit text — text items only */}
              {selectedItem.type === "text" && (
                <button
                  className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors hover:bg-pink-50"
                  style={{ color: "#db2777" }}
                  onClick={() =>
                    setTextOverlay({
                      id: selectedItem.id,
                      x: selectedItem.x,
                      y: selectedItem.y,
                      value: selectedItem.text ?? "",
                    })
                  }
                  title="Edit text"
                >
                  ✏
                </button>
              )}

              {/* Layer order buttons — move item between layer buckets (0=back … 4=front) */}
              {onUpdatePlacedItem ? (
                <>
                  <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.1)", margin: "0 2px" }} />
                  {(
                    [
                      { label: "↑↑", title: `Send to front`, newLayer: () => resolvedLayerOrder[resolvedLayerOrder.length - 1] ?? 0 },
                      { label: "↑",  title: "Send forward one layer",  newLayer: () => {
                          const p = resolvedLayerOrder.indexOf(selectedItem.layerIndex ?? 0);
                          return resolvedLayerOrder[Math.min(resolvedLayerOrder.length - 1, p + 1)] ?? (selectedItem.layerIndex ?? 0);
                        } },
                      { label: "↓",  title: "Send backward one layer", newLayer: () => {
                          const p = resolvedLayerOrder.indexOf(selectedItem.layerIndex ?? 0);
                          return resolvedLayerOrder[Math.max(0, p - 1)] ?? (selectedItem.layerIndex ?? 0);
                        } },
                      { label: "↓↓", title: "Send to back",  newLayer: () => resolvedLayerOrder[0] ?? 0 },
                    ] as { label: string; title: string; newLayer: () => number }[]
                  ).map(({ label, title, newLayer }) => (
                    <button
                      key={title}
                      className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors hover:bg-violet-50"
                      style={{ color: "#6d28d9", fontFamily: "monospace" }}
                      onClick={() => onUpdatePlacedItem(selectedItem.id, { layerIndex: newLayer() })}
                      title={title}
                    >
                      {label}
                    </button>
                  ))}
                </>
              ) : null}

              <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.1)", margin: "0 2px" }} />

              {/* Delete */}
              <button
                className="btn-smooth flex h-7 w-7 items-center justify-center rounded-full text-lg font-medium transition-colors hover:bg-red-50"
                style={{ color: "#dc2626" }}
                onClick={deleteSelectedItem}
                title="Delete"
              >
                ×
              </button>
            </div>
          </>
        ) : null}

        {brushSettings.tool === "text" && textOverlay === null && (
          <div
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2"
            style={{
              background: "rgba(167,139,250,0.12)",
              border: "1px dashed rgba(167,139,250,0.5)",
              borderRadius: 20,
              padding: "3px 14px",
              fontSize: 11,
              color: "rgba(109,40,217,0.85)",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            Tap anywhere to add text · Enter for new line
          </div>
        )}

        {textOverlay !== null && (
          <div
            style={{
              position: "absolute",
              left: `${(textOverlay.x / width) * 100}%`,
              top: `${(textOverlay.y / height) * 100}%`,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              className="pointer-events-none"
              style={{
                fontSize: 10,
                color: "rgba(109,40,217,0.7)",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
                background: "rgba(255,255,255,0.85)",
                borderRadius: 6,
                padding: "1px 7px",
                border: "1px solid rgba(167,139,250,0.3)",
                alignSelf: "flex-start",
              }}
            >
              Enter for new line · Ctrl+Enter to finish
            </div>
            <textarea
              ref={textareaRef}
              autoFocus
              value={textOverlay.value}
              placeholder="Type here…"
              onChange={(e) =>
                setTextOverlay((prev) => (prev ? { ...prev, value: e.target.value } : null))
              }
              onBlur={() => {
                const txt = textOverlay.value.trim();
                if (txt) commitTextBlock(txt, textOverlay.id);
                else (removePlacedItem ?? removeAnimatedSticker)?.(textOverlay.id);
                setTextOverlay(null);
                selectItem(null);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) || e.key === "Escape") {
                  e.preventDefault();
                  const txt = textOverlay.value.trim();
                  if (txt) commitTextBlock(txt, textOverlay.id);
                  else (removePlacedItem ?? removeAnimatedSticker)?.(textOverlay.id);
                  setTextOverlay(null);
                  selectItem(null);
                }
                // plain Enter inserts a newline (default textarea behaviour)
              }}
              style={{
                width: `${Math.max(200, textFontSize * 8 * displayScale)}px`,
                minHeight: `${Math.max(32, textFontSize * 2 * displayScale)}px`,
                fontSize: `${Math.max(10, Math.round(textFontSize * displayScale))}px`,
                fontFamily: textFontFamily,
                color: brushSettings.color,
                background: "rgba(255,255,255,0.94)",
                border: "2px solid rgba(167,139,250,0.7)",
                borderRadius: 8,
                padding: "6px 10px",
                outline: "none",
                lineHeight: 1.45,
                resize: "none",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(167,139,250,0.25), 0 1px 6px rgba(0,0,0,0.08)",
                whiteSpace: "pre-wrap",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  (removePlacedItem ?? removeAnimatedSticker)?.(textOverlay.id);
                  setTextOverlay(null);
                  selectItem(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1.5px solid rgba(167,139,250,0.4)",
                  background: "rgba(255,255,255,0.94)",
                  color: "rgba(109,40,217,0.8)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                Cancel
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  const txt = textOverlay.value.trim();
                  if (txt) commitTextBlock(txt, textOverlay.id);
                  else (removePlacedItem ?? removeAnimatedSticker)?.(textOverlay.id);
                  setTextOverlay(null);
                  selectItem(null);
                }}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(167,139,250,0.85)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                Enter ↵
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
