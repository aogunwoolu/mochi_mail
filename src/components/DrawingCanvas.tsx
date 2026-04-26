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
import { BrushSettings, CustomFont, PaperBackground, PlacedSticker, Sticker, WashiTape } from "@/types";

export interface DrawingCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getCanvasImageData: () => string | null;
  setCanvasImageData: (imageData: string | null, options?: { shiftX?: number; shiftY?: number }) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  getCompositeCanvas: () => HTMLCanvasElement;
  shiftContent: (dx: number, dy: number) => void;
}

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
  onDrawingCommit?: () => void;
  onDrawingProgress?: () => void;
  onStrokeUpdate?: (pts: [number, number, number][], color: string, size: number, isLast: boolean) => void;
}


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
      onDrawingCommit,
      onDrawingProgress,
      onStrokeUpdate,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const activeStrokePointsRef = useRef<[number, number, number][]>([]);
    const preStrokeSnapshotRef = useRef<ImageData | null>(null);
    const lastStrokeBroadcastAtRef = useRef(0);
    // Washi tape drag refs
    const washiStartRef = useRef<{ x: number; y: number } | null>(null);
    const preWashiStateRef = useRef<ImageData | null>(null);
    const changedDuringPointerRef = useRef(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [redoHistory, setRedoHistory] = useState<ImageData[]>([]);
    const [textOverlay, setTextOverlay] = useState<{ id: string; x: number; y: number; value: string } | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const selectionDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const assetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const paperImageRef = useRef<HTMLImageElement | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const renderActiveStroke = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
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

      if (preStrokeSnapshotRef.current) {
        ctx.putImageData(preStrokeSnapshotRef.current, 0, 0);
      }

      ctx.save();
      ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
      ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : color;
      ctx.fill(path);
      ctx.restore();
    }, [brushSettings]);

    const renderLoop = useCallback(() => {
      renderActiveStroke();
      rafIdRef.current = requestAnimationFrame(renderLoop);
    }, [renderActiveStroke]);

    // Preload images for placed items
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

    // Preload selected asset image (needed for washi canvas pattern)
    useEffect(() => {
      if (selectedAsset && !assetImagesRef.current.has(selectedAsset.id)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = selectedAsset.imageData;
        assetImagesRef.current.set(selectedAsset.id, img);
      }
    }, [selectedAsset]);

    const renderOverlay = useCallback(() => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const wrapLines = (text: string, maxWidth: number, font: string): string[] => {
        ctx.font = font;
        const lines: string[] = [];
        const hardLines = text.split("\n");
        for (const hardLine of hardLines) {
          const words = hardLine.split(" ");
          if (words.length === 0) {
            lines.push("");
            continue;
          }
          let current = words[0] ?? "";
          for (let i = 1; i < words.length; i += 1) {
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
          const lines = wrapLines(item.text ?? "", Math.max(40, item.width - 10), `${fontSize}px ${fontFamily}`);
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

    const pointHitsItem = useCallback((x: number, y: number, item: PlacedSticker) => {
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
    }, []);

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
        // Lined notebook paper
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, background.width, background.height);
        ctx.strokeStyle = "rgba(175, 165, 200, 0.28)";
        ctx.lineWidth = 1;
        const lineSpacing = 32;
        const lineOffset = ((backgroundOffsetY % lineSpacing) + lineSpacing) % lineSpacing;
        for (let y = lineSpacing - lineOffset; y < background.height + lineSpacing; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(background.width, Math.round(y) + 0.5);
          ctx.stroke();
        }
      }
    }, [selectedPaper, backgroundOffsetX, backgroundOffsetY, backgroundMode]);

    useEffect(() => {
      renderOverlay();
    }, [renderOverlay]);

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

    const saveToHistory = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      setHistory((prev) => [
        ...prev.slice(-30),
        ctx.getImageData(0, 0, canvas.width, canvas.height),
      ]);
      setRedoHistory([]);
    }, []);

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
      []
    );

    // Paint washi tape as a tiled strip from `from` to `to`
    const paintWashiStrip = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        from: { x: number; y: number },
        to: { x: number; y: number },
        tape: Sticker | WashiTape
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
      []
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        // Stroke tools (pen/eraser/washi) block touch so the scroll container can
        // still pan the infinite canvas with a finger. iOS handles Apple Pencil palm
        // rejection at the OS level — blocking touch here doesn't affect Pencil.
        // Sticker, text, and select stay touch-friendly for tap interactions.
        const isStrokeTool = brushSettings.tool === "pen" || brushSettings.tool === "eraser" || brushSettings.tool === "washi";
        if (isStrokeTool && e.pointerType === "touch") return;

        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture failures on unsupported browsers.
        }
        const point = getCanvasPoint(e);

        // Text: click existing text to edit, or create a new text block
        if (brushSettings.tool === "text") {
          const target = [...placedItems].reverse().find((item) => pointHitsItem(point.x, point.y, item));
          if (target?.type === "text") {
            setSelectedItemId(target.id);
            setTextOverlay({ id: target.id, x: target.x, y: target.y, value: target.text ?? "" });
            return;
          }

          const textSize = Math.max(12, brushSettings.textSize ?? Math.max(14, brushSettings.size * 3));
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
          setTextOverlay({ id: created.id, x: created.x, y: created.y, value: created.text ?? "" });
          return;
        }

        if (brushSettings.tool === "select") {
          const target = [...placedItems].reverse().find((item) => pointHitsItem(point.x, point.y, item));
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

        // Sticker: click to place
        if (brushSettings.tool === "sticker" && selectedAsset) {
          onPlaceAsset(
            selectedAsset,
            point.x - selectedAsset.width / 2,
            point.y - selectedAsset.height / 2
          );
          return;
        }

        // Washi: drag to paint a strip directly onto the canvas
        if (brushSettings.tool === "washi" && selectedAsset) {
          saveToHistory();
          changedDuringPointerRef.current = false;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          preWashiStateRef.current = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
          washiStartRef.current = { x: point.x, y: point.y };
          isDrawing.current = true;
          return;
        }

        // Normal drawing / erasing
        saveToHistory();
        const drawCtx = canvasRef.current?.getContext("2d");
        if (drawCtx && canvasRef.current) {
          preStrokeSnapshotRef.current = drawCtx.getImageData(
            0, 0, canvasRef.current.width, canvasRef.current.height
          );
        }
        activeStrokePointsRef.current = [[point.x, point.y, point.pressure]];
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
        onAddTextItem,
        onPlaceAsset,
        saveToHistory,
        renderLoop,
      ]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const isStrokeTool = brushSettings.tool === "pen" || brushSettings.tool === "eraser" || brushSettings.tool === "washi";
        if (isStrokeTool && e.pointerType === "touch") return;
        // On iPadOS, pointerup can fail to fire when Apple Pencil transitions from
        // touching to hovering. Detect hover (pen with no buttons pressed) and end
        // the stroke to prevent ghost lines connecting separate strokes.
        if (e.pointerType === "pen" && e.buttons === 0) {
          handlePointerUp(e);
          return;
        }
        e.preventDefault();
        const point = getCanvasPoint(e);

        // Live washi preview: restore pre-washi state and redraw strip
        if (
          brushSettings.tool === "select" &&
          selectionDragRef.current &&
          onUpdatePlacedItem
        ) {
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
          paintWashiStrip(
            ctx,
            washiStartRef.current,
            { x: point.x, y: point.y },
            selectedAsset
          );
          changedDuringPointerRef.current = true;
          onDrawingProgress?.();
          return;
        }

        const events =
          typeof e.nativeEvent.getCoalescedEvents === "function"
            ? e.nativeEvent.getCoalescedEvents()
            : [e.nativeEvent];

        const canvas = canvasRef.current;
        if (canvas) {
          // Hoist getBoundingClientRect out of the loop — one layout read per move event.
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          for (const ev of events) {
            activeStrokePointsRef.current.push([
              (ev.clientX - rect.left) * scaleX,
              (ev.clientY - rect.top) * scaleY,
              ev.pressure || 0.5,
            ]);
          }
        }

        changedDuringPointerRef.current = true;
        onDrawingProgress?.();

        const now = performance.now();
        if (now - lastStrokeBroadcastAtRef.current >= 16) {
          lastStrokeBroadcastAtRef.current = now;
          onStrokeUpdate?.(
            activeStrokePointsRef.current,
            brushSettings.color,
            brushSettings.size,
            false
          );
        }
      },
      [
        brushSettings.tool,
        brushSettings.color,
        brushSettings.size,
        selectedAsset,
        onUpdatePlacedItem,
        paintWashiStrip,
        onDrawingProgress,
        onStrokeUpdate,
      ]
    );

    const handlePointerUp = useCallback((e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (e) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore release failures when capture is not active.
        }
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (isDrawing.current && activeStrokePointsRef.current.length) {
        renderActiveStroke();
        onStrokeUpdate?.(
          activeStrokePointsRef.current,
          brushSettings.color,
          brushSettings.size,
          true
        );
      }
      activeStrokePointsRef.current = [];
      preStrokeSnapshotRef.current = null;
      isDrawing.current = false;
      washiStartRef.current = null;
      preWashiStateRef.current = null;
      selectionDragRef.current = null;
      if (changedDuringPointerRef.current) {
        onDrawingCommit?.();
      }
      changedDuringPointerRef.current = false;
    }, [onDrawingCommit, renderActiveStroke, onStrokeUpdate, brushSettings.color, brushSettings.size]);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      saveToHistory();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onDrawingCommit?.();
    }, [saveToHistory, onDrawingCommit]);

    const undo = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || history.length === 0) return;
      const previous = history.at(-1);
      if (!previous) return;
      setRedoHistory((prev) => [...prev.slice(-30), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      ctx.putImageData(previous, 0, 0);
      setHistory((h) => h.slice(0, -1));
      onDrawingCommit?.();
    }, [history, onDrawingCommit]);

    const redo = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || redoHistory.length === 0) return;
      const next = redoHistory.at(-1);
      if (!next) return;
      setHistory((prev) => [...prev.slice(-30), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      ctx.putImageData(next, 0, 0);
      setRedoHistory((prev) => prev.slice(0, -1));
      onDrawingCommit?.();
    }, [redoHistory, onDrawingCommit]);

    const commitTextBlock = useCallback((text: string, id: string) => {
      if (!onUpdatePlacedItem) return;
      const nextText = text.trim();
      if (!nextText) return;

      const fontSize = Math.max(10, brushSettings.textSize ?? Math.max(14, brushSettings.size * 3));
      const lines = nextText.split("\n");
      const longest = Math.max(...lines.map((line) => line.length), 4);
      const blockWidth = Math.max(160, Math.min(760, longest * fontSize * 0.62));
      const blockHeight = Math.max(fontSize * 1.6, lines.length * fontSize * 1.4 + 14);

      onUpdatePlacedItem(id, {
        text: nextText,
        textColor: brushSettings.color,
        textSize: fontSize,
        textFont: brushSettings.textFont ?? '"Space Mono", monospace',
        width: blockWidth,
        height: blockHeight,
      });
    }, [onUpdatePlacedItem, brushSettings.color, brushSettings.size, brushSettings.textSize, brushSettings.textFont]);

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
      []
    );

    const shiftContent = useCallback(
      (dx: number, dy: number) => {
        shiftSingleCanvas(canvasRef.current, dx, dy);
        shiftSingleCanvas(overlayCanvasRef.current, dx, dy);
      },
      [shiftSingleCanvas]
    );

    const getCanvasImageData = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL("image/png");
    }, []);

    const setCanvasImageData = useCallback((imageData: string | null, options?: { shiftX?: number; shiftY?: number }) => {
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
    }, []);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getCanvasImageData,
      setCanvasImageData,
      clearCanvas,
      undo,
      redo,
      getCompositeCanvas,
      shiftContent,
    }));

    let cursor = "crosshair";
    if (brushSettings.tool === "eraser") cursor = "cell";
    else if (brushSettings.tool === "washi") cursor = "col-resize";
    else if (brushSettings.tool === "text") cursor = "text";
    else if (brushSettings.tool === "select") cursor = "default";

    const selectedItem = selectedItemId
      ? placedItems.find((item) => item.id === selectedItemId) ?? null
      : null;

    const animatedItems = useMemo(
      () => placedItems.filter((item) => item.isAnimated),
      [placedItems]
    );

    const nudgeScale = (delta: number) => {
      if (!selectedItem || !onUpdatePlacedItem) return;
      const nextWidth = Math.max(24, Math.round(selectedItem.width * delta));
      const nextHeight = Math.max(24, Math.round(selectedItem.height * delta));
      if (selectedItem.type === "text") {
        const nextTextSize = Math.max(10, Math.round((selectedItem.textSize ?? 28) * delta));
        onUpdatePlacedItem(selectedItem.id, {
          width: nextWidth,
          height: nextHeight,
          textSize: nextTextSize,
        });
        return;
      }
      onUpdatePlacedItem(selectedItem.id, {
        width: nextWidth,
        height: nextHeight,
      });
    };

    const nudgeRotation = (delta: number) => {
      if (!selectedItem || !onUpdatePlacedItem) return;
      onUpdatePlacedItem(selectedItem.id, {
        rotation: ((selectedItem.rotation + delta) % 360 + 360) % 360,
      });
    };

    const textFontSize = Math.max(10, brushSettings.textSize ?? Math.max(14, brushSettings.size * 3));
    const textFontFamily = brushSettings.textFont?.startsWith("custom:")
      ? '"Space Mono", monospace'
      : (brushSettings.textFont ?? '"Space Mono", monospace');

    return (
      <div className={fillContainer ? "relative h-full w-full" : "relative"} style={fillContainer ? undefined : { width, height }}>
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
                  onClick={() => setTextOverlay({ id: selectedItem.id, x: selectedItem.x, y: selectedItem.y, value: selectedItem.text ?? "" })}
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
              setTextOverlay((prev) =>
                prev ? { ...prev, value: e.target.value } : null
              )
            }
            onBlur={() => {
              if (textOverlay.value.trim()) {
                commitTextBlock(textOverlay.value, textOverlay.id);
              }
              setTextOverlay(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                if (textOverlay.value.trim()) {
                  commitTextBlock(textOverlay.value, textOverlay.id);
                }
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
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
