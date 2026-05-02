
import type { PlacedSticker } from "@/types";
import { DrawingCanvasHandle } from "./DrawingCanvas";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main export entry point.
 * - Animated items present → WebM video (full colour, no palette limit)
 * - Static only            → JPEG (compact, high quality)
 */
export async function exportCanvas(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename = "mochimail",
  durationMs = 3000,
): Promise<void> {
  if (placedItems.some((p) => p.isAnimated)) {
    await _exportWebM(canvasHandle, placedItems, filename, durationMs);
  } else {
    _exportJpeg(canvasHandle, filename);
  }
}

// ─── JPEG (static) ────────────────────────────────────────────────────────────

function _exportJpeg(canvasHandle: DrawingCanvasHandle, filename: string) {
  const composite = canvasHandle.getCompositeCanvas();
  const link = document.createElement("a");
  link.download = `${filename}.jpg`;
  link.href = composite.toDataURL("image/jpeg", 0.92);
  link.click();
}

// ─── WebM video (animated) ────────────────────────────────────────────────────

async function _exportWebM(
  canvasHandle: DrawingCanvasHandle,
  placedItems: PlacedSticker[],
  filename: string,
  durationMs: number,
): Promise<void> {
  const base = canvasHandle.getBaseCanvas();
  const cw = base.width;
  const ch = base.height;

  // Scale so longest edge ≤ 1200 px — keeps file size manageable
  const MAX_DIM = 1200;
  const scale = Math.min(1, MAX_DIM / Math.max(cw, ch));
  const sw = Math.round(cw * scale);
  const sh = Math.round(ch * scale);

  // ── CORS-safe animated images ─────────────────────────────────────────────
  // Must have real CSS dimensions (not width:0/height:0) so the browser
  // advances their GIF frames. opacity:0 keeps them invisible.
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

  // Give the browser time to decode GIFs and start their animation loops
  await new Promise<void>((r) => setTimeout(r, 250));

  // ── Frame canvas ──────────────────────────────────────────────────────────
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = sw;
  frameCanvas.height = sh;
  const ctx = frameCanvas.getContext("2d")!;

  // Pre-scale static base once
  const scaledBase = document.createElement("canvas");
  scaledBase.width = sw;
  scaledBase.height = sh;
  scaledBase.getContext("2d")!.drawImage(base, 0, 0, sw, sh);

  // ── MediaRecorder setup ───────────────────────────────────────────────────
  const mimeType =
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

  const FPS = 30;
  const stream = frameCanvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(100); // flush data every 100 ms

  // ── Draw loop — runs for durationMs, rAF advances source GIF frames ───────
  const startTime = performance.now();
  await new Promise<void>((resolve) => {
    function step() {
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(scaledBase, 0, 0);

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

      if (performance.now() - startTime < durationMs) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });

  recorder.stop();
  await recordingDone;

  document.body.removeChild(corsContainer);

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.webm`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
