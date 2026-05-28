
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

import type { PlacedSticker } from "@/types";
import { DrawingCanvasHandle } from "./DrawingCanvas";

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StaticFormat = "png" | "jpeg";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main export entry point.
 * - Animated stickers present → GIF (high quality, loops forever)
 * - Static only               → PNG or JPEG (lossless PNG by default)
 * Pass cropRegion (canvas coordinates) to export only a portion.
 */
export async function exportCanvas(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename = "mochimail",
  durationMs = 3000,
  cropRegion?: CropRegion,
  staticFormat: StaticFormat = "png",
): Promise<void> {
  if (placedItems.some((p) => p.isAnimated)) {
    await _exportGif(canvasHandle, placedItems, filename, durationMs, cropRegion);
  } else {
    _exportStatic(canvasHandle, filename, cropRegion, staticFormat);
  }
}

// ─── PNG / JPEG (static) ──────────────────────────────────────────────────────

function _exportStatic(
  canvasHandle: DrawingCanvasHandle,
  filename: string,
  cropRegion?: CropRegion,
  format: StaticFormat = "png",
) {
  const composite = canvasHandle.getCompositeCanvas();
  let src: HTMLCanvasElement = composite;

  if (cropRegion) {
    const { x, y, width, height } = cropRegion;
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    cropped.getContext("2d")!.drawImage(composite, x, y, width, height, 0, 0, width, height);
    src = cropped;
  }

  const link = document.createElement("a");
  if (format === "jpeg") {
    link.download = `${filename}.jpg`;
    link.href = src.toDataURL("image/jpeg", 0.95);
  } else {
    link.download = `${filename}.png`;
    link.href = src.toDataURL("image/png");
  }
  link.click();
}

// ─── Animated GIF ─────────────────────────────────────────────────────────────

const GIF_FPS = 15;
const GIF_MAX_DIM = 800;

async function _exportGif(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename: string,
  durationMs: number,
  cropRegion?: CropRegion,
): Promise<void> {
  const base = canvasHandle.getBaseCanvas();
  const cw = base.width;
  const ch = base.height;

  const srcX = cropRegion?.x ?? 0;
  const srcY = cropRegion?.y ?? 0;
  const srcW = cropRegion?.width ?? cw;
  const srcH = cropRegion?.height ?? ch;

  const scale = Math.min(1, GIF_MAX_DIM / Math.max(srcW, srcH));
  const sw = Math.round(srcW * scale);
  const sh = Math.round(srcH * scale);

  // ── CORS-safe animated images ─────────────────────────────────────────────
  const corsContainer = document.createElement("div");
  corsContainer.style.cssText =
    "position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-9999;overflow:hidden";
  document.body.appendChild(corsContainer);

  const animatedItems = placedItems.filter((p) => p.isAnimated);
  const corsImgs = new Map<string, HTMLImageElement>();

  await Promise.all(
    animatedItems.map(
      (item) =>
        new Promise<void>((resolve) => {
          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.style.cssText = `position:absolute;width:${item.width}px;height:${item.height}px`;
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = item.imageData;
          corsContainer.appendChild(img);
          corsImgs.set(item.id, img);
        }),
    ),
  );

  await new Promise<void>((r) => setTimeout(r, 250));

  // ── Frame canvas ──────────────────────────────────────────────────────────
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = sw;
  frameCanvas.height = sh;
  const ctx = frameCanvas.getContext("2d")!;

  // Pre-scale the static base (cropped)
  const scaledBase = document.createElement("canvas");
  scaledBase.width = sw;
  scaledBase.height = sh;
  scaledBase.getContext("2d")!.drawImage(base, srcX, srcY, srcW, srcH, 0, 0, sw, sh);

  // ── GIF encoder ───────────────────────────────────────────────────────────
  const gif = GIFEncoder();
  const frameDelayMs = Math.round(1000 / GIF_FPS);
  const totalFrames = Math.round((durationMs / 1000) * GIF_FPS);

  // Capture frames via rAF so GIF source images advance their animation
  await new Promise<void>((resolve) => {
    let frameIndex = 0;

    function captureFrame() {
      // Render this frame
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(scaledBase, 0, 0);

      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-srcX, -srcY);
      for (const item of animatedItems) {
        if (cropRegion) {
          const ir = item.x + item.width;
          const ib = item.y + item.height;
          if (ir < srcX || item.x > srcX + srcW || ib < srcY || item.y > srcY + srcH) continue;
        }
        const img = corsImgs.get(item.id);
        if (!img || img.naturalWidth === 0) continue;
        ctx.save();
        ctx.globalAlpha = item.opacity;
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Encode this frame
      const imageData = ctx.getImageData(0, 0, sw, sh);
      const palette = quantize(imageData.data, 256, { format: "rgb565" });
      const index = applyPalette(imageData.data, palette, "rgb565");
      gif.writeFrame(index, sw, sh, {
        palette,
        delay: frameDelayMs,
        // repeat on the first frame only
        ...(frameIndex === 0 ? { repeat: 0 } : {}),
      });

      frameIndex++;
      if (frameIndex < totalFrames) {
        requestAnimationFrame(captureFrame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(captureFrame);
  });

  gif.finish();
  document.body.removeChild(corsContainer);

  const bytes: Uint8Array = gif.bytes();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.gif`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
