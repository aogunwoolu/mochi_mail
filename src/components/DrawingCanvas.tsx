"use client";

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
import { strokeToPath2D } from "@/lib/canvas/strokeUtils";
import {
  BrushSettings,
  CustomFont,
  PaperBackground,
  PlacedSticker,
  Sticker,
  WashiTape,
} from "@/types";

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
  getCompositeCanvas: () => HTMLCanvasElement;
  shiftContent: (dx: number, dy: number) => void;
  /** Called after the initial stroke replay so undo has a clean baseline. */
  setSessionBase?: () => void;
}

// ─── Local stroke entry (lightweight — no pixel data) ────────────────────────

type LocalStrokeEntry = {
  id: string;
  pts: [number, number, number][];
  color: string;
  size: number;
  tool: "pen" | "eraser";
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  brushSettings: BrushSettings;
  placedItems: PlacedSticker[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  customFonts?: CustomFont[];
  onPlaceAsset: (asset: Sticker | WashiTape, x: number, y: number) => void;
  onAddTextItem?: (item: PlacedSticker) => PlacedSticker | void;
  onUpdatePlacedItem?: (id: string, updates: Partial<PlacedSticker>) => void;
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
  ) => void;
  /** Fired when the user undoes — sync layer should delete the stroke from DB. */
  onUndoStroke?: (strokeId: string) => void;
  /** Fired when the user redoes — sync layer should re-insert the stroke to DB. */
  onRedoStroke?: (stroke: LocalStrokeEntry) => void;
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
      onPlaceAsset,
      onAddTextItem,
      onUpdatePlacedItem,
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
    },
    ref,
  ) => {
    // ── Canvas refs ──────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const activeStrokeCanvasRef = useRef<HTMLCanvasElement>(null);

    // ── Drawing state ────────────────────────────────────────────────────────
    const isDrawing = useRef(false);
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

    // ── Washi / select drag refs ─────────────────────────────────────────────
    const washiStartRef = useRef<{ x: number; y: number } | null>(null);
    const preWashiStateRef = useRef<ImageData | null>(null);
    const changedDuringPointerRef = useRef(false);
    const selectionDragRef = useRef<{
      id: string;
      offsetX: number;
      offsetY: number;
    } | null>(null);

    // ── Misc ─────────────────────────────────────────────────────────────────
    const [textOverlay, setTextOverlay] = useState<{
      id: string;
      x: number;
      y: number;
      value: string;
    } | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const assetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const paperImageRef = useRef<HTMLImageElement | null>(null);
    const rafIdRef = useRef<number | null>(null);
    // Stable ref so handlePointerMove can call handlePointerUp without a dep cycle
    const handlePointerUpRef = useRef<((e?: React.PointerEvent<HTMLCanvasElement>) => void) | null>(null);

    // Full accumulated points for the current stroke — used for broadcasting and DB
    // persistence.  activeStrokePointsRef is trimmed by the freeze algorithm (for
    // render perf), so we keep a separate unbounded copy here.
    const allStrokePointsRef = useRef<[number, number, number][]>([]);
    const lastBroadcastIndexRef = useRef(0);

    // ── Restore session base + replay local strokes (for undo/redo) ──────────
    const restoreAndReplay = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (sessionBaseRef.current) {
        ctx.drawImage(sessionBaseRef.current, 0, 0);
      }
      for (const stroke of localStrokesRef.current) {
        const isEraser = stroke.tool === "eraser";
        const outline = getStroke(stroke.pts, {
          size: isEraser ? stroke.size * 2.5 : stroke.size,
          thinning: isEraser ? 0 : 0.5,
          smoothing: 0.5,
          streamline: 0.4,
          simulatePressure: false,
        });
        if (!outline.length) continue;
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
    }, []);

    // ── Active stroke rendering (RAF loop) ───────────────────────────────────
    const renderActiveStroke = useCallback(() => {
      const pts = activeStrokePointsRef.current;
      if (!pts.length) return;

      const { tool, color, size } = brushSettings;
      const isEraser = tool === "eraser";

      const stroke = getStroke(pts, {
        size: isEraser ? size * 2.5 : size,
        thinning: isEraser ? 0 : 0.5,
        smoothing: 0.5,
        streamline: 0.4,
        simulatePressure: false,
      });

      const path = strokeToPath2D(stroke);

      if (isEraser) {
        const canvas = canvasRef.current;
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
          const headOutline = getStroke(pts.slice(0, newFreezeEnd), {
            size,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.4,
            simulatePressure: false,
            last: false,
          });
          const mainCtx = canvasRef.current?.getContext("2d");
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
        const liveOutline = getStroke(livePts.slice(liveStart), {
          size,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.4,
          simulatePressure: false,
        });
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
      placedItems.forEach((item) => {
        if (!assetImagesRef.current.has(item.id)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = item.imageData;
          img.onload = () => renderOverlay();
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

    // ── Overlay rendering (stickers / text) ──────────────────────────────────
    const renderOverlay = useCallback(() => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

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

      placedItems.forEach((item) => {
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
    }, [placedItems]);

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
    }, [width, height, renderBackground, backgroundOffsetX, backgroundOffsetY]);

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
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore on unsupported browsers
        }
        const point = getCanvasPoint(e);

        if (brushSettings.tool === "text") {
          const target = [...placedItems]
            .reverse()
            .find((item) => pointHitsItem(point.x, point.y, item));
          if (target?.type === "text") {
            setSelectedItemId(target.id);
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
          };
          const created = onAddTextItem?.(newItem) ?? newItem;
          setSelectedItemId(created.id);
          setTextOverlay({
            id: created.id,
            x: created.x,
            y: created.y,
            value: created.text ?? "",
          });
          return;
        }

        if (brushSettings.tool === "select") {
          const target = [...placedItems]
            .reverse()
            .find((item) => pointHitsItem(point.x, point.y, item));
          if (!target) {
            setSelectedItemId(null);
            selectionDragRef.current = null;
            return;
          }
          setSelectedItemId(target.id);
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
          );
          return;
        }

        if (brushSettings.tool === "washi" && selectedAsset) {
          changedDuringPointerRef.current = false;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          preWashiStateRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
          washiStartRef.current = { x: point.x, y: point.y };
          isDrawing.current = true;
          return;
        }

        // Pen / eraser — generate a fresh stroke ID
        currentStrokeIdRef.current = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        frozenPointCountRef.current = 0;

        if (brushSettings.tool === "eraser") {
          const drawCtx = canvasRef.current?.getContext("2d");
          if (drawCtx && canvasRef.current) {
            preStrokeSnapshotRef.current = drawCtx.getImageData(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height,
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
        placedItems,
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
      ],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
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
          washiStartRef.current &&
          preWashiStateRef.current
        ) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.putImageData(preWashiStateRef.current, 0, 0);
          paintWashiStrip(ctx, washiStartRef.current, { x: point.x, y: point.y }, selectedAsset);
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
      ],
    );

    const handlePointerUp = useCallback(
      (e?: React.PointerEvent<HTMLCanvasElement>) => {
        if (e) {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
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

          // Send any remaining unbroadcast points with isLast = true
          const remainingDelta = allPts.slice(lastBroadcastIndexRef.current);
          onStrokeUpdate?.(strokeId, remainingDelta, color, size, tool, true);

          // Commit pen stroke from active canvas to drawing canvas
          const ac = activeStrokeCanvasRef.current;
          const dc = canvasRef.current;
          if (ac && dc) {
            dc.getContext("2d")?.drawImage(ac, 0, 0);
            ac.getContext("2d")?.clearRect(0, 0, ac.width, ac.height);
          }

          // Track this stroke locally for undo (full points)
          localStrokesRef.current.push({ id: strokeId, pts: allPts, color, size, tool });
          undoneStrokesRef.current = []; // clear redo stack on new stroke

          // Persist immediately with full accumulated points
          onStrokeComplete?.(strokeId, allPts, color, size, tool);
          currentStrokeIdRef.current = "";
        } else if (isDrawing.current) {
          // Washi / select / other tools
          const ac = activeStrokeCanvasRef.current;
          const dc = canvasRef.current;
          if (ac && dc) {
            dc.getContext("2d")?.drawImage(ac, 0, 0);
            ac.getContext("2d")?.clearRect(0, 0, ac.width, ac.height);
          }
        }

        activeStrokePointsRef.current = [];
        allStrokePointsRef.current = [];
        lastBroadcastIndexRef.current = 0;
        preStrokeSnapshotRef.current = null;
        isDrawing.current = false;
        washiStartRef.current = null;
        preWashiStateRef.current = null;
        selectionDragRef.current = null;
        changedDuringPointerRef.current = false;
      },
      [renderActiveStroke, onStrokeUpdate, onStrokeComplete, brushSettings],
    );
    handlePointerUpRef.current = handlePointerUp;

    // ── Canvas operations ─────────────────────────────────────────────────────
    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Reset local undo history — clearing is not undoable
      localStrokesRef.current = [];
      undoneStrokesRef.current = [];
      // Update the session base to reflect the cleared state
      void createImageBitmap(canvas).then((bitmap) => {
        sessionBaseRef.current?.close();
        sessionBaseRef.current = bitmap;
      });
    }, []);

    const undo = useCallback(() => {
      const last = localStrokesRef.current[localStrokesRef.current.length - 1];
      if (!last) return;
      localStrokesRef.current = localStrokesRef.current.slice(0, -1);
      undoneStrokesRef.current = [...undoneStrokesRef.current, last];
      restoreAndReplay();
      onUndoStroke?.(last.id);
    }, [restoreAndReplay, onUndoStroke]);

    const redo = useCallback(() => {
      const next = undoneStrokesRef.current[undoneStrokesRef.current.length - 1];
      if (!next) return;
      undoneStrokesRef.current = undoneStrokesRef.current.slice(0, -1);
      localStrokesRef.current = [...localStrokesRef.current, next];
      restoreAndReplay();
      onRedoStroke?.(next);
    }, [restoreAndReplay, onRedoStroke]);

    const setSessionBase = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // ImageBitmap is GPU-backed — far cheaper than a 115 MB ImageData array
      void createImageBitmap(canvas).then((bitmap) => {
        sessionBaseRef.current?.close();
        sessionBaseRef.current = bitmap;
        localStrokesRef.current = [];
        undoneStrokesRef.current = [];
      });
    }, []);

    const getCompositeCanvas = useCallback(() => {
      const w = canvasRef.current?.width ?? width;
      const h = canvasRef.current?.height ?? height;
      const composite = document.createElement("canvas");
      composite.width = w;
      composite.height = h;
      const ctx = composite.getContext("2d");
      if (!ctx) return composite;
      if (backgroundCanvasRef.current) {
        ctx.drawImage(backgroundCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
      }
      if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
      if (activeStrokeCanvasRef.current) ctx.drawImage(activeStrokeCanvasRef.current, 0, 0);
      if (overlayCanvasRef.current) ctx.drawImage(overlayCanvasRef.current, 0, 0);
      return composite;
    }, [width, height]);

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
        shiftSingleCanvas(canvasRef.current, dx, dy);
        shiftSingleCanvas(activeStrokeCanvasRef.current, dx, dy);
        shiftSingleCanvas(overlayCanvasRef.current, dx, dy);
        // Shift the session base too so undo remains aligned
        const base = sessionBaseRef.current;
        if (base && (dx !== 0 || dy !== 0)) {
          void createImageBitmap(canvasRef.current!).then((bitmap) => {
            base.close();
            sessionBaseRef.current = bitmap;
          });
        }
      },
      [shiftSingleCanvas],
    );

    const getCanvasImageData = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL("image/png");
    }, []);

    const setCanvasImageData = useCallback(
      (imageData: string | null, options?: { shiftX?: number; shiftY?: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!imageData) return;
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

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getCanvasImageData,
      setCanvasImageData,
      clearCanvas,
      undo,
      redo,
      getCompositeCanvas,
      shiftContent,
      setSessionBase,
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
      () => placedItems.filter((item) => item.isAnimated),
      [placedItems],
    );

    const nudgeScale = (delta: number) => {
      if (!selectedItem || !onUpdatePlacedItem) return;
      const nextWidth = Math.max(24, Math.round(selectedItem.width * delta));
      const nextHeight = Math.max(24, Math.round(selectedItem.height * delta));
      if (selectedItem.type === "text") {
        onUpdatePlacedItem(selectedItem.id, {
          width: nextWidth,
          height: nextHeight,
          textSize: Math.max(10, Math.round((selectedItem.textSize ?? 28) * delta)),
        });
        return;
      }
      onUpdatePlacedItem(selectedItem.id, { width: nextWidth, height: nextHeight });
    };

    const nudgeRotation = (delta: number) => {
      if (!selectedItem || !onUpdatePlacedItem) return;
      onUpdatePlacedItem(selectedItem.id, {
        rotation: ((selectedItem.rotation + delta) % 360 + 360) % 360,
      });
    };

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
        className={fillContainer ? "relative h-full w-full" : "relative"}
        style={fillContainer ? undefined : { width, height }}
      >
        <canvas
          ref={backgroundCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ imageRendering: "crisp-edges", width: "100%", height: "100%" }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ touchAction: "none", cursor, width: "100%", height: "100%" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <canvas
          ref={activeStrokeCanvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />
        <canvas
          ref={overlayCanvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />

        {animatedItems.map((item) => (
          <img
            key={item.id}
            src={item.imageData}
            alt={item.stickerId}
            className="pointer-events-none absolute"
            style={{
              left: `${(item.x / width) * 100}%`,
              top: `${(item.y / height) * 100}%`,
              width: `${(item.width / width) * 100}%`,
              height: `${(item.height / height) * 100}%`,
              opacity: item.opacity,
              transform: `rotate(${item.rotation}deg)`,
              transformOrigin: "center",
            }}
          />
        ))}

        {brushSettings.tool === "select" && selectedItem !== null ? (
          <>
            <div
              className="pointer-events-none absolute border border-dashed"
              style={{
                left: `${(selectedItem.x / width) * 100}%`,
                top: `${(selectedItem.y / height) * 100}%`,
                width: `${(selectedItem.width / width) * 100}%`,
                height: `${(selectedItem.height / height) * 100}%`,
                borderColor: "rgba(255,107,157,0.82)",
                transform: `rotate(${selectedItem.rotation}deg)`,
                transformOrigin: "center",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.7)",
              }}
            />
            <div
              className="absolute flex gap-1 rounded-lg border p-1"
              style={{
                left: `${((selectedItem.x + selectedItem.width) / width) * 100}%`,
                top: `${(Math.max(0, selectedItem.y) / height) * 100}%`,
                background: "rgba(255,255,255,0.92)",
                borderColor: "rgba(167,139,250,0.35)",
                boxShadow: "0 2px 12px rgba(143,109,178,0.22)",
              }}
            >
              <button
                className="btn-smooth rounded px-2 py-1 text-xs"
                style={{ background: "rgba(255,107,157,0.15)", color: "#b4236b" }}
                onClick={() => nudgeScale(1.12)}
                title="Enlarge"
              >
                +
              </button>
              <button
                className="btn-smooth rounded px-2 py-1 text-xs"
                style={{ background: "rgba(103,212,241,0.18)", color: "#0e7490" }}
                onClick={() => nudgeScale(0.9)}
                title="Shrink"
              >
                -
              </button>
              <button
                className="btn-smooth rounded px-2 py-1 text-xs"
                style={{ background: "rgba(167,139,250,0.2)", color: "#6d28d9" }}
                onClick={() => nudgeRotation(-15)}
                title="Rotate left"
              >
                ↺
              </button>
              <button
                className="btn-smooth rounded px-2 py-1 text-xs"
                style={{ background: "rgba(167,139,250,0.2)", color: "#6d28d9" }}
                onClick={() => nudgeRotation(15)}
                title="Rotate right"
              >
                ↻
              </button>
              {selectedItem.type === "text" ? (
                <button
                  className="btn-smooth rounded px-2 py-1 text-xs"
                  style={{ background: "rgba(249,168,212,0.22)", color: "#9d174d" }}
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
                  ✎
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {textOverlay !== null && (
          <textarea
            autoFocus
            value={textOverlay.value}
            onChange={(e) =>
              setTextOverlay((prev) => (prev ? { ...prev, value: e.target.value } : null))
            }
            onBlur={() => {
              if (textOverlay.value.trim()) commitTextBlock(textOverlay.value, textOverlay.id);
              setTextOverlay(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                if (textOverlay.value.trim()) commitTextBlock(textOverlay.value, textOverlay.id);
                setTextOverlay(null);
              } else if (e.key === "Escape") {
                setTextOverlay(null);
              }
            }}
            style={{
              position: "absolute",
              left: `${(textOverlay.x / width) * 100}%`,
              top: `${((textOverlay.y - textFontSize) / height) * 100}%`,
              minWidth: "12%",
              minHeight: "7%",
              fontSize: `clamp(10px, ${(textFontSize / width) * 100}vw, 64px)`,
              fontFamily: textFontFamily,
              color: brushSettings.color,
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(167,139,250,0.55)",
              borderRadius: 4,
              padding: "4px 6px",
              outline: "none",
              lineHeight: 1.4,
              resize: "both",
            }}
          />
        )}
      </div>
    );
  },
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
