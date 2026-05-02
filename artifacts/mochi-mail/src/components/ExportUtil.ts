
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
 * Fix for "not animated" bug: the CORS images must have real CSS layout
 * dimensions (not width:0/height:0) so the browser advances their GIF frames.
 * Zero-size or display:none elements are skipped by the browser's animation
 * engine — every captured frame would be frame-1, producing a static output.
 *
 * Fix for quality: 10 fps keeps file size manageable while still looking smooth,
 * and each frame gets its own optimal palette via per-frame quantisation.
 */
export async function exportAnimated(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename = "mochimail",
  durationMs = 2500,
): Promise<void> {
  const hasGifs = placedItems.some((p) => p.isAnimated);
  if (!hasGifs) {
    exportWithDSBorder(canvasHandle, filename);
    return;
  }

  // ── Dimensions: scale so longest edge ≤ 800 px ─────────────────────────────
  // Smaller output = fewer unique pixel colours = better palette use in GIF.
  const base = canvasHandle.getBaseCanvas();
  const cw = base.width;
  const ch = base.height;

  const MAX_DIM = 800;
  const scale = Math.min(1, MAX_DIM / Math.max(cw, ch));
  const sw = Math.round(cw * scale);
  const sh = Math.round(ch * scale);

  // ── CORS-safe animated images ───────────────────────────────────────────────
  // CRITICAL: images MUST have non-zero layout dimensions in the document.
  // The browser's GIF animation engine skips elements that are width:0/height:0
  // or display:none. We use opacity:0 + actual size to keep them invisible while
  // still letting the browser advance their frames.
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
          // Give the image its actual rendered dimensions — required for animation.
          img.style.cssText = `position:absolute;width:${item.width}px;height:${item.height}px`;
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = item.imageData;
          corsContainer.appendChild(img);
          corsImgs.set(item.id, img);
        }),
    ),
  );

  // Wait for the browser to decode & start animating the GIFs.
  // Without this pause the first several captured frames are often still frame-1.
  await new Promise<void>((r) => setTimeout(r, 250));

  // ── Frame canvas (willReadFrequently for fast getImageData) ─────────────────
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = sw;
  frameCanvas.height = sh;
  const ctx = frameCanvas.getContext("2d", { willReadFrequently: true })!;

  // Pre-scale the static base once — reused every frame
  const scaledBase = document.createElement("canvas");
  scaledBase.width = sw;
  scaledBase.height = sh;
  scaledBase.getContext("2d")!.drawImage(base, 0, 0, sw, sh);

  // ── GIF settings ─────────────────────────────────────────────────────────
  // 10 fps: smooth enough for GIF, keeps file size manageable.
  const FPS = 10;
  const FRAME_DELAY = Math.round(100 / FPS); // centiseconds
  const TOTAL_FRAMES = Math.round((FPS * durationMs) / 1000);

  const gif = GIFEncoder();

  // ── Capture loop — rAF lets the browser advance each source GIF each tick ──
  await new Promise<void>((resolve) => {
    let captured = 0;

    function step() {
      // 1. Static base (background + strokes + static stickers)
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(scaledBase, 0, 0);

      // 2. Animated GIFs — drawn at scaled coordinates
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
      }
      ctx.globalAlpha = 1;
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
