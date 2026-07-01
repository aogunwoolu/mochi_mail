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
  /** CSS font-weight; undefined = 400 */
  weight?: number;
}

/** Per-section typography overrides — anything unset falls back to the page font. */
export interface SectionFont {
  family?: string;
  weight?: number;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

// ─── Page sections (MySpace-style layout) ────────────────────────────────────
// The space page is a vertical column of sections the owner can add, remove and
// reorder. Stored inside the SpaceConfig JSON (profiles.wallpaper) so a
// visitor loads the owner's saved layout with the rest of the theme.

export type SpaceSectionType =
  | "profile"    // hero card: avatar, name, tagline, about
  | "board"      // the freeform tldraw board with all its items
  | "text"       // heading + free text
  | "links"      // list of labelled links
  | "gallery"    // grid of photos (URLs)
  | "guestbook"  // visitor notes + sign button
  | "friends"    // "Top 8" — usernames linking to their spaces
  | "marquee"    // scrolling text banner
  | "music";     // visible embedded player (YouTube / Spotify)

export interface SpaceLink {
  label: string;
  url: string;
}

/** How much of the page row a section occupies (stacks to full width on mobile). */
export type SectionWidth = "full" | "twothirds" | "half" | "third";

export interface SpaceSection {
  id: string;
  type: SpaceSectionType;
  title?: string;
  /** text / marquee body */
  text?: string;
  /** links section */
  links?: SpaceLink[];
  /** gallery image URLs */
  images?: string[];
  /** friends section — usernames */
  friends?: string[];
  /** music section — YouTube or Spotify URL */
  url?: string;
  /** board section — embed height preset */
  size?: "s" | "m" | "l";
  /** row width — sections flow side by side when they fit */
  width?: SectionWidth;
  /** typography overrides for this section's text */
  font?: SectionFont;
}

/** Layout used when a space has never customised its sections — mirrors the
 *  pre-sections page (profile card + board + visitor notes). */
export function defaultSections(): SpaceSection[] {
  return [
    { id: "sec-profile", type: "profile" },
    { id: "sec-board", type: "board", title: "✨ My board", size: "m" },
    { id: "sec-guestbook", type: "guestbook", title: "💌 Guestbook" },
  ];
}

export const SECTION_TYPE_META: ReadonlyArray<{ type: SpaceSectionType; emoji: string; label: string; blurb: string }> = [
  { type: "profile", emoji: "🪞", label: "Profile card", blurb: "Avatar, name, tagline & about" },
  { type: "board", emoji: "🎨", label: "Doodle board", blurb: "Your freeform pinboard canvas" },
  { type: "text", emoji: "📝", label: "Text block", blurb: "A heading and anything you want to say" },
  { type: "links", emoji: "🔗", label: "Links", blurb: "Your favourite corners of the web" },
  { type: "gallery", emoji: "📷", label: "Photo gallery", blurb: "A little grid of pictures" },
  { type: "guestbook", emoji: "💌", label: "Guestbook", blurb: "Notes visitors leave for you" },
  { type: "friends", emoji: "👯", label: "Top friends", blurb: "Shout out your favourite spaces" },
  { type: "marquee", emoji: "🎏", label: "Marquee", blurb: "A scrolling ticker, very 2004" },
  { type: "music", emoji: "🎶", label: "Music player", blurb: "A visible player for a song or playlist" },
];

export interface SpaceConfig {
  bg: BgConfig;
  font: FontConfig;
  audioLoop: boolean;
  lineColor: string;
  /** undefined = never customised → defaultSections() */
  sections?: SpaceSection[];
  /** "sections" = arranged page (default) · "canvas" = classic full-page board */
  layout?: "sections" | "canvas";
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

export type FontCategory = "clean" | "cute" | "handwritten" | "serif" | "display" | "retro";

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  clean: "✨ Clean & modern",
  cute: "🍡 Cute & round",
  handwritten: "✍️ Handwritten",
  serif: "📖 Serif & fancy",
  display: "🎪 Display & fun",
  retro: "👾 Retro & pixel",
};

export interface FontOption {
  label: string;
  css: string;
  gfont: string | null;
  category: FontCategory;
  /** Weights available on Google Fonts for this family */
  weights: ReadonlyArray<number>;
}

function gf(
  label: string,
  category: FontCategory,
  weights: number[],
  opts: { name?: string; fallback?: string } = {},
): FontOption {
  const name = opts.name ?? label;
  const spec = weights.length === 1 && weights[0] === 400
    ? name.replace(/ /g, "+")
    : `${name.replace(/ /g, "+")}:wght@${weights.join(";")}`;
  return {
    label,
    css: `'${name}', ${opts.fallback ?? "sans-serif"}`,
    gfont: spec,
    category,
    weights,
  };
}

export const FONT_OPTIONS: ReadonlyArray<FontOption> = [
  { label: "System", css: "system-ui, -apple-system, sans-serif", gfont: null, category: "clean", weights: [300, 400, 500, 600, 700, 800] },
  // ── Clean & modern ─────────────────────────────────────────────────────────
  gf("Lato", "clean", [300, 400, 700, 900]),
  gf("Nunito", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Poppins", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Montserrat", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Raleway", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Rubik", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Karla", "clean", [300, 400, 500, 600, 700, 800]),
  gf("Josefin Sans", "clean", [300, 400, 500, 600, 700]),
  gf("Jost", "clean", [300, 400, 500, 600, 700, 800]),
  // ── Cute & round ───────────────────────────────────────────────────────────
  gf("Quicksand", "cute", [300, 400, 500, 600, 700]),
  gf("Comfortaa", "cute", [300, 400, 500, 600, 700]),
  gf("Fredoka", "cute", [300, 400, 500, 600, 700]),
  gf("Baloo 2", "cute", [400, 500, 600, 700, 800]),
  gf("Varela Round", "cute", [400]),
  gf("Chewy", "cute", [400], { fallback: "cursive" }),
  gf("Titan One", "cute", [400], { fallback: "cursive" }),
  gf("Luckiest Guy", "cute", [400], { fallback: "cursive" }),
  // ── Handwritten ────────────────────────────────────────────────────────────
  gf("Dancing Script", "handwritten", [400, 500, 600, 700], { fallback: "cursive" }),
  gf("Caveat", "handwritten", [400, 500, 600, 700], { fallback: "cursive" }),
  gf("Pacifico", "handwritten", [400], { fallback: "cursive" }),
  gf("Satisfy", "handwritten", [400], { fallback: "cursive" }),
  gf("Great Vibes", "handwritten", [400], { fallback: "cursive" }),
  gf("Sacramento", "handwritten", [400], { fallback: "cursive" }),
  gf("Shadows Into Light", "handwritten", [400], { fallback: "cursive" }),
  gf("Indie Flower", "handwritten", [400], { fallback: "cursive" }),
  gf("Patrick Hand", "handwritten", [400], { fallback: "cursive" }),
  gf("Gochi Hand", "handwritten", [400], { fallback: "cursive" }),
  gf("Kalam", "handwritten", [300, 400, 700], { fallback: "cursive" }),
  gf("Handlee", "handwritten", [400], { fallback: "cursive" }),
  gf("Gloria Hallelujah", "handwritten", [400], { fallback: "cursive" }),
  gf("Amatic SC", "handwritten", [400, 700], { fallback: "cursive" }),
  gf("Homemade Apple", "handwritten", [400], { fallback: "cursive" }),
  // ── Serif & fancy ──────────────────────────────────────────────────────────
  gf("Playfair", "serif", [400, 500, 600, 700, 800], { name: "Playfair Display", fallback: "serif" }),
  gf("Lora", "serif", [400, 500, 600, 700], { fallback: "serif" }),
  gf("Cormorant Garamond", "serif", [300, 400, 500, 600, 700], { fallback: "serif" }),
  gf("EB Garamond", "serif", [400, 500, 600, 700, 800], { fallback: "serif" }),
  gf("Libre Baskerville", "serif", [400, 700], { fallback: "serif" }),
  gf("Crimson Text", "serif", [400, 600, 700], { fallback: "serif" }),
  gf("DM Serif Display", "serif", [400], { fallback: "serif" }),
  gf("Abril Fatface", "serif", [400], { fallback: "serif" }),
  // ── Display & fun ──────────────────────────────────────────────────────────
  gf("Lobster", "display", [400], { fallback: "cursive" }),
  gf("Righteous", "display", [400], { fallback: "cursive" }),
  gf("Bungee", "display", [400], { fallback: "cursive" }),
  gf("Bangers", "display", [400], { fallback: "cursive" }),
  gf("Monoton", "display", [400], { fallback: "cursive" }),
  gf("Special Elite", "display", [400], { fallback: "cursive" }),
  gf("Fredericka the Great", "display", [400], { fallback: "cursive" }),
  gf("Creepster", "display", [400], { fallback: "cursive" }),
  // ── Retro & pixel ──────────────────────────────────────────────────────────
  gf("Space Mono", "retro", [400, 700], { fallback: "monospace" }),
  gf("IBM Plex Mono", "retro", [300, 400, 500, 600, 700], { fallback: "monospace" }),
  gf("Courier Prime", "retro", [400, 700], { fallback: "monospace" }),
  gf("VT323", "retro", [400], { fallback: "monospace" }),
  gf("Press Start 2P", "retro", [400], { fallback: "monospace" }),
  gf("Silkscreen", "retro", [400, 700], { fallback: "monospace" }),
  gf("Pixelify Sans", "retro", [400, 500, 600, 700], { fallback: "monospace" }),
];

export function fontOption(family: string | undefined): FontOption | undefined {
  return FONT_OPTIONS.find((f) => f.label === family);
}

/** Load a font by its FONT_OPTIONS label (no-op for System / unknown). */
export function loadFontByLabel(family: string | undefined) {
  const opt = fontOption(family);
  if (opt?.gfont) loadGoogleFont(opt.gfont);
}

/** Nearest weight this family actually ships (Google Fonts won't render missing ones). */
export function clampWeight(family: string | undefined, weight: number | undefined): number {
  if (!weight) return 400;
  const weights = fontOption(family)?.weights;
  if (!weights?.length) return weight;
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]);
}

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
  /** Mochi Plus exclusive. NEVER set this on a theme that already shipped free —
   *  Plus only ADDS new themes, it never paywalls existing ones. */
  plusOnly?: boolean;
}

