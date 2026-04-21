export type Tool = "pen" | "eraser" | "sticker" | "washi" | "text" | "select";
export type AppTab = "studio" | "mail" | "store";
export type DeliverySpeed = "express" | "standard" | "slow";
export type SpaceItemType = "note" | "about" | "image" | "drawing";

export interface LetterSendPayload {
  receiverName: string;
  imageData: string;
  speed: DeliverySpeed;
  stampStyle: string;
  envelopeImageData?: string;
  envelopeName?: string;
  stampImageData?: string;
  stampName?: string;
}

export interface BrushSettings {
  color: string;
  size: number;
  tool: Tool;
  textSize?: number;
  textFont?: string;
}

export interface CustomFont {
  id: string;
  name: string;
  glyphs: Record<string, string>;
  glyphWidth: number;
  glyphHeight: number;
}

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Sticker {
  id: string;
  name: string;
  imageData: string;
  width: number;
  height: number;
  isAnimated?: boolean;
}

export interface WashiTape {
  id: string;
  name: string;
  imageData: string;
  opacity: number;
  width: number;
  height: number;
}

export interface PaperBackground {
  id: string;
  name: string;
  imageData: string;
  width: number;
  height: number;
}

export interface MailStamp {
  id: string;
  name: string;
  imageData: string;
  width: number;
  height: number;
}

export interface EnvelopeStyle {
  id: string;
  name: string;
  imageData: string;
  width: number;
  height: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  x: number;
  y: number;
  imageData: string;
  width: number;
  height: number;
  rotation: number;
  type: "sticker" | "washi" | "text";
  opacity: number;
  isAnimated?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textFont?: string;
}

export interface Letter {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  imageData: string; // the drawn letter as PNG data URL
  envelopeImageData?: string;
  envelopeName?: string;
  stampImageData?: string;
  stampName?: string;
  sentAt: number; // timestamp
  deliveryDuration: number; // ms
  deliverySpeed: DeliverySpeed;
  read: boolean;
  stampStyle: string; // emoji stamp
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  homeTitle: string;
  youtubeUrl: string;
  accentColor: string;
  wallpaper: string;
  createdAt: number;
}

export interface ViewerIdentity {
  id: string;
  name: string;
  isGuest: boolean;
  accountId?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  homeTitle?: string;
  youtubeUrl?: string;
  accentColor?: string;
  wallpaper?: string;
}

export interface SpaceItem {
  id: string;
  type: SpaceItemType;
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  imageUrl?: string;
}

export interface UserSpace {
  id: string;
  ownerId: string;
  ownerName: string;
  slug: string;
  title: string;
  tagline: string;
  aboutMe: string;
  avatarUrl: string;
  youtubeUrl: string;
  accentColor: string;
  wallpaper: string;
  items: SpaceItem[];
  updatedAt: number;
}

export interface StoreItem {
  id: string;
  name: string;
  imageData: string;
  type: "sticker" | "washi" | "background" | "font" | "stamp" | "envelope";
  authorName: string;
  authorId: string;
  downloads: number;
  createdAt: number;
  opacity?: number;
  width: number;
  height: number;
  tags: string[];
  fontData?: CustomFont;
}

export interface CanvasState {
  drawingData: ImageData | null;
  placedStickers: PlacedSticker[];
}

export const PASTEL_COLORS = [
  "#e8e0f0", // light
  "#ffffff", // white
  "#ff6b9d", // pink
  "#fb923c", // coral
  "#fbbf24", // amber
  "#a3e635", // lime
  "#6ee7b7", // mint
  "#67d4f1", // sky
  "#a78bfa", // lavender
  "#f0abfc", // orchid
  "#f87171", // red
  "#38bdf8", // blue
  "#2dd4bf", // teal
  "#e879f9", // fuchsia
  "#94a3b8", // slate
  "#1e1e2e", // dark
];

export const BRUSH_SIZES = [2, 4, 8, 14, 22, 32];

export const DELIVERY_SPEEDS: { id: DeliverySpeed; label: string; duration: number; emoji: string; description: string }[] = [
  { id: "express", label: "Express", duration: 1000 * 60 * 5, emoji: "⚡", description: "5 minutes" },
  { id: "standard", label: "Standard", duration: 1000 * 60 * 60, emoji: "✈️", description: "1 hour" },
  { id: "slow", label: "Snail Mail", duration: 1000 * 60 * 60 * 24, emoji: "🐌", description: "24 hours" },
];

export const STAMP_STYLES = ["💌", "💝", "🌸", "✨", "🎀", "🌙", "🍡", "🫧"];
