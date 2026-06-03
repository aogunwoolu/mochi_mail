export type BgType = "solid" | "gradient" | "image" | "css";

export type BgFit = "cover" | "contain" | "tile";

export interface BgConfig {
  type: BgType;
  color?: string;
  c1?: string;
  c2?: string;
  angle?: number;
  url?: string;
  value?: string;
  /** Image-only: how the photo fills the page. */
  fit?: BgFit;
  /** Image-only: white scrim opacity 0–100, for text legibility over busy photos. */
  scrim?: number;
}

export interface FontConfig {
  family: string;
  color: string;
  size: number;
}

export interface SpaceConfig {
  bg: BgConfig;
  font: FontConfig;
  audioLoop: boolean;
  lineColor: string;
}

export const DEFAULT_SPACE_CONFIG: SpaceConfig = {
  bg: {
    type: "css",
    value:
      "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  },
  font: { family: "System", color: "#352742", size: 14 },
  audioLoop: true,
  lineColor: "#ff6b9d",
};

export const FONT_OPTIONS: ReadonlyArray<{ label: string; css: string; gfont: string | null }> = [
  { label: "System", css: "system-ui, -apple-system, sans-serif", gfont: null },
  { label: "Lato", css: "'Lato', sans-serif", gfont: "Lato:wght@400;600;700" },
  { label: "Playfair", css: "'Playfair Display', serif", gfont: "Playfair+Display:wght@400;600;700" },
  { label: "Dancing Script", css: "'Dancing Script', cursive", gfont: "Dancing+Script:wght@400;600;700" },
  { label: "Space Mono", css: "'Space Mono', monospace", gfont: "Space+Mono:wght@400;700" },
  { label: "Nunito", css: "'Nunito', sans-serif", gfont: "Nunito:wght@400;600;700" },
];

export const EMOJI_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["🌸", "🌻", "🍀", "🦋", "🌈", "⭐", "💕", "🎀"],
  ["🍡", "🧸", "🎵", "💌", "🍰", "🌙", "✨", "🫧"],
  ["🌷", "🦊", "🐱", "🐰", "🍓", "🧁", "🎨", "💫"],
  ["🎪", "🧶", "🪄", "🌺", "🦄", "🏮", "🎋", "🪷"],
];

export const GRADIENT_PRESETS: ReadonlyArray<{ label: string; c1: string; c2: string; angle: number }> = [
  { label: "Petal", c1: "#ffd6ec", c2: "#fff6fb", angle: 135 },
  { label: "Sky", c1: "#d9f7ff", c2: "#f0f8ff", angle: 180 },
  { label: "Mint", c1: "#d9f99d", c2: "#d9f7ff", angle: 145 },
  { label: "Sunset", c1: "#ffedd5", c2: "#ffd6ec", angle: 135 },
  { label: "Lavender", c1: "#e4dcff", c2: "#ffd6ec", angle: 120 },
  { label: "Matcha", c1: "#d4f7dd", c2: "#fffde7", angle: 160 },
  { label: "Ocean", c1: "#a8edea", c2: "#fed6e3", angle: 135 },
  { label: "Dusk", c1: "#c9d6ff", c2: "#e2e2e2", angle: 225 },
];

export const SOLID_PRESETS = [
  "#ffffff", "#fdf6ff", "#fff0f5", "#f0f8ff", "#f0fff4",
  "#fffde7", "#fff3e0", "#fce4ec", "#e8eaf6", "#e0f2f1",
  "#f3e5f5", "#fff8e1", "#e8f5e9", "#e3f2fd", "#fbe9e7",
];

