"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { BrushSettings, CustomFont, PaperBackground, PlacedSticker, Sticker, WashiTape } from "@/types";

export interface DrawingCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  clearCanvas: () => void;
  undo: () => void;
  getCompositeCanvas: () => HTMLCanvasElement;
  shiftContent: (dx: number, dy: number) => void;
}

async function renderCustomFontText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: CustomFont,
  size: number,
  glyphImagesRef: React.RefObject<Map<string, HTMLImageElement>>
) {
  let cursorX = x;
  const scale = size / font.glyphHeight;
  for (const char of text) {
    const glyphData = font.glyphs[char] ?? font.glyphs[char.toUpperCase()] ?? font.glyphs[char.toLowerCase()];
    if (!glyphData) {
      cursorX += Math.max(font.glyphWidth * scale * 0.6, 6);
      continue;
    }
    const cacheKey = `${font.id}:${char}`;
    let img = glyphImagesRef.current.get(cacheKey);
    if (!img) {
      img = new Image();
      img.src = glyphData;
      glyphImagesRef.current.set(cacheKey, img);
    }
    if (!img.complete) {
      await img.decode().catch(() => undefined);
    }
    const glyphW = font.glyphWidth * scale;
    const glyphH = font.glyphHeight * scale;
    ctx.drawImage(img, cursorX, y - glyphH, glyphW, glyphH);
    cursorX += glyphW * 0.72;
  }
}

interface DrawingCanvasProps {
  brushSettings: BrushSettings;
  placedItems: PlacedSticker[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  customFonts?: CustomFont[];
  onPlaceAsset: (asset: Sticker | WashiTape, x: number, y: number) => void;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  width?: number;
  height?: number;
  fillContainer?: boolean;
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
      backgroundOffsetX = 0,
      backgroundOffsetY = 0,
      width = 1200,
      height = 800,
      fillContainer = false,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    // Washi tape drag refs
    const washiStartRef = useRef<{ x: number; y: number } | null>(null);
    const preWashiStateRef = useRef<ImageData | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [textOverlay, setTextOverlay] = useState<{ x: number; y: number; value: string } | null>(null);
    const assetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const paperImageRef = useRef<HTMLImageElement | null>(null);
    const glyphImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

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
      placedItems.forEach((item) => {
        const img = assetImagesRef.current.get(item.id);
        if (img?.complete) {
          ctx.globalAlpha = item.opacity;
          ctx.drawImage(img, item.x, item.y, item.width, item.height);
          ctx.globalAlpha = 1;
        }
      });
    }, [placedItems]);

    const renderBackground = useCallback(() => {
      const background = backgroundCanvasRef.current;
      if (!background) return;
      const ctx = background.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, background.width, background.height);

      if (selectedPaper && paperImageRef.current?.complete) {
        const paper = paperImageRef.current;
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
      }
    }, [selectedPaper, backgroundOffsetX, backgroundOffsetY]);

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

    const drawLine = useCallback(
      (
        from: { x: number; y: number },
        to: { x: number; y: number },
        pressure: number
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { tool, color, size } = brushSettings;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        if (tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = color;
        }
        ctx.lineWidth = size * (0.5 + pressure * 0.8);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      },
      [brushSettings]
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
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture failures on unsupported browsers.
        }
        const point = getCanvasPoint(e);

        // Text: click to open text overlay
        if (brushSettings.tool === "text") {
          setTextOverlay({ x: point.x, y: point.y, value: "" });
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
        isDrawing.current = true;
        lastPoint.current = { x: point.x, y: point.y };
        saveToHistory();
        drawLine(
          { x: point.x, y: point.y },
          { x: point.x, y: point.y },
          point.pressure
        );
      },
      [
        getCanvasPoint,
        selectedAsset,
        brushSettings.tool,
        onPlaceAsset,
        saveToHistory,
        drawLine,
      ]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const point = getCanvasPoint(e);

        // Live washi preview: restore pre-washi state and redraw strip
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
          return;
        }

        if (!lastPoint.current) return;
        drawLine(lastPoint.current, { x: point.x, y: point.y }, point.pressure);
        lastPoint.current = { x: point.x, y: point.y };
      },
      [
        getCanvasPoint,
        brushSettings.tool,
        selectedAsset,
        drawLine,
        paintWashiStrip,
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
      isDrawing.current = false;
      lastPoint.current = null;
      washiStartRef.current = null;
      preWashiStateRef.current = null;
    }, []);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      saveToHistory();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, [saveToHistory]);

    const undo = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || history.length === 0) return;
      const previous = history.at(-1);
      if (!previous) return;
      ctx.putImageData(previous, 0, 0);
      setHistory((h) => h.slice(0, -1));
    }, [history]);

    const commitText = useCallback(
      async (text: string, x: number, y: number) => {
        if (!text.trim()) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        saveToHistory();
        const fontSize = Math.max(10, brushSettings.textSize ?? Math.max(14, brushSettings.size * 3));
        const textFont = brushSettings.textFont ?? '"Space Mono", monospace';

        if (textFont.startsWith("custom:")) {
          const fontId = textFont.slice("custom:".length);
          const font = customFonts.find((f) => f.id === fontId);
          if (!font) return;
          await renderCustomFontText(ctx, text, x, y, font, fontSize, glyphImagesRef);
          return;
        }

        ctx.font = `${fontSize}px ${textFont}`;
        ctx.fillStyle = brushSettings.color;
        ctx.fillText(text, x, y);
      },
      [brushSettings.color, brushSettings.size, brushSettings.textSize, brushSettings.textFont, customFonts, saveToHistory]
    );

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

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      clearCanvas,
      undo,
      getCompositeCanvas,
      shiftContent,
    }));

    let cursor = "crosshair";
    if (brushSettings.tool === "eraser") cursor = "cell";
    else if (brushSettings.tool === "washi") cursor = "col-resize";
    else if (brushSettings.tool === "text") cursor = "text";

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
        {textOverlay !== null && (
          <input
            autoFocus
            type="text"
            value={textOverlay.value}
            onChange={(e) =>
              setTextOverlay((prev) =>
                prev ? { ...prev, value: e.target.value } : null
              )
            }
            onBlur={() => {
              if (textOverlay.value.trim())
                void commitText(textOverlay.value, textOverlay.x, textOverlay.y);
              setTextOverlay(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (textOverlay.value.trim())
                  void commitText(textOverlay.value, textOverlay.x, textOverlay.y);
                setTextOverlay(null);
              } else if (e.key === "Escape") {
                setTextOverlay(null);
              }
            }}
            style={{
              position: "absolute",
              left: textOverlay.x,
              top: textOverlay.y - textFontSize,
              minWidth: 120,
              fontSize: textFontSize,
              fontFamily: textFontFamily,
              color: brushSettings.color,
              background: "rgba(255,255,255,0.85)",
              border: "1.5px dashed rgba(167,139,250,0.6)",
              borderRadius: 6,
              padding: "2px 6px",
              outline: "none",
              boxShadow: "0 2px 12px rgba(143,109,178,0.18)",
              lineHeight: 1.4,
            }}
          />
        )}
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
