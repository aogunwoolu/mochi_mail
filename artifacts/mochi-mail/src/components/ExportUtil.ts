"use client";

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { PlacedSticker } from "@/types";
import { DrawingCanvasHandle } from "./DrawingCanvas";

// ─── Static PNG export ────────────────────────────────────────────────────────

export function exportWithDSBorder(
  canvasHandle: DrawingCanvasHandle,
  filename: string = "mochimail"
) {
  const composite = canvasHandle.getCompositeCanvas();
  const cw = composite.width;
  const ch = composite.height;

  const padding = 32;
  const labelHeight = 28;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = cw + padding * 2;
  exportCanvas.height = ch + padding * 2 + labelHeight;
  const ctx = exportCanvas.getContext("2d")!;

  _drawDecoFrame(ctx, composite, cw, ch, padding, labelHeight, exportCanvas.width, exportCanvas.height);

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

// ─── Animated GIF export ──────────────────────────────────────────────────────

/**
 * Exports an animated GIF when the canvas contains animated GIFs, otherwise
 * falls back to a static PNG.
 *
 * Quality notes:
 * - Draws from live DOM <img> elements (animatedImgRefsRef) so the browser's
 *   own GIF frame advancement is captured — no GIF decoder needed.
 * - Skips the gradient decorative frame: a gradient uses ~80 palette slots,
 *   leaving almost nothing for actual content colours. GIF is exported as
 *   clean canvas content with a plain white background instead.
 * - Per-frame colour quantisation: each frame gets its own optimal 256-colour
 *   palette, preventing the washed-out look of a single global palette.
 */
export async function exportAnimated(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename = "mochimail",
  durationMs = 3000,
): Promise<void> {
  const hasGifs = placedItems.some((p) => p.isAnimated);
  if (!hasGifs) {
    exportWithDSBorder(canvasHandle, filename);
    return;
  }

  // ── Dimensions: scale so longest edge ≤ 1200 px ────────────────────────────
  const base = canvasHandle.getBaseCanvas();
  const cw = base.width;
  const ch = base.height;

  const MAX_DIM = 1200;
  const scale = Math.min(1, MAX_DIM / Math.max(cw, ch));
  const sw = Math.round(cw * scale);
  const sh = Math.round(ch * scale);

  // ── CORS-safe animated images ───────────────────────────────────────────────
  // DOM <img> elements loaded without crossOrigin taint the canvas and block
  // getImageData(). Fix: create fresh elements with crossOrigin="anonymous" in
  // a hidden container so the browser (a) makes a CORS request and (b) advances
  // GIF animation frames while the element is in the live document.
  const corsContainer = document.createElement("div");
  corsContainer.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(corsContainer);

  const animatedItems = placedItems.filter((p) => p.isAnimated);
  const corsImgs = new Map<string, HTMLImageElement>();

  await Promise.all(
    animatedItems.map(
      (item) =>
        new Promise<void>((resolve) => {
          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve(); // don't block export on a bad URL
          img.src = item.imageData;
          corsContainer.appendChild(img);
          corsImgs.set(item.id, img);
        }),
    ),
  );

  // ── Frame canvas (willReadFrequently for fast getImageData) ─────────────────
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = sw;
  frameCanvas.height = sh;
  const ctx = frameCanvas.getContext("2d", { willReadFrequently: true })!;

  // Pre-scale the static base once
  const scaledBase = document.createElement("canvas");
  scaledBase.width = sw;
  scaledBase.height = sh;
  scaledBase.getContext("2d")!.drawImage(base, 0, 0, sw, sh);

  // ── GIF settings ─────────────────────────────────────────────────────────
  const FPS = 15;
  const FRAME_DELAY = Math.round(100 / FPS); // centiseconds (GIF time unit)
  const TOTAL_FRAMES = Math.round(FPS * durationMs / 1000);

  const gif = GIFEncoder();

  // ── Capture loop via rAF — browser advances each source GIF each tick ───────
  await new Promise<void>((resolve) => {
    let captured = 0;

    function step() {
      // 1. Static layers (background + strokes + stickers)
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(scaledBase, 0, 0);

      // 2. Current frame of each animated GIF from the CORS-safe elements
      ctx.save();
      ctx.scale(scale, scale);
      for (const item of animatedItems) {
        const img = corsImgs.get(item.id);
        if (!img || img.naturalWidth === 0) continue;
        ctx.save();
        ctx.globalAlpha = item.opacity;
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 3. Per-frame quantise — each frame gets its own optimal 256-colour palette
      const { data } = ctx.getImageData(0, 0, sw, sh);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, sw, sh, { palette, delay: FRAME_DELAY, repeat: 0 });

      captured++;
      if (captured >= TOTAL_FRAMES) {
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  });

  // Clean up hidden container
  document.body.removeChild(corsContainer);

  gif.finish();

  const blob = new Blob([gif.bytes().buffer as ArrayBuffer], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.gif`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Shared decorative frame (PNG export only) ────────────────────────────────

function _drawDecoFrame(
  ctx: CanvasRenderingContext2D,
  content: HTMLCanvasElement,
  cw: number,
  ch: number,
  padding: number,
  labelHeight: number,
  totalW: number,
  totalH: number,
) {
  const grad = ctx.createLinearGradient(0, 0, totalW, totalH);
  grad.addColorStop(0, "#1a1028");
  grad.addColorStop(1, "#0f0a1a");
  ctx.fillStyle = grad;
  _rrFill(ctx, 0, 0, totalW, totalH, 16);

  ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
  ctx.lineWidth = 2;
  _rrPath(ctx, 1, 1, totalW - 2, totalH - 2, 16);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  _rrPath(ctx, padding, padding, cw, ch, 8);
  ctx.clip();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(padding, padding, cw, ch);
  ctx.drawImage(content, padding, padding);
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  _rrPath(ctx, padding, padding, cw, ch, 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦ MochiMail ✦", totalW / 2, padding + ch + labelHeight);
}

function _rrFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  _rrPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function _rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
