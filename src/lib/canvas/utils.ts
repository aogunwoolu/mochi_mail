/**
 * Shared canvas utilities for generating images and data URLs
 */

/**
 * Creates a canvas element with the specified dimensions
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Canvas and context, or null if not available
 */
export function createCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!globalThis.document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * Runs a draw function on a new canvas and returns a PNG data URL
 * @param w - Canvas width
 * @param h - Canvas height
 * @param draw - Drawing function that receives the 2D context
 * @returns PNG data URL or empty string if canvas unavailable
 */
export function renderToCanvas(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  draw(ctx);
  return canvas.toDataURL("image/png");
}
