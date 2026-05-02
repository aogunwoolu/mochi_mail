
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrushSettings, CustomFont, PASTEL_COLORS, PaperBackground, Sticker, WashiTape } from "@/types";
import StudioAssetDrawer, { type DrawerSection, type GifSearchResult, getSwatchShadow } from "./StudioAssetDrawer";

// ── Scrapbook kits ────────────────────────────────────────────────────────────

type KitElement = { name: string; w: number; h: number; draw: (ctx: CanvasRenderingContext2D) => void };

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outerR: number, innerR: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

const SCRAPBOOK_KITS_DRAW: Record<string, KitElement[]> = {
  pastel: [
    {
      name: "Polaroid Frame", w: 240, h: 290,
      draw(ctx) {
        ctx.shadowColor = "rgba(0,0,0,0.13)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
        ctx.fillStyle = "#fff"; ctx.fillRect(4, 4, 232, 282); ctx.shadowColor = "transparent";
        ctx.fillStyle = "#ede9fe"; ctx.fillRect(18, 20, 204, 176);
        ctx.strokeStyle = "rgba(167,139,250,0.2)"; ctx.lineWidth = 1;
        for (let gx = 38; gx < 220; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 20); ctx.lineTo(gx, 196); ctx.stroke(); }
        for (let gy = 40; gy < 196; gy += 20) { ctx.beginPath(); ctx.moveTo(18, gy); ctx.lineTo(222, gy); ctx.stroke(); }
        ctx.strokeStyle = "rgba(255,107,157,0.25)"; ctx.lineWidth = 1;
        for (let ly = 224; ly < 272; ly += 16) { ctx.beginPath(); ctx.moveTo(32, ly); ctx.lineTo(208, ly); ctx.stroke(); }
      },
    },
    {
      name: "Heart Badge", w: 160, h: 150,
      draw(ctx) {
        ctx.fillStyle = "#fff0f6"; ctx.strokeStyle = "#ff6b9d"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(80, 118);
        ctx.bezierCurveTo(80, 118, 20, 82, 20, 54);
        ctx.bezierCurveTo(20, 28, 48, 18, 62, 30);
        ctx.bezierCurveTo(68, 35, 74, 40, 80, 46);
        ctx.bezierCurveTo(86, 40, 92, 35, 98, 30);
        ctx.bezierCurveTo(112, 18, 140, 28, 140, 54);
        ctx.bezierCurveTo(140, 82, 80, 118, 80, 118);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(255,107,157,0.4)"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(80, 108); ctx.bezierCurveTo(80, 108, 30, 78, 30, 54);
        ctx.bezierCurveTo(30, 34, 52, 26, 64, 36); ctx.bezierCurveTo(70, 41, 75, 44, 80, 50);
        ctx.bezierCurveTo(85, 44, 90, 41, 96, 36); ctx.bezierCurveTo(108, 26, 130, 34, 130, 54);
        ctx.bezierCurveTo(130, 78, 80, 108, 80, 108); ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
      },
    },
    {
      name: "Cloud Bubble", w: 270, h: 120,
      draw(ctx) {
        ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(167,139,250,0.3)"; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(68, 72, 36, 0, Math.PI * 2);
        ctx.arc(108, 58, 44, 0, Math.PI * 2);
        ctx.arc(152, 58, 44, 0, Math.PI * 2);
        ctx.arc(198, 68, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.moveTo(40, 100); ctx.lineTo(40, 108); ctx.lineTo(58, 100); ctx.fill();
        ctx.strokeStyle = "rgba(167,139,250,0.35)"; ctx.lineWidth = 1.5;
        for (let lx = 76; lx < 218; lx += 24) { ctx.beginPath(); ctx.moveTo(lx, 52); ctx.lineTo(lx + 16, 52); ctx.stroke(); }
        for (let lx = 66; lx < 218; lx += 24) { ctx.beginPath(); ctx.moveTo(lx, 66); ctx.lineTo(lx + 16, 66); ctx.stroke(); }
      },
    },
    {
      name: "Star Label", w: 170, h: 170,
      draw(ctx) {
        ctx.fillStyle = "#fdf2f8"; ctx.strokeStyle = "#f0abfc"; ctx.lineWidth = 3;
        drawStar(ctx, 85, 85, 8, 78, 52); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fae8ff"; ctx.strokeStyle = "rgba(240,171,252,0.5)"; ctx.lineWidth = 1.5;
        drawStar(ctx, 85, 85, 8, 62, 42); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(240,171,252,0.35)";
        ctx.beginPath(); ctx.arc(85, 85, 24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(240,171,252,0.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(85, 85, 24, 0, Math.PI * 2); ctx.stroke();
      },
    },
  ],

  vintage: [
    {
      name: "Airmail Frame", w: 270, h: 210,
      draw(ctx) {
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 270, 210);
        const stripe = 14;
        for (let i = -210; i < 270; i += stripe * 2) {
          ctx.fillStyle = "#3b82f6";
          ctx.save(); ctx.beginPath();
          ctx.rect(0, 0, 270, 210); ctx.clip();
          ctx.fillRect(i, 0, stripe, 14);
          ctx.fillRect(i, 196, stripe, 14);
          ctx.fillRect(0, i + 14, 14, stripe);
          ctx.fillRect(256, i + 14, 14, stripe);
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(i + stripe, 0, stripe, 14);
          ctx.fillRect(i + stripe, 196, stripe, 14);
          ctx.fillRect(0, i + stripe + 14, 14, stripe);
          ctx.fillRect(256, i + stripe + 14, 14, stripe);
          ctx.restore();
        }
        ctx.fillStyle = "#fff"; ctx.fillRect(14, 14, 242, 182);
        ctx.strokeStyle = "rgba(59,130,246,0.3)"; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(20, 20, 230, 170);
        ctx.setLineDash([]);
      },
    },
    {
      name: "Postmark", w: 190, h: 190,
      draw(ctx) {
        ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(95, 95, 80, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(95, 95, 72, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#6b7280"; ctx.font = 'bold 13px "Space Mono", monospace';
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("DELIVERED", 95, 82);
        ctx.fillText("POST • MARK", 95, 100);
        ctx.lineWidth = 2.5;
        for (let ly = 112; ly <= 128; ly += 8) {
          ctx.beginPath();
          ctx.moveTo(95 - 55 * Math.cos(Math.asin((ly - 95) / 80)), ly);
          ctx.lineTo(95 + 55 * Math.cos(Math.asin((ly - 95) / 80)), ly);
          ctx.stroke();
        }
        ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1.5;
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 10) {
          ctx.beginPath();
          ctx.arc(95, 95, 76, ang, ang + Math.PI / 18);
          ctx.stroke();
        }
      },
    },
    {
      name: "Travel Tag", w: 120, h: 200,
      draw(ctx) {
        ctx.fillStyle = "#fefce8"; ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2;
        drawRoundRect(ctx, 6, 28, 108, 166, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "rgba(217,119,6,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(60, 17, 12, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#d97706"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(60, 5); ctx.lineTo(60, 0); ctx.stroke();
        ctx.strokeStyle = "rgba(217,119,6,0.25)"; ctx.lineWidth = 1;
        for (let ly = 56; ly < 186; ly += 14) {
          ctx.beginPath(); ctx.moveTo(18, ly); ctx.lineTo(102, ly); ctx.stroke();
        }
        ctx.fillStyle = "#d97706"; ctx.font = 'bold 9px "Space Mono", monospace';
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("FROM:", 18, 44);
        ctx.fillText("TO:", 18, 164 + 14);
      },
    },
    {
      name: "Stamp Frame", w: 160, h: 200,
      draw(ctx) {
        ctx.fillStyle = "#f0fdf4"; ctx.fillRect(0, 0, 160, 200);
        ctx.fillStyle = "#fff"; ctx.fillRect(14, 14, 132, 172);
        const dotR = 4; const dotStep = 12;
        ctx.fillStyle = "#f0fdf4";
        for (let dx = 14; dx <= 146; dx += dotStep) {
          ctx.beginPath(); ctx.arc(dx, 14, dotR, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(dx, 186, dotR, 0, Math.PI * 2); ctx.fill();
        }
        for (let dy = 14 + dotStep; dy < 186; dy += dotStep) {
          ctx.beginPath(); ctx.arc(14, dy, dotR, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(146, dy, dotR, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(22, 22, 116, 156);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(74,222,128,0.15)"; ctx.fillRect(22, 22, 116, 156);
      },
    },
  ],

  garden: [
    {
      name: "Botanical Frame", w: 270, h: 210,
      draw(ctx) {
        ctx.fillStyle = "#f0fdf4"; ctx.fillRect(0, 0, 270, 210);
        ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2;
        ctx.strokeRect(18, 18, 234, 174);
        const drawLeaf = (x: number, y: number, angle: number) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
          ctx.fillStyle = "#86efac"; ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, -14, 8, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -26); ctx.stroke();
          ctx.restore();
        };
        drawLeaf(18, 18, -Math.PI / 4);
        drawLeaf(252, 18, Math.PI / 4);
        drawLeaf(18, 192, -3 * Math.PI / 4);
        drawLeaf(252, 192, 3 * Math.PI / 4);
        const drawSmallFlower = (x: number, y: number) => {
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.fillStyle = "#fce7f3";
            ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 5, a, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        };
        drawSmallFlower(135, 18); drawSmallFlower(18, 105); drawSmallFlower(252, 105); drawSmallFlower(135, 192);
      },
    },
    {
      name: "Daisy Sticker", w: 170, h: 170,
      draw(ctx) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          ctx.fillStyle = "#fce7f3"; ctx.strokeStyle = "#f9a8d4"; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(85 + Math.cos(a) * 44, 85 + Math.sin(a) * 44, 14, 24, a, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath(); ctx.arc(85, 85, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath(); ctx.arc(85, 85, 24, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#fef3c7";
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
          ctx.beginPath(); ctx.arc(85 + Math.cos(a) * 13, 85 + Math.sin(a) * 13, 3, 0, Math.PI * 2); ctx.fill();
        }
      },
    },
    {
      name: "Leaf Sprig", w: 140, h: 210,
      draw(ctx) {
        ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(70, 200); ctx.quadraticCurveTo(60, 120, 70, 20); ctx.stroke();
        const leafData = [
          { t: 0.2, side: -1, angle: -Math.PI / 3 }, { t: 0.35, side: 1, angle: Math.PI / 4 },
          { t: 0.52, side: -1, angle: -Math.PI / 4 }, { t: 0.67, side: 1, angle: Math.PI / 5 },
          { t: 0.82, side: -1, angle: -Math.PI / 6 }, { t: 0.93, side: 1, angle: Math.PI / 8 },
        ];
        leafData.forEach(({ t, angle }) => {
          const stemX = 70 - 10 * t + 10 * t * t;
          const stemY = 200 - 180 * t;
          ctx.save(); ctx.translate(stemX, stemY); ctx.rotate(angle);
          ctx.fillStyle = "#86efac"; ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5;
          const lw = 10 + (1 - t) * 8; const lh = 18 + (1 - t) * 14;
          ctx.beginPath(); ctx.ellipse(0, -lh / 2, lw, lh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -lh); ctx.stroke();
          ctx.restore();
        });
      },
    },
    {
      name: "Pressed Oval", w: 250, h: 175,
      draw(ctx) {
        ctx.fillStyle = "#fefce8"; ctx.strokeStyle = "#a3e635"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(125, 88, 112, 72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(163,230,53,0.4)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.ellipse(125, 88, 96, 56, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const drawAccentLeaf = (angle: number) => {
          const ex = 125 + Math.cos(angle) * 108; const ey = 88 + Math.sin(angle) * 68;
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle + Math.PI / 2);
          ctx.fillStyle = "#bef264"; ctx.strokeStyle = "#4d7c0f"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(0, -8, 6, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        };
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) drawAccentLeaf(a);
      },
    },
  ],

  journal: [
    {
      name: "Photo Tape", w: 310, h: 72,
      draw(ctx) {
        ctx.fillStyle = "rgba(167,139,250,0.22)";
        drawRoundRect(ctx, 0, 0, 310, 72, 6); ctx.fill();
        ctx.strokeStyle = "rgba(167,139,250,0.5)"; ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        for (let tx = 18; tx < 300; tx += 28) {
          ctx.beginPath(); ctx.moveTo(tx, 8); ctx.lineTo(tx, 64); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(167,139,250,0.35)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, 310, 72);
      },
    },
    {
      name: "Film Strip", w: 250, h: 140,
      draw(ctx) {
        ctx.fillStyle = "#1e1e2e"; drawRoundRect(ctx, 0, 0, 250, 140, 6); ctx.fill();
        ctx.fillStyle = "#fff";
        for (let hx = 12; hx < 246; hx += 22) {
          ctx.beginPath(); ctx.rect(hx, 6, 14, 10); ctx.fill();
          ctx.beginPath(); ctx.rect(hx, 124, 14, 10); ctx.fill();
        }
        const frames = 3; const fw = 68; const fh = 88;
        const startX = (250 - frames * fw - (frames - 1) * 6) / 2;
        for (let i = 0; i < frames; i++) {
          const fx = startX + i * (fw + 6);
          ctx.fillStyle = "#2d2d44";
          ctx.beginPath(); ctx.rect(fx, 26, fw, fh); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.rect(fx, 26, fw, fh); ctx.stroke();
        }
      },
    },
    {
      name: "Sticky Note", w: 185, h: 185,
      draw(ctx) {
        ctx.save();
        ctx.translate(92, 92); ctx.rotate(0.05); ctx.translate(-92, -92);
        ctx.fillStyle = "#fef9c3";
        ctx.shadowColor = "rgba(0,0,0,0.12)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
        ctx.fillRect(8, 8, 170, 170); ctx.shadowColor = "transparent";
        ctx.fillStyle = "#fbbf24"; ctx.fillRect(8, 8, 170, 20);
        ctx.strokeStyle = "rgba(180,150,0,0.25)"; ctx.lineWidth = 1;
        for (let ly = 44; ly < 168; ly += 16) {
          ctx.beginPath(); ctx.moveTo(18, ly); ctx.lineTo(168, ly); ctx.stroke();
        }
        ctx.restore();
      },
    },
    {
      name: "Caption Box", w: 290, h: 96,
      draw(ctx) {
        ctx.fillStyle = "#f0f9ff"; ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
        drawRoundRect(ctx, 4, 4, 282, 88, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(4, 4, 10, 88);
        ctx.beginPath(); ctx.arc(4, 4, 8, 0, Math.PI * 2); ctx.arc(4, 92, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(56,189,248,0.3)"; ctx.lineWidth = 1;
        for (let ly = 30; ly < 80; ly += 18) {
          ctx.beginPath(); ctx.moveTo(24, ly); ctx.lineTo(272, ly); ctx.stroke();
        }
      },
    },
  ],
};

// ── GIF search ────────────────────────────────────────────────────────────────

const GIF_SEARCH_URL = "/api/gifs/search";

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") { const n = Number(value); if (Number.isFinite(n)) return n; }
  return fallback;
}

function normalizeGifResults(payload: unknown): GifSearchResult[] {
  const data = (payload as { data?: unknown[]; results?: unknown[] })?.data
    ?? (payload as { data?: unknown[]; results?: unknown[] })?.results
    ?? [];
  if (!Array.isArray(data)) return [];

  return data.map((entry, index) => {
    const item = entry as {
      id?: string; title?: string; content_description?: string; url?: string;
      images?: { fixed_width?: { url?: string; width?: string | number; height?: string | number }; downsized_medium?: { url?: string }; original?: { url?: string; width?: string | number; height?: string | number } };
      media_formats?: { gif?: { url?: string; dims?: number[] }; tinygif?: { url?: string; dims?: number[] }; nanogif?: { url?: string; dims?: number[] } };
    };
    const previewUrl = item.images?.fixed_width?.url ?? item.media_formats?.tinygif?.url ?? item.media_formats?.nanogif?.url;
    const gifUrl = item.images?.downsized_medium?.url ?? item.images?.original?.url ?? item.media_formats?.gif?.url ?? item.url;
    if (!previewUrl || !gifUrl) return null;
    return {
      id: item.id ?? `gif-${index}`,
      title: item.title ?? item.content_description ?? "GIF",
      previewUrl,
      gifUrl,
      width: toNumber(item.images?.fixed_width?.width ?? item.images?.original?.width ?? item.media_formats?.gif?.dims?.[0], 200),
      height: toNumber(item.images?.fixed_width?.height ?? item.images?.original?.height ?? item.media_formats?.gif?.dims?.[1], 200),
    } satisfies GifSearchResult;
  }).filter((item): item is GifSearchResult => item !== null);
}

// ── Built-in font options ─────────────────────────────────────────────────────

const BUILT_IN_FONTS: { label: string; preview: string; value: string }[] = [
  { label: "Mono",       preview: "Aa", value: '"Space Mono", monospace' },
  { label: "Serif",      preview: "Aa", value: "Georgia, serif" },
  { label: "Sans",       preview: "Aa", value: "Arial, sans-serif" },
  { label: "Playful",   preview: "Aa", value: '"Comic Sans MS", cursive' },
  { label: "Type",       preview: "Aa", value: '"Courier New", monospace' },
];

const TEXT_SIZES: { label: string; value: number; display: number }[] = [
  { label: "Small",  value: 14, display: 11 },
  { label: "Medium", value: 24, display: 15 },
  { label: "Large",  value: 36, display: 20 },
  { label: "XL",     value: 52, display: 26 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Collaborator = { id: string; name: string; color: string; avatarUrl?: string; username?: string };

interface StudioToolbarProps {
  brushSettings: BrushSettings;
  onBrushChange: (s: Partial<BrushSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  customFonts: CustomFont[];
  selectedAsset: Sticker | WashiTape | null;
  selectedPaper: PaperBackground | null;
  onSelectSticker: (s: Sticker) => void;
  onSelectWashi: (w: WashiTape) => void;
  onSelectPaper: (p: PaperBackground) => void;
  onDeselectAsset: () => void;
  onDeleteSticker: (id: string) => void;
  onDeleteWashi: (id: string) => void;
  onDeletePaper: (id: string) => void;
  onDeleteCustomFont: (id: string) => void;
  onSaveSticker: (name: string, imageData: string, w: number, h: number, isAnimated?: boolean) => void;
  onSaveWashi: (name: string, imageData: string, opacity: number, w: number, h: number) => void;
  onSaveCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  collaborators: Collaborator[];
  selfCollaboratorId: string;
  onJumpToCollaborator: (artistId: string) => void;
}

// ── Tool button ───────────────────────────────────────────────────────────────

function ToolBtn({
  active = false,
  onClick,
  title,
  label,
  children,
}: Readonly<{
  active?: boolean;
  onClick: () => void;
  title: string;
  label?: string;
  children: React.ReactNode;
}>) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="btn-smooth flex flex-col items-center gap-1"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className="flex items-center justify-center rounded-2xl transition-all"
        style={{
          width: 44,
          height: 44,
          background: active
            ? "linear-gradient(135deg, rgba(255,107,157,0.18), rgba(167,139,250,0.15))"
            : "transparent",
          border: active
            ? "1.5px solid rgba(255,107,157,0.4)"
            : "1.5px solid transparent",
          boxShadow: active ? "0 2px 8px rgba(255,107,157,0.15)" : "none",
        }}
      >
        {children}
      </span>
      {label ? (
        <span
          className="text-[9px] font-semibold leading-none tracking-wide"
          style={{ color: active ? "var(--pink)" : "var(--muted)" }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      className="w-8 shrink-0 self-center"
      style={{ height: 1, background: "rgba(186,156,214,0.25)" }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioToolbar({
  brushSettings, onBrushChange, onUndo, onRedo, onClear, onExport,
  stickers, washiTapes, papers, customFonts, selectedAsset, selectedPaper,
  onSelectSticker, onSelectWashi, onSelectPaper, onDeselectAsset,
  onDeleteSticker, onDeleteWashi, onDeletePaper, onDeleteCustomFont,
  onSaveSticker, onSaveWashi, onSaveCustomFont,
  collaborators, selfCollaboratorId, onJumpToCollaborator,
}: Readonly<StudioToolbarProps>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>("assets");
  const [gifQuery, setGifQuery] = useState("cute sticker");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifUrlInput, setGifUrlInput] = useState("");
  const [customColor, setCustomColor] = useState(brushSettings.color);
  const [assetSearch, setAssetSearch] = useState("");
  const [userPalette, setUserPalette] = useState<string[]>([
    PASTEL_COLORS[0],
    PASTEL_COLORS[2],
    PASTEL_COLORS[4],
    PASTEL_COLORS[8],
    "#1e1e2e",
  ]);

  useEffect(() => { setCustomColor(brushSettings.color); }, [brushSettings.color]);

  // Persist custom palette
  useEffect(() => {
    if (!globalThis.window) return;
    try {
      const raw = globalThis.localStorage.getItem("mochimail_left_palette");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c))
        .slice(0, 5);
      if (normalized.length >= 4) setUserPalette(normalized);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!globalThis.window) return;
    globalThis.localStorage.setItem("mochimail_left_palette", JSON.stringify(userPalette));
  }, [userPalette]);

  const colorChoices = useMemo(() => PASTEL_COLORS.slice(0, 10), []);
  const selectedTextFont = brushSettings.textFont ?? '"Space Mono", monospace';
  const selectedTextSize = brushSettings.textSize ?? 36;
  const assetCount = stickers.length + washiTapes.length + papers.length;

  // GIF helpers
  const addGifAsset = useCallback((src: string, title?: string) => {
    const trimmed = src.trim();
    if (!trimmed) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxEdge = 220;
      const ratio = img.width / img.height;
      const w = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const h = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;
      onSaveSticker(title?.trim() || "Animated Sticker", trimmed, w, h, true);
      setActiveSection("assets");
    };
    img.onerror = () => setGifError("Could not load this GIF. Try another result or URL.");
    img.src = trimmed;
  }, [onSaveSticker]);

  const addGifFromUrl = useCallback(() => {
    if (!gifUrlInput.trim()) return;
    setGifError(null);
    addGifAsset(gifUrlInput, "Imported GIF");
    setGifUrlInput("");
  }, [addGifAsset, gifUrlInput]);

  const addGifFromResult = useCallback((result: GifSearchResult) => {
    setGifError(null);
    addGifAsset(result.gifUrl, result.title || "GIF");
  }, [addGifAsset]);

  const searchGifs = useCallback(async () => {
    const q = gifQuery.trim();
    if (!q) { setGifResults([]); return; }
    setGifLoading(true);
    setGifError(null);
    try {
      const res = await fetch(`${GIF_SEARCH_URL}?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "search_failed");
      const mapped = normalizeGifResults(json);
      setGifResults(mapped);
      if (mapped.length === 0) setGifError("No GIFs found. Try a different search term.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      if (code === "missing_gifapi_key") setGifError("GIFAPI_KEY not set on the server.");
      else if (code === "missing_giphy_key") setGifError("GIPHY_API_KEY not set on the server.");
      else if (code === "rate_limited") setGifError("Too many requests — please wait a moment.");
      else setGifError("GIF search failed.");
    } finally {
      setGifLoading(false);
    }
  }, [gifQuery]);

  useEffect(() => {
    if (activeSection !== "extras") return;
    if (gifResults.length > 0 || gifLoading) return;
    fetch(`${GIF_SEARCH_URL.replace("/search", "/status")}`)
      .then((r) => r.json())
      .then((status: { ready?: boolean; error?: string }) => {
        if (status.ready === false) {
          const code = status.error ?? "unknown";
          if (code === "missing_giphy_key") setGifError("GIPHY_API_KEY is not configured. Add it in Replit Secrets.");
          else if (code === "missing_gifapi_key") setGifError("GIFAPI_KEY is not configured. Add it in Replit Secrets.");
          else setGifError("GIF provider is not configured.");
        } else {
          void searchGifs();
        }
      })
      .catch(() => void searchGifs());
  }, [activeSection, gifResults.length, gifLoading, searchGifs]);

  const addScrapbookKit = useCallback((kitId: string) => {
    const elements = SCRAPBOOK_KITS_DRAW[kitId];
    if (!elements) return;
    elements.forEach(({ name, w, h, draw }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      draw(ctx);
      onSaveSticker(name, canvas.toDataURL("image/png"), w, h);
    });
  }, [onSaveSticker]);

  const addScrapbookElement = useCallback((kitId: string, elementName: string) => {
    const elements = SCRAPBOOK_KITS_DRAW[kitId];
    if (!elements) return;
    const el = elements.find((e) => e.name === elementName);
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.w; canvas.height = el.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    el.draw(ctx);
    onSaveSticker(el.name, canvas.toDataURL("image/png"), el.w, el.h);
  }, [onSaveSticker]);

  const setTool = useCallback((tool: BrushSettings["tool"]) => {
    onBrushChange({ tool });
    if (["pen", "eraser", "text", "select"].includes(tool)) onDeselectAsset();
  }, [onBrushChange, onDeselectAsset]);

  const isStickerActive = brushSettings.tool === "sticker" && selectedAsset !== null;
  const isWashiActive = brushSettings.tool === "washi" && selectedAsset !== null;
  const shownCollaborators = collaborators.slice(0, 6);

  // Icon SVGs
  const PenIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const TextIcon = (
    <span
      className="text-xl font-bold leading-none"
      style={{ fontFamily: '"Space Mono", monospace', color: brushSettings.tool === "text" ? "var(--pink)" : "#666" }}
    >
      T
    </span>
  );
  const SelectIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 2v15.5l3.5-3.1 2 3.9 1.8-0.9-2-3.9H17L6 2z"
        stroke={brushSettings.tool === "select" ? "var(--pink)" : "#666"}
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const EraserIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"
        stroke={brushSettings.tool === "eraser" ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 17l4-4"
        stroke={brushSettings.tool === "eraser" ? "var(--pink)" : "#666"}
        strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const AssetsIcon = (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5"
        stroke={drawerOpen ? "var(--pink)" : "#666"} strokeWidth="2" />
    </svg>
  );
  const UndoIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 7h10a6 6 0 0 1 0 12H9" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7l4-4M3 7l4 4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const RedoIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 7H11a6 6 0 0 0 0 12h4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 7l-4-4M21 7l-4 4" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const ExportIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12l4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">

      {/* ── Left toolbar (centered in canvas area above tab bar) ── */}
      <div
        className="pointer-events-none absolute left-3 z-20 flex items-center justify-center"
        style={{ top: "1rem", bottom: "5.5rem" }}
      >
        <div
          className="pointer-events-auto flex flex-col items-center gap-0.5 px-2 py-3"
          style={{
            maxHeight: "100%",
            overflowY: "auto",
            scrollbarWidth: "none",
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 22,
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 8px 32px rgba(143,109,178,0.16), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <ToolBtn
            active={brushSettings.tool === "pen" && !isStickerActive && !isWashiActive}
            onClick={() => setTool("pen")}
            title="Pen"
            label="Pen"
          >
            {PenIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "text"}
            onClick={() => setTool("text")}
            title="Text"
            label="Text"
          >
            {TextIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "select"}
            onClick={() => setTool("select")}
            title="Select / move"
            label="Select"
          >
            {SelectIcon}
          </ToolBtn>
          <ToolBtn
            active={brushSettings.tool === "eraser"}
            onClick={() => setTool("eraser")}
            title="Eraser"
            label="Erase"
          >
            {EraserIcon}
          </ToolBtn>

          <Divider />

          <ToolBtn
            active={drawerOpen}
            onClick={() => setDrawerOpen((p) => !p)}
            title="Open studio assets"
            label="Assets"
          >
            {AssetsIcon}
          </ToolBtn>

          <Divider />

          {/* Color swatches — 2-column grid */}
          <div className="grid grid-cols-2 gap-1.5 px-0.5 py-0.5">
            {userPalette.map((color, i) => {
              const selected = brushSettings.color === color;
              return (
                <button
                  key={`${color}-${i}`}
                  onClick={() => {
                    onBrushChange({
                      color,
                      tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool,
                    });
                    onDeselectAsset();
                  }}
                  className="btn-smooth rounded-full transition-all"
                  style={{
                    width: 24,
                    height: 24,
                    background: color,
                    boxShadow: selected
                      ? `0 0 0 2px white, 0 0 0 4px ${color}`
                      : color === "#ffffff"
                      ? "inset 0 0 0 1.5px rgba(0,0,0,0.15)"
                      : "0 1px 4px rgba(0,0,0,0.15)",
                  }}
                  title={color}
                  aria-label={`Color ${color}`}
                />
              );
            })}
            <label
              className="btn-smooth flex cursor-pointer items-center justify-center overflow-hidden rounded-full"
              style={{
                width: 24,
                height: 24,
                background: "conic-gradient(from 0deg, #ff6b9d, #fb923c, #fbbf24, #6ee7b7, #67d4f1, #a78bfa, #ff6b9d)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
              title="Custom color"
              aria-label="Pick custom color"
            >
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onBrushChange({
                    color: e.target.value,
                    tool: brushSettings.tool === "eraser" ? "pen" : brushSettings.tool,
                  });
                  onDeselectAsset();
                }}
                className="absolute opacity-0"
                style={{ width: 1, height: 1 }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Brush size — floats to the right of the toolbar, same vertical center ── */}
      {(brushSettings.tool === "pen" || brushSettings.tool === "eraser") && (
        <div
          className="pointer-events-none absolute left-[4.5rem] z-20 flex items-center"
          style={{ top: "1rem", bottom: "5.5rem" }}
        >
          <div
            className="pointer-events-auto flex flex-col items-center gap-1 px-1.5 py-2"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 16,
              border: "1px solid rgba(186,156,214,0.25)",
              boxShadow: "0 4px 16px rgba(143,109,178,0.13), 0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {([2, 5, 10, 18] as const).map((sz) => {
              const active = brushSettings.size === sz;
              const dot = Math.max(4, Math.min(sz + 2, 16));
              return (
                <button
                  key={sz}
                  onClick={() => onBrushChange({ size: sz })}
                  className="btn-smooth flex items-center justify-center rounded-xl"
                  style={{
                    width: 34,
                    height: 34,
                    background: active ? "rgba(255,107,157,0.13)" : "transparent",
                  }}
                  title={`Size ${sz}`}
                  aria-label={`Brush size ${sz}`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: dot,
                      height: dot,
                      background: active ? "var(--pink)" : "rgba(100,80,130,0.35)",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Text options — floats to the right of the toolbar when text tool active ── */}
      {brushSettings.tool === "text" && (
        <div
          className="pointer-events-none absolute left-[4.5rem] z-20 flex items-center"
          style={{ top: "1rem", bottom: "5.5rem" }}
        >
          <div
            className="pointer-events-auto flex flex-col items-center gap-0.5 px-1.5 py-2"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 16,
              border: "1px solid rgba(186,156,214,0.25)",
              boxShadow: "0 4px 16px rgba(143,109,178,0.13), 0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {/* Size label */}
            <span
              className="mb-0.5 text-[8px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Size
            </span>

            {/* Size presets */}
            {TEXT_SIZES.map((sz) => {
              const active = selectedTextSize === sz.value;
              return (
                <button
                  key={sz.value}
                  onClick={() => onBrushChange({ textSize: sz.value })}
                  className="btn-smooth flex items-center justify-center rounded-xl"
                  style={{
                    width: 38,
                    height: 34,
                    background: active ? "rgba(255,107,157,0.13)" : "transparent",
                  }}
                  title={`${sz.label} (${sz.value}px)`}
                  aria-label={`Text size ${sz.label}`}
                >
                  <span
                    style={{
                      fontSize: sz.display,
                      fontFamily: '"Space Mono", monospace',
                      fontWeight: 700,
                      color: active ? "var(--pink)" : "rgba(100,80,130,0.45)",
                      lineHeight: 1,
                    }}
                  >
                    A
                  </span>
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ width: 26, height: 1, background: "rgba(186,156,214,0.3)", margin: "3px 0" }} />

            {/* Font label */}
            <span
              className="mb-0.5 text-[8px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Font
            </span>

            {/* Built-in font presets */}
            {BUILT_IN_FONTS.map((font) => {
              const active = selectedTextFont === font.value;
              return (
                <button
                  key={font.value}
                  onClick={() => onBrushChange({ textFont: font.value })}
                  className="btn-smooth flex flex-col items-center justify-center rounded-xl gap-0"
                  style={{
                    width: 38,
                    height: 38,
                    background: active ? "rgba(167,139,250,0.15)" : "transparent",
                  }}
                  title={font.label}
                  aria-label={`Font: ${font.label}`}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: font.value,
                      fontWeight: 700,
                      color: active ? "var(--lavender)" : "rgba(100,80,130,0.5)",
                      lineHeight: 1,
                    }}
                  >
                    Aa
                  </span>
                  <span
                    style={{
                      fontSize: 7,
                      fontFamily: '"Space Mono", monospace',
                      color: active ? "var(--lavender)" : "rgba(100,80,130,0.35)",
                      lineHeight: 1.2,
                      marginTop: 2,
                    }}
                  >
                    {font.label}
                  </span>
                </button>
              );
            })}

            {/* Custom fonts */}
            {customFonts.length > 0 && (
              <>
                <div style={{ width: 26, height: 1, background: "rgba(186,156,214,0.3)", margin: "3px 0" }} />
                {customFonts.map((cf) => {
                  const value = `custom:${cf.name}`;
                  const active = selectedTextFont === value;
                  return (
                    <button
                      key={cf.id}
                      onClick={() => onBrushChange({ textFont: value })}
                      className="btn-smooth flex flex-col items-center justify-center rounded-xl"
                      style={{
                        width: 38,
                        height: 38,
                        background: active ? "rgba(251,146,60,0.13)" : "transparent",
                      }}
                      title={cf.name}
                      aria-label={`Custom font: ${cf.name}`}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 700,
                          color: active ? "var(--coral)" : "rgba(100,80,130,0.5)",
                          lineHeight: 1.2,
                          textAlign: "center",
                          maxWidth: 34,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cf.name}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Collaborator avatars (top right) ──────────────────────────────── */}
      <div
        className="pointer-events-auto absolute z-30 flex items-center gap-2"
        style={{
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
          top: "calc(1rem + env(safe-area-inset-top, 0px))",
        }}
      >
        {shownCollaborators.map((artist) => {
          const isSelf = artist.id === selfCollaboratorId;
          const initials = artist.name.split(" ").map((p) => p.charAt(0).toUpperCase()).join("").slice(0, 2) || "?";
          const hasSpace = !isSelf && Boolean(artist.username);
          const avatar = (
            <span
              className="relative flex items-center justify-center overflow-hidden rounded-full"
              style={{
                width: 42,
                height: 42,
                background: "linear-gradient(135deg, #e8e0f0, #d1c4f8)",
                border: `3px solid ${artist.color}`,
                boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
                flexShrink: 0,
              }}
            >
              {artist.avatarUrl ? (
                <img src={artist.avatarUrl} alt={artist.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-bold" style={{ color: "#6b4fa8" }}>{initials}</span>
              )}
              {isSelf && (
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                  style={{ background: "#22c55e", border: "2px solid white" }}
                />
              )}
            </span>
          );
          return (
            <div key={artist.id} className="group relative flex flex-col items-center">
              {hasSpace ? (
                <a
                  href={`/space/${artist.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    onJumpToCollaborator(artist.id);
                    window.open(`/space/${artist.username}`, "_blank");
                  }}
                  className="btn-smooth"
                  aria-label={`${artist.name}'s space`}
                >
                  {avatar}
                </a>
              ) : (
                <button
                  onClick={() => onJumpToCollaborator(artist.id)}
                  className="btn-smooth"
                  aria-label={isSelf ? `${artist.name} (you)` : `Jump to ${artist.name}`}
                >
                  {avatar}
                </button>
              )}
              <div
                className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-semibold opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                style={{
                  background: "rgba(255,255,255,0.97)",
                  color: "var(--foreground)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}
              >
                {isSelf ? `${artist.name} (you)` : artist.name}
                {hasSpace && (
                  <span className="ml-1 text-[10px]" style={{ color: "var(--lavender)" }}>
                    · visit space ↗
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Action buttons (bottom right) ────────────────────────────────── */}
      <div
        className="pointer-events-auto absolute z-30 flex flex-col gap-2.5"
        style={{
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={onUndo}
          className="btn-smooth flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 4px 16px rgba(143,109,178,0.14), 0 1px 4px rgba(0,0,0,0.07)",
          }}
          title="Undo"
          aria-label="Undo"
        >
          {UndoIcon}
        </button>
        <button
          onClick={onRedo}
          className="btn-smooth flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(186,156,214,0.25)",
            boxShadow: "0 4px 16px rgba(143,109,178,0.14), 0 1px 4px rgba(0,0,0,0.07)",
          }}
          title="Redo"
          aria-label="Redo"
        >
          {RedoIcon}
        </button>
        <button
          onClick={onExport}
          className="btn-smooth flex items-center justify-center rounded-2xl"
          style={{
            width: 48,
            height: 48,
            background: "linear-gradient(135deg, var(--pink), var(--lavender))",
            boxShadow: "0 6px 18px rgba(255,107,157,0.38)",
          }}
          title="Export PNG"
          aria-label="Export PNG"
        >
          {ExportIcon}
        </button>
      </div>

      {/* ── Asset drawer — rendered LAST so it always paints above toolbar/buttons ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="animate-fade-backdrop pointer-events-auto absolute inset-0 z-40"
            style={{ background: "rgba(30,10,50,0.14)", backdropFilter: "blur(3px)" }}
            onClick={() => setDrawerOpen(false)}
          />
          {/* Sheet */}
          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 z-50 animate-slide-up overflow-hidden"
            style={{
              maxHeight: "76vh",
              borderRadius: "24px 24px 0 0",
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 -8px 40px rgba(143,109,178,0.18), 0 -2px 8px rgba(0,0,0,0.06)",
              border: "1px solid rgba(186,156,214,0.25)",
              borderBottom: "none",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="rounded-full"
                style={{ width: 40, height: 4, background: "rgba(186,156,214,0.5)" }}
              />
            </div>
            <div style={{ maxHeight: "calc(76vh - 20px)", overflowY: "auto" }}>
              <StudioAssetDrawer
                assetCount={assetCount}
                activeSection={activeSection}
                stickers={stickers}
                washiTapes={washiTapes}
                papers={papers}
                customFonts={customFonts}
                selectedAsset={selectedAsset}
                selectedPaper={selectedPaper}
                brushSettings={brushSettings}
                customColor={customColor}
                colorChoices={colorChoices}
                gifQuery={gifQuery}
                gifResults={gifResults}
                gifLoading={gifLoading}
                gifError={gifError}
                gifUrlInput={gifUrlInput}
                assetSearch={assetSearch}
                onClose={() => setDrawerOpen(false)}
                onSelectSection={setActiveSection}
                onSelectSticker={onSelectSticker}
                onSelectWashi={onSelectWashi}
                onSelectPaper={onSelectPaper}
                onDeselectAsset={onDeselectAsset}
                onDeleteSticker={onDeleteSticker}
                onDeleteWashi={onDeleteWashi}
                onDeletePaper={onDeletePaper}
                onDeleteCustomFont={onDeleteCustomFont}
                onSaveSticker={onSaveSticker}
                onSaveWashi={onSaveWashi}
                onSaveCustomFont={onSaveCustomFont}
                onBrushChange={onBrushChange}
                onClear={onClear}
                setCustomColor={setCustomColor}
                setGifQuery={setGifQuery}
                searchGifs={searchGifs}
                addGifFromResult={addGifFromResult}
                setGifUrlInput={setGifUrlInput}
                addGifFromUrl={addGifFromUrl}
                onAddScrapbookKit={addScrapbookKit}
                onAddScrapbookElement={addScrapbookElement}
                setAssetSearch={setAssetSearch}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
