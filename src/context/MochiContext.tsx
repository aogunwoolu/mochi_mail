
import React, { createContext, useContext, type ReactNode } from "react";
import { useAccount } from "@/hooks/useAccount";
import { useAssets } from "@/hooks/useAssets";
import { useMail } from "@/hooks/useMail";
import { useStore } from "@/hooks/useStore";
import type {
  ViewerIdentity,
  Sticker,
  WashiTape,
  PaperBackground,
  MailStamp,
  EnvelopeStyle,
  CustomFont,
  PlacedSticker,
  Letter,
  StoreItem,
  DeliverySpeed,
  ScrapbookKit,
} from "@/types";

// ─── Shape ────────────────────────────────────────────────────────────────────

interface MochiAssets {
  stickers: Sticker[];
  washiTapes: WashiTape[];
  papers: PaperBackground[];
  stamps: MailStamp[];
  envelopes: EnvelopeStyle[];
  customFonts: CustomFont[];
  selectedPaper: PaperBackground | null;
  placedItems: PlacedSticker[];
  selectedAsset: Sticker | WashiTape | null;
  setSelectedPaper: React.Dispatch<React.SetStateAction<PaperBackground | null>>;
  setSelectedAsset: React.Dispatch<React.SetStateAction<Sticker | WashiTape | null>>;
  addSticker: (name: string, imageData: string, width: number, height: number) => Sticker;
  addWashiTape: (name: string, imageData: string, opacity: number, width: number, height: number) => WashiTape;
  addPaper: (name: string, imageData: string, width: number, height: number) => PaperBackground;
  addStamp: (name: string, imageData: string, width: number, height: number) => MailStamp;
  addEnvelope: (name: string, imageData: string, width: number, height: number) => EnvelopeStyle;
  addCustomFont: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => CustomFont;
  placeItem: (asset: Sticker | WashiTape, x: number, y: number, layerIndex?: number) => PlacedSticker;
  placeTextItem: (text: string, x: number, y: number, color: string, size: number, font: string, layerIndex?: number) => PlacedSticker;
  applySharedCanvasState: (state: { placedItems?: PlacedSticker[]; selectedPaper?: PaperBackground | null }) => void;
  shiftPlacedItems: (dx: number, dy: number) => void;
  updatePlacedItem: (id: string, updates: Partial<PlacedSticker>) => void;
  removePlacedItem: (id: string) => void;
  removeAnimatedSticker: (id: string) => void;
  removeSticker: (id: string) => void;
  removeWashiTape: (id: string) => void;
  removePaper: (id: string) => void;
  removeStamp: (id: string) => void;
  removeEnvelope: (id: string) => void;
  removeCustomFont: (id: string) => void;
  kitLibrary: ScrapbookKit[];
  addKitToLibrary: (kit: ScrapbookKit) => ScrapbookKit;
  removeKit: (id: string) => void;
  saveBoardState: (drawingData: string | null, items: PlacedSticker[], paper: PaperBackground | null, roomId?: string | null) => Promise<void>;
  loadBoardState: (roomId?: string | null) => Promise<{ drawingData: string | null; placedItems: PlacedSticker[]; selectedPaper: PaperBackground | null } | null | undefined>;
  /** Add a store item directly into the asset library. */
  equipFromStore: (item: StoreItem) => void;
}

interface MochiMail {
  user: ViewerIdentity & { name: string };
  letters: Letter[];
  inbox: Letter[];
  sent: Letter[];
  sendLetter: (payload: {
    receiverName: string;
    imageData: string;
    speed: DeliverySpeed;
    stampStyle: string;
    envelopeImageData?: string;
    envelopeName?: string;
    stampImageData?: string;
    stampName?: string;
  }) => Letter;
  isDelivered: (letter: Letter) => boolean;
  getDeliveryProgress: (letter: Letter) => number;
  getTimeRemaining: (letter: Letter) => string;
  markAsRead: (letterId: string) => void;
}

interface MochiStore {
  storeItems: StoreItem[];
  allStoreItems: StoreItem[];
  filterType: StoreItem["type"] | "all";
  setFilterType: (t: StoreItem["type"] | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isInCollection: (id: string) => boolean;
  addToCollection: (id: string) => void;
  removeFromCollection: (id: string) => void;
  publishToStore: (
    item: Sticker | WashiTape | PaperBackground | CustomFont | MailStamp | EnvelopeStyle,
    type: StoreItem["type"],
    authorName: string,
    authorId: string,
    tags: string[]
  ) => void;
  publishKitToStore: (kit: ScrapbookKit, authorName: string, authorId: string, tags?: string[]) => StoreItem;
  removeFromStore: (id: string) => void;
  updateStoreItem: (id: string, updates: Partial<Pick<StoreItem, "name" | "tags">>) => void;
}

interface MochiAccountMethods {
  viewer: ViewerIdentity;
  currentAccount: ReturnType<typeof useAccount>["currentAccount"];
  hasSession: boolean;
  isAuthenticated: boolean;
  hydrated: boolean;
  accountLabel: string;
  identityMode: string;
  identityHelp: string | null;
  signUp: (username: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  logIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logOut: () => Promise<void>;
  renameGuest: (name: string) => void;
  updateAccount: (patch: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    accentColor?: string;
    wallpaper?: string;
    youtubeUrl?: string;
    homeTitle?: string;
  }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string | null>;
}

interface MochiContextValue {
  account: MochiAccountMethods;
  assets: MochiAssets;
  mail: MochiMail;
  store: MochiStore;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MochiContext = createContext<MochiContextValue | null>(null);

export function useMochi(): MochiContextValue {
  const ctx = useContext(MochiContext);
  if (!ctx) throw new Error("useMochi must be used inside <MochiProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MochiProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const assets = useAssets(account.viewer);
  const mail = useMail(account.viewer);
  const store = useStore(account.viewer);

  const equipFromStore = (item: StoreItem) => {
    if (item.type === "sticker") {
      assets.addSticker(item.name, item.imageData, item.width, item.height, item.isAnimated ?? item.imageData.startsWith("data:image/gif"));
    } else if (item.type === "washi") {
      assets.addWashiTape(item.name, item.imageData, item.opacity ?? 0.7, item.width, item.height);
    } else if (item.type === "background") {
      const paper = assets.addPaper(item.name, item.imageData, item.width, item.height);
      assets.setSelectedPaper(paper);
    } else if (item.type === "stamp") {
      assets.addStamp(item.name, item.imageData, item.width, item.height);
    } else if (item.type === "envelope") {
      assets.addEnvelope(item.name, item.imageData, item.width, item.height);
    } else if (item.type === "font" && item.fontData) {
      assets.addCustomFont(
        item.fontData.name,
        item.fontData.glyphs,
        item.fontData.glyphWidth,
        item.fontData.glyphHeight
      );
    }
  };

  const value: MochiContextValue = {
    account: {
      viewer: account.viewer,
      currentAccount: account.currentAccount,
      hasSession: account.hasSession,
      isAuthenticated: account.isAuthenticated,
      hydrated: account.hydrated,
      accountLabel: account.accountLabel,
      identityMode: account.identityMode,
      identityHelp: account.identityHelp,
      signUp: account.signUp,
      logIn: account.logIn,
      logOut: account.logOut,
      renameGuest: account.renameGuest,
      updateAccount: account.updateAccount,
      uploadAvatar: account.uploadAvatar,
    },
    assets: {
      ...assets,
      equipFromStore,
    },
    mail,
    store: {
      ...store,
    },
  };

  return <MochiContext.Provider value={value}>{children}</MochiContext.Provider>;
}