// NOTE ON READABILITY: a theme's `font.color` is rendered on the profile-card
// overlay, which sits on a near-white translucent surface (rgba(255,255,255,0.84))
// regardless of how dark the page background is. So every `font.color` below is a
// deep, theme-tinted tone chosen to stay legible on that light card — even for the
// "night" themes whose backgrounds are dark. Keep new themes to dark font colors.
export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  // ── Soft pinks & florals ──────────────────────────────────────────────────
  {
    label: "Mochi",
    emoji: "🌸",
    bg: { type: "css", value: DEFAULT_SPACE_CONFIG.bg.value },
    font: { family: "Nunito", color: "#5b4769", size: 14 },
    lineColor: "#ff6b9d",
  },
  {
    label: "Cherry Blossom",
    emoji: "🌸",
    bg: { type: "css", value: "radial-gradient(circle at 30% 18%, #fff5f8 0%, #ffe0ec 45%, #ffd0e0 100%)" },
    font: { family: "Dancing Script", color: "#6b3a52", size: 16 },
    lineColor: "#ff8fab",
  },
  {
    label: "Peachy",
    emoji: "🍑",
    bg: { type: "css", value: "linear-gradient(160deg, #fff1e6 0%, #ffd9c0 55%, #ffc4d6 100%)" },
    font: { family: "Nunito", color: "#7a4332", size: 14 },
    lineColor: "#ff9a76",
  },
  {
    label: "Strawberry Milk",
    emoji: "🍓",
    bg: { type: "css", value: "linear-gradient(160deg, #fff0f4 0%, #ffd6e2 55%, #ffe9f0 100%)" },
    font: { family: "Nunito", color: "#7a3548", size: 14 },
    lineColor: "#ff7a9c",
  },
  {
    label: "Blush",
    emoji: "🌷",
    bg: { type: "css", value: "radial-gradient(circle at 70% 25%, #fff4f7 0%, #ffe2ec 50%, #f7d0de 100%)" },
    font: { family: "Dancing Script", color: "#6e3a4f", size: 16 },
    lineColor: "#f08eaf",
  },
  {
    label: "Bubblegum",
    emoji: "🍬",
    bg: { type: "gradient", c1: "#ffd6ec", c2: "#e4dcff", angle: 120 },
    font: { family: "Dancing Script", color: "#7a3b69", size: 16 },
    lineColor: "#ff6b9d",
  },
  // ── Warm & golden ─────────────────────────────────────────────────────────
  {
    label: "Rose Gold",
    emoji: "🌹",
    bg: { type: "css", value: "linear-gradient(160deg, #fcefe8 0%, #f3d4c8 55%, #f9dfe4 100%)" },
    font: { family: "Playfair", color: "#5e3636", size: 15 },
    lineColor: "#d99a86",
  },
  {
    label: "Sunset",
    emoji: "🌅",
    bg: { type: "css", value: "linear-gradient(160deg, #fff0e0 0%, #ffc9a3 45%, #ffb0c4 100%)" },
    font: { family: "Playfair", color: "#6b3a3a", size: 15 },
    lineColor: "#ff7e5f",
  },
  {
    label: "Honey",
    emoji: "🍯",
    bg: { type: "css", value: "linear-gradient(160deg, #fff6e0 0%, #ffe6ad 55%, #ffeccf 100%)" },
    font: { family: "Playfair", color: "#5c4422", size: 15 },
    lineColor: "#e0a92e",
  },
  {
    label: "Vanilla",
    emoji: "🍦",
    bg: { type: "css", value: "linear-gradient(160deg, #fdf8ee 0%, #f3e7cf 60%, #faf2e2 100%)" },
    font: { family: "Playfair", color: "#5a4b38", size: 15 },
    lineColor: "#c9a87a",
  },
  {
    label: "Cottagecore",
    emoji: "🍄",
    bg: { type: "gradient", c1: "#fef3c7", c2: "#d9f99d", angle: 160 },
    font: { family: "Playfair", color: "#4d3b2a", size: 15 },
    lineColor: "#a3a847",
  },
  {
    label: "Terracotta",
    emoji: "🏺",
    bg: { type: "css", value: "linear-gradient(160deg, #fbeee4 0%, #f0cdb4 55%, #f5d8c4 100%)" },
    font: { family: "Playfair", color: "#5c3424", size: 15 },
    lineColor: "#c2724a",
  },
  {
    label: "Citrus",
    emoji: "🍋",
    bg: { type: "css", value: "linear-gradient(160deg, #fbfbe0 0%, #eef0a8 55%, #e2f0c4 100%)" },
    font: { family: "Space Mono", color: "#4d4a1f", size: 13 },
    lineColor: "#bcae2c",
  },
  // ── Greens ────────────────────────────────────────────────────────────────
  {
    label: "Matcha",
    emoji: "🍵",
    bg: { type: "gradient", c1: "#d4f7dd", c2: "#fffde7", angle: 160 },
    font: { family: "Nunito", color: "#2f4a39", size: 14 },
    lineColor: "#6ee7b7",
  },
  {
    label: "Sage",
    emoji: "🌿",
    bg: { type: "css", value: "linear-gradient(155deg, #eef3e8 0%, #dbe7cf 60%, #eef0e0 100%)" },
    font: { family: "Lato", color: "#38463a", size: 14 },
    lineColor: "#8aa687",
  },
  {
    label: "Forest",
    emoji: "🌲",
    bg: { type: "css", value: "linear-gradient(165deg, #cfe6cf 0%, #9dc8a0 55%, #bfe0b8 100%)" },
    font: { family: "Lato", color: "#233a28", size: 14 },
    lineColor: "#4f9d69",
  },
  {
    label: "Seafoam",
    emoji: "🫧",
    bg: { type: "css", value: "linear-gradient(160deg, #e6f7f2 0%, #c2ece0 55%, #ddf3ec 100%)" },
    font: { family: "Nunito", color: "#244a44", size: 14 },
    lineColor: "#4cc4a8",
  },
  // ── Blues ─────────────────────────────────────────────────────────────────
  {
    label: "Coastal",
    emoji: "🌊",
    bg: { type: "css", value: "linear-gradient(165deg, #e3f4fb 0%, #c4e6f2 55%, #dff3ef 100%)" },
    font: { family: "Lato", color: "#1f3a4d", size: 14 },
    lineColor: "#4fa8c9",
  },
  {
    label: "Cloud 9",
    emoji: "☁️",
    bg: { type: "css", value: "linear-gradient(180deg, #f0f7ff 0%, #d6e9fb 60%, #eef5ff 100%)" },
    font: { family: "Nunito", color: "#3a4a5c", size: 14 },
    lineColor: "#7fb2e0",
  },
  {
    label: "Y2K",
    emoji: "💿",
    bg: { type: "gradient", c1: "#a8edea", c2: "#fed6e3", angle: 135 },
    font: { family: "Space Mono", color: "#1f2a44", size: 13 },
    lineColor: "#67d4f1",
  },
  // ── Purples ───────────────────────────────────────────────────────────────
  {
    label: "Periwinkle",
    emoji: "🪻",
    bg: { type: "css", value: "linear-gradient(165deg, #eef0ff 0%, #d6ddff 55%, #e8e4ff 100%)" },
    font: { family: "Nunito", color: "#3a3a6b", size: 14 },
    lineColor: "#8b9eff",
  },
  {
    label: "Lavender Haze",
    emoji: "💜",
    bg: { type: "css", value: "linear-gradient(160deg, #f3eefe 0%, #e4dcff 50%, #f8e8ff 100%)" },
    font: { family: "Nunito", color: "#4a3b6b", size: 14 },
    lineColor: "#a78bfa",
  },
  {
    label: "Ube",
    emoji: "🍠",
    bg: { type: "css", value: "linear-gradient(160deg, #f3e9fb 0%, #ddc4ef 55%, #ece0f7 100%)" },
    font: { family: "Nunito", color: "#4a2d5c", size: 14 },
    lineColor: "#b07dd6",
  },
  // ── Neutral & night ───────────────────────────────────────────────────────
  {
    label: "Minimal",
    emoji: "🤍",
    bg: { type: "solid", color: "#fafafa" },
    font: { family: "Lato", color: "#2b2b2b", size: 14 },
    lineColor: "#9ca3af",
  },
  {
    label: "Moonstone",
    emoji: "🌑",
    bg: { type: "css", value: "linear-gradient(160deg, #232a36 0%, #313b4d 55%, #3c4659 100%)" },
    font: { family: "Space Mono", color: "#2a3340", size: 13 },
    lineColor: "#8aa0b8",
  },
  {
    label: "Dark Academia",
    emoji: "📚",
    bg: { type: "gradient", c1: "#3b322c", c2: "#5c4a3a", angle: 160 },
    font: { family: "Playfair", color: "#4a3520", size: 15 },
    lineColor: "#c9a36b",
  },
  {
    label: "Cosmic",
    emoji: "🌌",
    bg: { type: "css", value: "linear-gradient(160deg, #1b1640 0%, #2d2363 55%, #3a2a6b 100%)" },
    font: { family: "Space Mono", color: "#2e2856", size: 13 },
    lineColor: "#9d7aff",
  },
  {
    label: "Midnight",
    emoji: "🌙",
    bg: { type: "gradient", c1: "#1e1b4b", c2: "#3b2f63", angle: 160 },
    font: { family: "Space Mono", color: "#2e2a55", size: 13 },
    lineColor: "#a78bfa",
  },
  // ── ♡ Mochi Plus exclusives (NEW — additive, never replace free themes) ──────
  {
    label: "Aurora",
    emoji: "🌌",
    bg: { type: "css", value: "linear-gradient(160deg, #e0fff4 0%, #c4e0ff 40%, #e8d6ff 75%, #ffe0f4 100%)" },
    font: { family: "Playfair", color: "#3a4a6b", size: 15 },
    lineColor: "#7ad6c4",
    plusOnly: true,
  },
  {
    label: "Starlight",
    emoji: "✨",
    bg: { type: "css", value: "radial-gradient(circle at 25% 15%, #fff6e8 0%, #f3e0c4 40%, #e8d0e8 100%)" },
    font: { family: "Dancing Script", color: "#5c4432", size: 16 },
    lineColor: "#e0b86b",
    plusOnly: true,
  },
  {
    label: "Sakura Night",
    emoji: "🌸",
    bg: { type: "css", value: "linear-gradient(160deg, #2a2440 0%, #4a3358 50%, #6b3a5c 100%)" },
    font: { family: "Playfair", color: "#5c3a52", size: 15 },
    lineColor: "#ff9ec4",
    plusOnly: true,
  },
  {
    label: "Opaline",
    emoji: "🐚",
    bg: { type: "css", value: "linear-gradient(160deg, #fdf0ff 0%, #e0f4ff 35%, #e8fff0 70%, #fff4e8 100%)" },
    font: { family: "Nunito", color: "#4a3b6b", size: 14 },
    lineColor: "#c4a8e8",
    plusOnly: true,
  },
];

export function parseSpaceConfig(wallpaper: string | null | undefined): SpaceConfig {
  const d = DEFAULT_SPACE_CONFIG;
  if (!wallpaper) return d;
  if (wallpaper.startsWith("{")) {
    try {
      const parsed = JSON.parse(wallpaper) as Partial<SpaceConfig>;
      const sections = Array.isArray(parsed.sections)
        ? parsed.sections.filter(
            (s): s is SpaceSection =>
              Boolean(s) && typeof s === "object" && typeof s.id === "string" && typeof s.type === "string",
          )
        : undefined;
      return {
        bg: { ...d.bg, ...(parsed.bg ?? {}) },
        font: { ...d.font, ...(parsed.font ?? {}) },
        audioLoop: parsed.audioLoop ?? d.audioLoop,
        lineColor: parsed.lineColor ?? d.lineColor,
        ...(sections ? { sections } : {}),
        ...(parsed.layout === "canvas" || parsed.layout === "sections" ? { layout: parsed.layout } : {}),
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
