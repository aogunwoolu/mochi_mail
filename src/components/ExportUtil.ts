"use client";

import { DrawingCanvasHandle } from "./DrawingCanvas";

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

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height);
  grad.addColorStop(0, "#1a1028");
  grad.addColorStop(1, "#0f0a1a");
  ctx.fillStyle = grad;
  roundedRectFill(ctx, 0, 0, exportCanvas.width, exportCanvas.height, 16);

  // Subtle glow border
  ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
  ctx.lineWidth = 2;
  roundedRectPath(ctx, 1, 1, exportCanvas.width - 2, exportCanvas.height - 2, 16);
  ctx.stroke();

  // Screen area
  ctx.save();
  ctx.beginPath();
  roundedRectPath(ctx, padding, padding, cw, ch, 8);
  ctx.clip();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(padding, padding, cw, ch);
  ctx.drawImage(composite, padding, padding);
  ctx.restore();

  // Frame border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  roundedRectPath(ctx, padding, padding, cw, ch, 8);
  ctx.stroke();

  // Label
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦ MochiMail ✦", exportCanvas.width / 2, padding + ch + labelHeight);

  // Download
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

function roundedRectFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