export interface ThemePreset {
  label: string;
  emoji: string;
  bg: BgConfig;
  font: FontConfig;
  lineColor: string;
}

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    label: "Mochi",
    emoji: "🌸",
    bg: { type: "css", value: DEFAULT_SPACE_CONFIG.bg.value },
    font: { family: "Nunito", color: "#5b4769", size: 14 },
    lineColor: "#ff6b9d",
  },
  {
    label: "Cottagecore",
    emoji: "🍄",
    bg: { type: "gradient", c1: "#fef3c7", c2: "#d9f99d", angle: 160 },
    font: { family: "Playfair", color: "#4d3b2a", size: 15 },
    lineColor: "#a3a847",
  },
  {
    label: "Y2K",
    emoji: "💿",
    bg: { type: "gradient", c1: "#a8edea", c2: "#fed6e3", angle: 135 },
    font: { family: "Space Mono", color: "#1f2a44", size: 13 },
    lineColor: "#67d4f1",
  },
  {
    label: "Minimal",
    emoji: "🤍",
    bg: { type: "solid", color: "#fafafa" },
    font: { family: "Lato", color: "#2b2b2b", size: 14 },
    lineColor: "#9ca3af",
  },
  {
    label: "Dark Academia",
    emoji: "📚",
    bg: { type: "gradient", c1: "#3b322c", c2: "#5c4a3a", angle: 160 },
    font: { family: "Playfair", color: "#CDA760", size: 15 },
    lineColor: "#c9a36b",
  },
  {
    label: "Bubblegum",
    emoji: "🍬",
    bg: { type: "gradient", c1: "#ffd6ec", c2: "#e4dcff", angle: 120 },
    font: { family: "Dancing Script", color: "#7a3b69", size: 16 },
    lineColor: "#ff6b9d",
  },
  {
    label: "Matcha",
    emoji: "🍵",
    bg: { type: "gradient", c1: "#d4f7dd", c2: "#fffde7", angle: 160 },
    font: { family: "Nunito", color: "#2f4a39", size: 14 },
    lineColor: "#6ee7b7",
  },
  {
    label: "Midnight",
    emoji: "🌙",
    bg: { type: "gradient", c1: "#1e1b4b", c2: "#3b2f63", angle: 160 },
    font: { family: "Space Mono", color: "#e6e1ff", size: 13 },
    lineColor: "#a78bfa",
  },
];

export function parseSpaceConfig(wallpaper: string | null | undefined): SpaceConfig {
  const d = DEFAULT_SPACE_CONFIG;
  if (!wallpaper) return d;
  if (wallpaper.startsWith("{")) {
    try {
      const parsed = JSON.parse(wallpaper) as Partial<SpaceConfig>;
      return {
        bg: { ...d.bg, ...(parsed.bg ?? {}) },
        font: { ...d.font, ...(parsed.font ?? {}) },
        audioLoop: parsed.audioLoop ?? d.audioLoop,
        lineColor: parsed.lineColor ?? d.lineColor,
      };
    } catch {
      return d;
    }
  }
  return { ...d, bg: { type: "css", value: wallpaper } };
}

export function bgToCss(bg: BgConfig): string {
  if (bg.type === "solid") return bg.color ?? "#ffffff";
  if (bg.type === "gradient")
    return `linear-gradient(${bg.angle ?? 135}deg, ${bg.c1 ?? "#ff6b9d"}, ${bg.c2 ?? "#ffffff"})`;
  if (bg.type === "image" && bg.url) {
    const size = bg.fit === "contain" ? "contain" : bg.fit === "tile" ? "auto" : "cover";
    const repeat = bg.fit === "tile" ? "repeat" : "no-repeat";
    const scrim = bg.scrim
      ? `linear-gradient(rgba(255,255,255,${bg.scrim / 100}), rgba(255,255,255,${bg.scrim / 100})), `
      : "";
    return `${scrim}url('${bg.url}') center/${size} ${repeat} fixed`;
  }
  return bg.value ?? DEFAULT_SPACE_CONFIG.bg.value!;
}

export function spaceConfigToWallpaper(config: SpaceConfig): string {
  return JSON.stringify(config);
}

export function loadGoogleFont(gfont: string | null) {
  if (!gfont) return;
  const id = `gfont-${gfont.split(":")[0].replace(/\+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
  document.head.appendChild(link);
}

export function fontCss(family: string): string {
  return FONT_OPTIONS.find((f) => f.label === family)?.css ?? "system-ui, sans-serif";
}

export function isSticker(item: { color: string }): boolean {
  return item.color === "sticker";
}

export function isVisitorNote(item: { color: string }): boolean {
  return item.color === "visitor";
}

export function isPinnedItem(item: { title: string }): boolean {
  return item.title.startsWith("📌 ");
}

export function displayTitle(item: { title: string }): string {
  return item.title.startsWith("📌 ") ? item.title.slice(3) : item.title;
}

export function itemCardBg(item: { color: string }): string {
  if (item.color === "sticker") return "transparent";
  if (item.color === "visitor") return "#fff8c4";
  return item.color;
}
