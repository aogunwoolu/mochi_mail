
import type { ScrapbookKit, ScrapbookKitElement } from "@/types";

// ── Canvas helpers ─────────────────────────────────────────────────────────────

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

interface KitElementDef {
  name: string;
  w: number;
  h: number;
  draw: DrawFn;
}

interface BuiltInKitDef {
  id: string;
  name: string;
  description: string;
  accent: string;
  tags: string[];
  elements: KitElementDef[];
}

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

// ── Built-in kit definitions ──────────────────────────────────────────────────

export const BUILTIN_KIT_DEFS: BuiltInKitDef[] = [
  {
    id: "pastel",
    name: "Pastel Dreams",
    description: "Soft kawaii scrapbook essentials",
    accent: "#ff6b9d",
    tags: ["kawaii", "pastel", "cute", "pink"],
    elements: [
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
  },

  {
    id: "vintage",
    name: "Vintage Post",
    description: "Airmail envelopes, postmarks & tags",
    accent: "#3b82f6",
    tags: ["vintage", "postal", "travel", "retro"],
    elements: [
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
            ctx.beginPath(); ctx.arc(95, 95, 76, ang, ang + Math.PI / 18); ctx.stroke();
          }
        },
      },
      {
        name: "Travel Tag", w: 120, h: 200,
        draw(ctx) {
          ctx.fillStyle = "#fefce8"; ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2;
          drawRoundRect(ctx, 6, 28, 108, 166, 10); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "rgba(217,119,6,0.4)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(60, 17, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = "#d97706"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(60, 5); ctx.lineTo(60, 0); ctx.stroke();
          ctx.strokeStyle = "rgba(217,119,6,0.25)"; ctx.lineWidth = 1;
          for (let ly = 56; ly < 186; ly += 14) { ctx.beginPath(); ctx.moveTo(18, ly); ctx.lineTo(102, ly); ctx.stroke(); }
          ctx.fillStyle = "#d97706"; ctx.font = 'bold 9px "Space Mono", monospace';
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText("FROM:", 18, 44);
          ctx.fillText("TO:", 18, 178);
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
          ctx.setLineDash([3, 3]); ctx.strokeRect(22, 22, 116, 156); ctx.setLineDash([]);
          ctx.fillStyle = "rgba(74,222,128,0.15)"; ctx.fillRect(22, 22, 116, 156);
        },
      },
    ],
  },

  {
    id: "garden",
    name: "Garden Notes",
    description: "Botanical frames, florals & pressed elements",
    accent: "#4ade80",
    tags: ["botanical", "nature", "floral", "garden"],
    elements: [
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
          drawLeaf(18, 18, -Math.PI / 4); drawLeaf(252, 18, Math.PI / 4);
          drawLeaf(18, 192, -3 * Math.PI / 4); drawLeaf(252, 192, 3 * Math.PI / 4);
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
          ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5;
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
            { t: 0.2, angle: -Math.PI / 3 }, { t: 0.35, angle: Math.PI / 4 },
            { t: 0.52, angle: -Math.PI / 4 }, { t: 0.67, angle: Math.PI / 5 },
            { t: 0.82, angle: -Math.PI / 6 }, { t: 0.93, angle: Math.PI / 8 },
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
  },

  {
    id: "journal",
    name: "Journal Clips",
    description: "Photo tape, film strips & memory notes",
    accent: "#a78bfa",
    tags: ["journal", "memory", "film", "diary"],
    elements: [
      {
        name: "Photo Tape", w: 310, h: 72,
        draw(ctx) {
          ctx.fillStyle = "rgba(167,139,250,0.22)";
          drawRoundRect(ctx, 0, 0, 310, 72, 6); ctx.fill();
          ctx.strokeStyle = "rgba(167,139,250,0.5)"; ctx.lineWidth = 1;
          ctx.setLineDash([6, 4]);
          for (let tx = 18; tx < 300; tx += 28) { ctx.beginPath(); ctx.moveTo(tx, 8); ctx.lineTo(tx, 64); ctx.stroke(); }
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
          for (let ly = 44; ly < 168; ly += 16) { ctx.beginPath(); ctx.moveTo(18, ly); ctx.lineTo(168, ly); ctx.stroke(); }
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
          for (let ly = 30; ly < 80; ly += 18) { ctx.beginPath(); ctx.moveTo(24, ly); ctx.lineTo(272, ly); ctx.stroke(); }
        },
      },
    ],
  },
];

// ── Rendering helpers ─────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function renderElementDef(def: KitElementDef): ScrapbookKitElement {
  const canvas = document.createElement("canvas");
  canvas.width = def.w; canvas.height = def.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { name: def.name, imageData: "", width: def.w, height: def.h };
  def.draw(ctx);
  return { name: def.name, imageData: canvas.toDataURL("image/png"), width: def.w, height: def.h };
}

export function renderBuiltInKits(): ScrapbookKit[] {
  return BUILTIN_KIT_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    creator: "MochiMail",
    creatorId: "system",
    accent: def.accent,
    tags: def.tags,
    elements: def.elements.map(renderElementDef),
    createdAt: 0,
    isBuiltIn: true,
  }));
}

export function renderBuiltInKitElement(kitId: string, elementName: string): ScrapbookKitElement | null {
  const kit = BUILTIN_KIT_DEFS.find((k) => k.id === kitId);
  if (!kit) return null;
  const el = kit.elements.find((e) => e.name === elementName);
  if (!el) return null;
  return renderElementDef(el);
}

export function createScrapbookKit(
  name: string,
  description: string,
  accent: string,
  tags: string[],
  elements: ScrapbookKitElement[],
  creator: string,
  creatorId: string
): ScrapbookKit {
  return {
    id: generateId(),
    name,
    description,
    creator,
    creatorId,
    accent,
    tags,
    elements,
    createdAt: Date.now(),
  };
}
