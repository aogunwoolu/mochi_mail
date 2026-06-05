
"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import AccountPanel from "@/components/AccountPanel";
import DrawingCanvas, { DrawingCanvasHandle } from "@/components/DrawingCanvas";
import LayerPanel from "@/components/LayerPanel";
import StudioToolbar from "@/components/StudioToolbar";
import MailComposePanel from "@/components/MailComposePanel";
import MailboxPanel from "@/components/MailboxPanel";
import StoreView from "@/components/StoreView";
import RoomControl from "@/components/RoomControl";
import { AppHeader } from "@/components/AppHeader";
import { FiEdit3, FiLayers, FiMail, FiShoppingBag, FiUsers } from "react-icons/fi";
import { Pencil, Eraser, MousePointer, Type, Scissors, Image, Sparkles } from "lucide-react";
import { exportCanvas, CropRegion, StaticFormat } from "@/components/ExportUtil";
import ExportModal from "@/components/ExportModal";
import CanvasRegionSelector from "@/components/CanvasRegionSelector";
import { toast } from "@/lib/toast";
import { useRoom } from "@/hooks/useRoom";
import type { RoomMember } from "@/hooks/useRoom";
import { useStrokeSync } from "@/hooks/useStrokeSync";
import type { SyncStroke } from "@/hooks/useStrokeSync";
import { useMochi } from "@/context/MochiContext";
import {
  AppTab,
  BrushSettings,
  CustomFont,
  EnvelopeStyle,
  MailStamp,
  PaperBackground,
  PlacedSticker,
  Sticker,
  WashiTape,
  StoreItem,
} from "@/types";
import { useIdentify, useStudioAnalytics, useMailAnalytics, useStoreAnalytics } from "@/hooks/useAnalytics";
import { LAYER_CEILING } from "@/lib/plus";

const CANVAS_W = 6000;
const CANVAS_H = 4800;

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>("studio");
  const [mailView, setMailView] = useState<"inbox" | "compose">("inbox");
  const [accountOpen, setAccountOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [selfArtistId] = useState(() => {
    if (!globalThis.window) return "";
    const saved = sessionStorage.getItem("mochimail_artist_id");
    const id =
      saved ??
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("mochimail_artist_id", id);
    return id;
  });

  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const studioScrollRef = useRef<HTMLDivElement>(null);
  const worldOffsetRef = useRef({ x: 0, y: 0 });
  const [worldOffset, setWorldOffset] = useState({ x: 0, y: 0 });
  const hasCenteredRef = useRef(false);
  const selfIdRef = useRef(selfArtistId);
  const remoteStrokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastMouseWorldRef = useRef<{ x: number; y: number } | null>(null);

  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    color: "#1e1e2e",
    size: 4,
    tool: "pen",
    textSize: 34,
    textFont: '"Space Mono", monospace',
  });

  const { account, assets, mail, store, supporter } = useMochi();
  // Mochi Plus raises the studio layer ceiling; free stays at its current value.
  const maxLayers = supporter.perks.maxLayers;

  // Gentle thank-you when returning from Stripe Checkout (?support=thanks).
  const refreshSupporter = supporter.refresh;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const support = params.get("support");
    if (!support) return;
    if (support === "thanks") {
      toast("Thank you for supporting Mochi! 💛", { icon: "star" });
      void refreshSupporter();
    }
    params.delete("support");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [refreshSupporter]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  useIdentify(account.viewer.accountId ?? account.viewer.id, {
    name: account.viewer.name,
    username: account.viewer.username,
    isGuest: !account.isAuthenticated,
  });
  const { trackToolSwitch, trackStickerPlaced, trackWashiPlaced, trackCanvasExport, trackTabChange } = useStudioAnalytics();
  const { trackMailSent, trackMailComposeFocus } = useMailAnalytics();
  const { trackItemAdded, trackItemPublished } = useStoreAnalytics();
  const {
    stickers,
    washiTapes,
    papers,
    stamps,
    envelopes,
    customFonts,
    selectedPaper,
    placedItems,
    selectedAsset,
    setSelectedPaper,
    setSelectedAsset,
    addSticker,
    addWashiTape,
    addPaper,
    addStamp,
    addEnvelope,
    addCustomFont,
    placeItem,
    placeTextItem,
    applySharedCanvasState,
    shiftPlacedItems,
    updatePlacedItem,
    removePlacedItem,
    removeSticker,
    removeWashiTape,
    removePaper,
    removeStamp,
    removeEnvelope,
    removeCustomFont,
    saveBoardState,
    loadBoardState,
    equipFromStore,
  } = assets;

  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);

  const {
    phase: roomPhase,
    activeRoomId,
    isPublic: roomIsPublic,
    hasPassword: roomHasPassword,
    isOwner: roomIsOwner,
    collabScope,
    members: roomMembers,
    trackCursor,
    selfColor,
    error: roomError,
    setRoomPublic,
    setRoomPassword,
  } = useRoom({
    hasSession: account.hasSession,
    hydrated: account.hydrated,
    selfId: selfArtistId,
    selfName: mail.user.name,
    viewerAccountId: account.viewer.accountId,
    selfAvatarUrl: account.viewer.avatarUrl,
    selfUsername: account.viewer.username,
  });

  useEffect(() => {
    selfIdRef.current = selfArtistId;
  }, [selfArtistId]);

  const handleRemotePlacedItemAdd = useCallback(
    (item: PlacedSticker) => applySharedCanvasState({ placedItems: [...placedItems, item] }),
    [applySharedCanvasState, placedItems],
  );
  const handleRemotePlacedItemRemove = useCallback(
    (itemId: string) =>
      applySharedCanvasState({ placedItems: placedItems.filter((p) => p.id !== itemId) }),
    [applySharedCanvasState, placedItems],
  );
  const {
    broadcastStroke,
    saveStroke,
    deleteStroke,
    restoreStroke,
    broadcastPlacedItemAdd,
    broadcastPlacedItemRemove,
    remoteCompletedStrokes,
    dbStrokes,
    clearDbStrokes,
  } = useStrokeSync({
    hasSession: account.hasSession,
    collabScope,
    activeRoomId,
    selfIdRef,
    canvasRef,
    remoteStrokeCanvasRef,
    placedItems,
    selectedPaper,
    applySharedCanvasState,
    onRemotePlacedItemAdd: handleRemotePlacedItemAdd,
    onRemotePlacedItemRemove: handleRemotePlacedItemRemove,
    saveBoardState,
    loadBoardState,
  });

  const handleStrokeUpdate = useCallback(
    (
      strokeId: string,
      pts: [number, number, number][],
      color: string,
      size: number,
      tool: "pen" | "eraser",
      isLast: boolean,
      layerIndex: number,
    ) => {
      broadcastStroke(strokeId, pts, color, size, tool, isLast, layerIndex);
    },
    [broadcastStroke],
  );

  const handleStrokeComplete = useCallback(
    (
      strokeId: string,
      pts: [number, number, number][],
      color: string,
      size: number,
      tool: "pen" | "eraser",
      layerIndex: number,
    ) => {
      void saveStroke(strokeId, pts, color, size, tool, layerIndex);
    },
    [saveStroke],
  );

  const handleUndoStroke = useCallback(
    (strokeId: string) => {
      void deleteStroke(strokeId);
    },
    [deleteStroke],
  );

  const handleRedoStroke = useCallback(
    (stroke: SyncStroke) => {
      void restoreStroke(stroke);
    },
    [restoreStroke],
  );

  const handlePlaceAsset = useCallback(
    (asset: Sticker | WashiTape, x: number, y: number, layerIndex?: number) => {
      const placed = placeItem(asset, x, y, layerIndex);
      if (placed) broadcastPlacedItemAdd(placed);
      if ("opacity" in asset) trackWashiPlaced(asset.name);
      else trackStickerPlaced(asset.name);
    },
    [placeItem, broadcastPlacedItemAdd, trackStickerPlaced, trackWashiPlaced],
  );

  const handleRemovePlacedItem = useCallback(
    (id: string) => {
      removePlacedItem(id);
      broadcastPlacedItemRemove(id);
    },
    [removePlacedItem, broadcastPlacedItemRemove],
  );

  const handleBrushChange = useCallback((update: Partial<BrushSettings>) => {
    setBrushSettings((prev) => ({ ...prev, ...update }));
  }, []);

  const handleSelectSticker = useCallback(
    (s: Sticker) => {
      setSelectedAsset(s);
      setBrushSettings((prev) => ({ ...prev, tool: "sticker" }));
      toast(`${s.name} selected — click to place!`, { icon: "sticker" });
    },
    [setSelectedAsset],
  );

  const handleSelectWashi = useCallback(
    (w: WashiTape) => {
      setSelectedAsset(w);
      setBrushSettings((prev) => ({ ...prev, tool: "washi" }));
      toast(`${w.name} selected — click to place!`, { icon: "ribbon" });
    },
    [setSelectedAsset],
  );

  const handleDeselectAsset = useCallback(
    () => setSelectedAsset(null),
    [setSelectedAsset],
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectingRegion, setSelectingRegion] = useState(false);
  const [staticFormat, setStaticFormat] = useState<StaticFormat>("png");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  // layerOrder maps display position (0=back, last=front) → stable layer id.
  // Items/strokes carry the stable id in `layerIndex`; reordering only mutates this array.
  const [layerOrder, setLayerOrder] = useState<number[]>([0]);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<number[]>([]);
  const [activeLayer, setActiveLayer] = useState(0);
  const layerCount = layerOrder.length;

  // When loaded data arrives (DB strokes or placed items), ensure every referenced
  // layer id is present in layerOrder so its content is visible.
  useEffect(() => {
    const referenced = new Set<number>();
    for (const s of dbStrokes) referenced.add(s.layerIndex ?? 0);
    for (const i of placedItems) referenced.add(i.layerIndex ?? 0);
    setLayerOrder((prev) => {
      const present = new Set(prev);
      // Restore any layer that has content up to the absolute ceiling, so a
      // lapsed member's extra layers are always shown (never destroyed) even if
      // their current entitlement is lower.
      const missing = [...referenced].filter((id) => !present.has(id) && id >= 0 && id < LAYER_CEILING).sort((a, b) => a - b);
      if (!missing.length) return prev;
      return [...prev, ...missing];
    });
  }, [dbStrokes, placedItems]);

  const handleAddLayer = useCallback(() => {
    setLayerOrder((prev) => {
      if (prev.length >= maxLayers) return prev;
      for (let id = 0; id < maxLayers; id++) {
        if (!prev.includes(id)) return [...prev, id];
      }
      return prev;
    });
  }, [maxLayers]);

  const handleMoveLayerUp = useCallback((layerId: number) => {
    setLayerOrder((prev) => {
      const i = prev.indexOf(layerId);
      if (i < 0 || i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
      return next;
    });
  }, []);

  const handleMoveLayerDown = useCallback((layerId: number) => {
    setLayerOrder((prev) => {
      const i = prev.indexOf(layerId);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
      return next;
    });
  }, []);

  const handleToggleLayerVisibility = useCallback((layerId: number) => {
    setHiddenLayerIds((prev) =>
      prev.includes(layerId) ? prev.filter((x) => x !== layerId) : [...prev, layerId],
    );
  }, []);


  const runExport = useCallback((cropRegion?: CropRegion) => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);
    setExportModalOpen(false);
    exportCanvas(canvasRef.current, placedItems, "mochimail_letter", 3000, cropRegion, staticFormat)
      .then(() => toast("Canvas saved!", { icon: "save" }))
      .catch(() => toast("Export failed — try again", { variant: "error", icon: "warning" }))
      .finally(() => setIsExporting(false));
    trackCanvasExport();
  }, [placedItems, isExporting, trackCanvasExport]);

  const handleExport = useCallback(() => {
    if (isExporting) return;
    setExportModalOpen(true);
  }, [isExporting]);

  const handleExportWhole = useCallback(() => {
    runExport();
  }, [runExport]);

  const handleSelectRegion = useCallback(() => {
    setExportModalOpen(false);
    setSelectingRegion(true);
  }, []);

  const handleRegionConfirm = useCallback((region: CropRegion) => {
    setSelectingRegion(false);
    runExport(region);
  }, [runExport]);

  const handleStoreAddToAssets = useCallback(
    (item: StoreItem) => {
      if (item.type === "sticker")
        addSticker(item.name, item.imageData, item.width, item.height);
      else if (item.type === "washi")
        addWashiTape(item.name, item.imageData, item.opacity ?? 0.7, item.width, item.height);
      else if (item.type === "background") {
        const paper = addPaper(item.name, item.imageData, item.width, item.height);
        setSelectedPaper(paper);
      } else if (item.type === "stamp")
        addStamp(item.name, item.imageData, item.width, item.height);
      else if (item.type === "envelope")
        addEnvelope(item.name, item.imageData, item.width, item.height);
      else if (item.type === "font" && item.fontData)
        addCustomFont(
          item.fontData.name,
          item.fontData.glyphs,
          item.fontData.glyphWidth,
          item.fontData.glyphHeight,
        );
      trackItemAdded(item.id, item.type, item.name);
      toast(`${item.name} added to your assets!`, { icon: "sparkle" });
    },
    [addSticker, addWashiTape, addPaper, addStamp, addEnvelope, addCustomFont, setSelectedPaper, trackItemAdded],
  );

  const handleStorePublish = useCallback(
    (
      item: Sticker | WashiTape | PaperBackground | CustomFont | MailStamp | EnvelopeStyle,
      itemType: StoreItem["type"],
      tags: string[],
    ) => {
      store.publishToStore(
        item,
        itemType,
        account.viewer.name,
        account.viewer.accountId ?? account.viewer.id,
        tags,
      );
      trackItemPublished(itemType, item.name);
      toast(`${item.name} published to the shop!`, { icon: "store" });
    },
    [account.viewer, store, trackItemPublished],
  );

  // ── Canvas zoom (Ctrl+wheel / pinch) ─────────────────────────────────────
  const zoomStateRef = useRef({ current: 1, target: 1, isAnimating: false });
  const canvasWorldRef = useRef<HTMLDivElement>(null);
  const canvasOuterRef = useRef<HTMLDivElement>(null);
  const zoomRafRef = useRef<number | null>(null);
  const momentumVelRef = useRef({ x: 0, y: 0 });
  const momentumRafRef = useRef<number | null>(null);
  const zoomDisplayThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPinchRef = useRef<{
    scaleDelta: number; prevCx: number; prevCy: number; cx: number; cy: number;
  } | null>(null);
  const pinchRafRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);

  /**
   * Apply zoom + optional pan in one atomic DOM update.
   *
   * prevCx/prevCy = the screen point that should remain visible (old centroid).
   * cx/cy         = where that world-point should appear after the transform (new centroid).
   * For button-zoom (no pan) pass the same value for both pairs.
   *
   * Formula:  S_new = focal * Z_new - vx_new
   * where focal = (S_old + vx_prev) / Z_old  (world coord under old centroid)
   */
  const applyZoomTransform = useCallback((
    zoom: number,
    cx?: number, cy?: number,
    prevCx?: number, prevCy?: number,
  ) => {
    const worldEl = canvasWorldRef.current;
    const outerEl = canvasOuterRef.current;
    const scrollEl = studioScrollRef.current;
    if (!worldEl || !outerEl || !scrollEl) return;

    let newScrollLeft = scrollEl.scrollLeft;
    let newScrollTop  = scrollEl.scrollTop;

    if (cx !== undefined && cy !== undefined) {
      const rect     = scrollEl.getBoundingClientRect();
      const vx       = cx      - rect.left;
      const vy       = cy      - rect.top;
      const vxPrev   = (prevCx ?? cx) - rect.left;
      const vyPrev   = (prevCy ?? cy) - rect.top;
      const prevZoom = zoomStateRef.current.current;

      // World point that was under the previous centroid
      const focalX = (scrollEl.scrollLeft + vxPrev) / prevZoom;
      const focalY = (scrollEl.scrollTop  + vyPrev) / prevZoom;

      // Place that world point under the new centroid
      newScrollLeft = focalX * zoom - vx;
      newScrollTop  = focalY * zoom - vy;
    }

    worldEl.style.transform = `scale(${zoom})`;
    worldEl.style.transformOrigin = "top left";
    outerEl.style.width  = `${CANVAS_W * zoom}px`;
    outerEl.style.height = `${CANVAS_H * zoom}px`;

    if (cx !== undefined && cy !== undefined) {
      const maxLeft = Math.max(0, CANVAS_W * zoom - scrollEl.clientWidth);
      const maxTop  = Math.max(0, CANVAS_H * zoom - scrollEl.clientHeight);
      scrollEl.scrollLeft = Math.max(0, Math.min(maxLeft, newScrollLeft));
      scrollEl.scrollTop  = Math.max(0, Math.min(maxTop,  newScrollTop));
    }
  }, []);

  // Smooth zoom animation with RAF
  const animateZoom = useCallback(() => {
    const state = zoomStateRef.current;
    if (!state.isAnimating) return;
    
    const diff = state.target - state.current;
    if (Math.abs(diff) < 0.001) {
      state.current = state.target;
      state.isAnimating = false;
      applyZoomTransform(state.current);
      setCanvasZoom(state.current); // Sync to React state after animation
      zoomRafRef.current = null;
      return;
    }
    
    // Smooth lerp for natural feel
    state.current += diff * 0.15;
    applyZoomTransform(state.current);
    zoomRafRef.current = requestAnimationFrame(animateZoom);
  }, [applyZoomTransform]);

  // Programmatic zoom setter with smooth animation
  const setZoomSmooth = useCallback((targetZoom: number, centerX?: number, centerY?: number) => {
    const clamped = Math.min(3, Math.max(0.25, targetZoom));
    zoomStateRef.current.target = clamped;
    
    if (!zoomStateRef.current.isAnimating) {
      zoomStateRef.current.isAnimating = true;
      zoomRafRef.current = requestAnimationFrame(animateZoom);
    }
    
    // If center point provided, adjust scroll to keep it stable
    if (centerX !== undefined && centerY !== undefined) {
      const scrollEl = studioScrollRef.current;
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect();
        const viewportX = centerX - rect.left;
        const viewportY = centerY - rect.top;
        const focalWorldX = (scrollEl.scrollLeft + viewportX) / zoomStateRef.current.current;
        const focalWorldY = (scrollEl.scrollTop + viewportY) / zoomStateRef.current.current;
        // Defer scroll adjustment to after zoom animation
        requestAnimationFrame(() => {
          scrollEl.scrollLeft = focalWorldX * clamped - viewportX;
          scrollEl.scrollTop = focalWorldY * clamped - viewportY;
        });
      }
    }
  }, [animateZoom]);

  // Zoom in/out buttons
  const zoomIn = useCallback(() => {
    setZoomSmooth(zoomStateRef.current.target * 1.2);
  }, [setZoomSmooth]);
  
  const zoomOut = useCallback(() => {
    setZoomSmooth(zoomStateRef.current.target * 0.8);
  }, [setZoomSmooth]);
  
  const zoomReset = useCallback(() => {
    setZoomSmooth(1);
  }, [setZoomSmooth]);

  const startMomentum = useCallback((velX: number, velY: number) => {
    isPinchingRef.current = false;
    // Sync scroll position back to React state now that the gesture is done
    const syncEl = studioScrollRef.current;
    if (syncEl) setScrollPos({ left: syncEl.scrollLeft, top: syncEl.scrollTop });
    if (momentumRafRef.current) cancelAnimationFrame(momentumRafRef.current);
    momentumVelRef.current = { x: -velX, y: -velY };
    const DECAY = 0.93;
    const MIN_VEL = 0.4;
    const tick = () => {
      const el = studioScrollRef.current;
      if (!el) { momentumRafRef.current = null; return; }
      const { x, y } = momentumVelRef.current;
      if (Math.abs(x) < MIN_VEL && Math.abs(y) < MIN_VEL) {
        momentumRafRef.current = null;
        return;
      }
      const zoom = zoomStateRef.current.current;
      const maxLeft = Math.max(0, CANVAS_W * zoom - el.clientWidth);
      const maxTop  = Math.max(0, CANVAS_H * zoom - el.clientHeight);
      el.scrollLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + x));
      el.scrollTop  = Math.max(0, Math.min(maxTop,  el.scrollTop  + y));
      momentumVelRef.current = { x: x * DECAY, y: y * DECAY };
      momentumRafRef.current = requestAnimationFrame(tick);
    };
    momentumRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (activeTab !== "studio") return;
    const el = studioScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // Stop any ongoing inertia — user is actively zooming
      if (momentumRafRef.current) { cancelAnimationFrame(momentumRafRef.current); momentumRafRef.current = null; }
      // Normalize pixel vs line delta; clamp to cap per-event zoom jumps
      const raw = e.deltaMode === 1 ? e.deltaY * 8 : e.deltaY;
      const delta = Math.max(-80, Math.min(80, raw));
      // Exponential scale: symmetric (zoom in 3× then out 3× = identity) and feels natural
      const factor = Math.exp(-delta * 0.004);
      const newZoom = Math.min(3, Math.max(0.25, zoomStateRef.current.current * factor));
      applyZoomTransform(newZoom, e.clientX, e.clientY, e.clientX, e.clientY);
      zoomStateRef.current.current = newZoom;
      zoomStateRef.current.target = newZoom;
      zoomStateRef.current.isAnimating = false;
      // Throttle React re-render — only used for the display %, doesn't affect rendering
      if (!zoomDisplayThrottleRef.current) {
        zoomDisplayThrottleRef.current = setTimeout(() => {
          setCanvasZoom(zoomStateRef.current.current);
          zoomDisplayThrottleRef.current = null;
        }, 80);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
      if (momentumRafRef.current) { cancelAnimationFrame(momentumRafRef.current); momentumRafRef.current = null; }
      if (pinchRafRef.current) { cancelAnimationFrame(pinchRafRef.current); pinchRafRef.current = null; }
      if (zoomDisplayThrottleRef.current) { clearTimeout(zoomDisplayThrottleRef.current); zoomDisplayThrottleRef.current = null; }
      isPinchingRef.current = false;
      pendingPinchRef.current = null;
      el.removeEventListener("wheel", onWheel);
    };
  }, [activeTab, applyZoomTransform]);

  // ── Infinite canvas scroll ────────────────────────────────────────────────

  const getViewportCenterWorld = useCallback(() => {
    const el = studioScrollRef.current;
    if (!el) return { x: worldOffsetRef.current.x, y: worldOffsetRef.current.y };
    return {
      x: el.scrollLeft + el.clientWidth / 2 + worldOffsetRef.current.x,
      y: el.scrollTop + el.clientHeight / 2 + worldOffsetRef.current.y,
    };
  }, []);

  const jumpToMember = useCallback((member: RoomMember) => {
    const el = studioScrollRef.current;
    if (!el) return;
    const maxLeft = Math.max(0, CANVAS_W - el.clientWidth);
    const maxTop = Math.max(0, CANVAS_H - el.clientHeight);
    el.scrollTo({
      left: Math.max(
        0,
        Math.min(maxLeft, member.x - worldOffsetRef.current.x - el.clientWidth / 2),
      ),
      top: Math.max(
        0,
        Math.min(maxTop, member.y - worldOffsetRef.current.y - el.clientHeight / 2),
      ),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "studio") return;
    const el = studioScrollRef.current;
    if (!el) return;

    if (!hasCenteredRef.current) {
      el.scrollTo({
        left: Math.max(0, Math.floor((CANVAS_W - el.clientWidth) / 2)),
        top: Math.max(0, Math.floor((CANVAS_H - el.clientHeight) / 2)),
        behavior: "auto",
      });
      hasCenteredRef.current = true;
    }

    const thresholdX = Math.max(220, Math.floor(el.clientWidth * 0.2));
    const thresholdY = Math.max(220, Math.floor(el.clientHeight * 0.2));
    const centerLeft = Math.max(0, Math.floor((CANVAS_W - el.clientWidth) / 2));
    const centerTop = Math.max(0, Math.floor((CANVAS_H - el.clientHeight) / 2));

    const onScroll = () => {
      // Skip during active pinch — scroll is set programmatically every frame
      if (isPinchingRef.current) return;
      const maxLeft = Math.max(0, CANVAS_W - el.clientWidth);
      const maxTop = Math.max(0, CANVAS_H - el.clientHeight);
      let dx = 0;
      let dy = 0;
      // shiftContent math uses unzoomed CANVAS_W — only valid at 1:1 zoom.
      // At any other zoom level the scroll range is CANVAS_W*zoom, so the thresholds
      // fire at the wrong scroll positions and shift pixel data into the wrong location.
      const atNativeZoom = Math.abs(zoomStateRef.current.current - 1) < 0.01;
      if (atNativeZoom) {
        if (el.scrollLeft < thresholdX || el.scrollLeft > maxLeft - thresholdX)
          dx = centerLeft - el.scrollLeft;
        if (el.scrollTop < thresholdY || el.scrollTop > maxTop - thresholdY)
          dy = centerTop - el.scrollTop;
      }

      if (dx !== 0 || dy !== 0) {
        canvasRef.current?.shiftContent(dx, dy);
        shiftPlacedItems(dx, dy);
        const nextOffset = {
          x: worldOffsetRef.current.x - dx,
          y: worldOffsetRef.current.y - dy,
        };
        worldOffsetRef.current = nextOffset;
        setWorldOffset(nextOffset);
        el.scrollLeft += dx;
        el.scrollTop += dy;
      }

      setScrollPos({ left: el.scrollLeft, top: el.scrollTop });
      trackCursor(lastMouseWorldRef.current ?? getViewportCenterWorld(), activeLayer, brushSettings.tool);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      lastMouseWorldRef.current = {
        x: el.scrollLeft + e.clientX - rect.left + worldOffsetRef.current.x,
        y: el.scrollTop + e.clientY - rect.top + worldOffsetRef.current.y,
      };
      trackCursor(lastMouseWorldRef.current, activeLayer, brushSettings.tool);
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      lastMouseWorldRef.current = {
        x: el.scrollLeft + touch.clientX - rect.left + worldOffsetRef.current.x,
        y: el.scrollTop + touch.clientY - rect.top + worldOffsetRef.current.y,
      };
      trackCursor(lastMouseWorldRef.current, activeLayer, brushSettings.tool);
    };

    const updateViewSize = () =>
      setViewSize({ w: el.clientWidth, h: el.clientHeight });
    updateViewSize();
    setScrollPos({ left: el.scrollLeft, top: el.scrollTop });

    const ro = new ResizeObserver(updateViewSize);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousemove", onMouseMove, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("mouseleave", () => {
      lastMouseWorldRef.current = null;
    });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [activeTab, trackCursor, shiftPlacedItems, getViewportCenterWorld]);

  // Broadcast tool/layer changes immediately (not just on cursor move)
  useEffect(() => {
    if (lastMouseWorldRef.current) {
      trackCursor(lastMouseWorldRef.current, activeLayer, brushSettings.tool);
    }
  }, [brushSettings.tool, activeLayer, trackCursor]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    if (activeTab !== "studio") return;
    
    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            zoomIn();
            break;
          case "-":
          case "_":
            e.preventDefault();
            zoomOut();
            break;
          case "0":
            e.preventDefault();
            zoomReset();
            break;
        }
      }
    };
    
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, zoomIn, zoomOut, zoomReset]);

  const remoteArtists = roomMembers.filter((m) => m.presenceKey !== selfArtistId);
  const artistList = mounted
    ? [
        {
          id: selfArtistId,
          name: mail.user.name,
          color: selfColor,
          avatarUrl: account.viewer.avatarUrl,
          username: account.viewer.username,
          x: 0,
          y: 0,
        },
        ...remoteArtists.map((m) => ({
          id: m.presenceKey,
          name: m.name,
          color: m.color,
          avatarUrl: m.avatarUrl,
          username: m.username,
          x: m.x,
          y: m.y,
        })),
      ]
    : [];

  const unreadCount = mail.inbox.filter((l) => !l.read && mail.isDelivered(l)).length;

  // ── Render ───────────────────────────────────────────────────────────────

  const isStudio = activeTab === "studio";

  return (
    <div className="relative z-10 flex h-svh flex-col overflow-hidden">
      {/* Header — hidden on studio (full-screen canvas) */}
      {!isStudio && (
        <AppHeader
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); trackTabChange(tab); }}
          unreadCount={unreadCount}
          onAccountClick={() => setAccountOpen((p) => !p)}
          accountName={account.viewer.name}
          accountAvatarUrl={account.viewer.avatarUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(account.viewer.name || "mochimail")}`}
          accountAccentColor={account.viewer.accentColor ?? null}
          accountHydrated={account.hydrated}
        />
      )}

      {accountOpen ? (
        <AccountPanel
          viewer={account.viewer}
          currentAccount={account.currentAccount}
          isAuthenticated={account.isAuthenticated}
          onClose={() => setAccountOpen(false)}
          onRenameGuest={account.renameGuest}
          onSignUp={account.signUp}
          onLogIn={account.logIn}
          onLogOut={account.logOut}
          onUpdateAccount={account.updateAccount}
          onUploadAvatar={account.uploadAvatar}
          onOpenSpaces={() => {
            setAccountOpen(false);
            const uname = account.currentAccount?.username;
            router.push(uname ? `/space/${uname}` : "/space");
          }}
        />
      ) : null}

      {/* ── Studio (full-screen, always mounted) ─────────────────────────── */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{ display: isStudio ? "flex" : "none" }}
      >
        {/* Room control chip — top left */}
        <RoomControl
          phase={roomPhase}
          isPublic={roomIsPublic}
          hasPassword={roomHasPassword}
          isOwner={roomIsOwner}
          shareUrl={mounted ? globalThis.location?.href ?? "" : ""}
          error={roomError}
          onTogglePublic={setRoomPublic}
          onSetPassword={setRoomPassword}
        />

        {/* Edge pointers for off-screen collaborators */}
        {viewSize.w > 0 &&
          remoteArtists.map((member) => {
            const MARGIN = 56;
            const vx = member.x - worldOffset.x - scrollPos.left;
            const vy = member.y - worldOffset.y - scrollPos.top;
            const isVisible =
              vx >= -20 && vx <= viewSize.w + 20 && vy >= -20 && vy <= viewSize.h + 20;
            if (isVisible) return null;
            const cx = viewSize.w / 2;
            const cy = viewSize.h / 2;
            const dx = vx - cx;
            const dy = vy - cy;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const tx =
              dx > 0
                ? (viewSize.w - MARGIN - cx) / dx
                : dx < 0
                  ? (MARGIN - cx) / dx
                  : Infinity;
            const ty =
              dy > 0
                ? (viewSize.h - MARGIN - cy) / dy
                : dy < 0
                  ? (MARGIN - cy) / dy
                  : Infinity;
            const t = Math.min(tx, ty);
            const px = cx + dx * t;
            const py = cy + dy * t;
            const layerLabel = member.activeLayer !== undefined ? `L${member.activeLayer + 1}` : "";
            const initials = member.name.slice(0, 2).toUpperCase();
            
            // Tool icon component
            const ToolIcon = () => {
              const iconProps = { size: 12, strokeWidth: 2, className: "opacity-90" };
              switch (member.tool) {
                case "pen": return <Pencil {...iconProps} />;
                case "eraser": return <Eraser {...iconProps} />;
                case "select": return <MousePointer {...iconProps} />;
                case "text": return <Type {...iconProps} />;
                case "washi": return <Scissors {...iconProps} />;
                case "asset": return <Image {...iconProps} />;
                case "animated": return <Sparkles {...iconProps} />;
                default: return <Pencil {...iconProps} />;
              }
            };
            
            return (
              <button
                key={member.presenceKey}
                onClick={() => jumpToMember(member)}
                className="btn-smooth absolute z-40 flex items-center gap-1 rounded-full py-1 pl-1 pr-2 text-[11px] font-semibold text-white"
                style={{
                  left: px,
                  top: py,
                  transform: "translate(-50%, -50%)",
                  background: member.color,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
                }}
                title={`${member.name} • ${member.tool || "pen"} ${layerLabel}`}
              >
                {/* Avatar or initials */}
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                  >
                    {initials}
                  </span>
                )}
                
                {/* Name */}
                <span className="max-w-[50px] truncate">{member.name}</span>
                
                {/* Tool & Layer */}
                <ToolIcon />
                {layerLabel && <span className="rounded bg-white/20 px-1 text-[9px]">{layerLabel}</span>}
                <svg
                  width="8" height="8" viewBox="0 0 8 8" fill="none"
                  style={{ marginLeft: 2, transform: `rotate(${angleDeg}deg)`, flexShrink: 0 }}
                >
                  <polygon points="8,4 2,1 3,4 2,7" fill="white" opacity="0.9" />
                </svg>
              </button>
            );
          })}

        {/* Scrollable infinite canvas */}
        <div ref={studioScrollRef} className="h-full w-full overflow-auto" style={{ touchAction: "none" }}>
          <div
            ref={canvasOuterRef}
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
            }}
          >
            <div
              ref={canvasWorldRef}
              className="absolute left-0 top-0 will-change-transform"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transformOrigin: "top left",
              }}
            >
            <DrawingCanvas
              ref={canvasRef}
              onPinchZoom={(scaleDelta, prevCx, prevCy, cx, cy) => {
                isPinchingRef.current = true;
                if (momentumRafRef.current) { cancelAnimationFrame(momentumRafRef.current); momentumRafRef.current = null; }

                // iOS fires one pointermove per finger, so we may get 2 calls per display
                // frame. Accumulate them and apply a single DOM update in the next RAF to
                // avoid the intermediate (stale-pointer) state causing a visible jump.
                if (pendingPinchRef.current) {
                  // Combine with queued update: multiply scale deltas, advance centroid
                  pendingPinchRef.current.scaleDelta *= scaleDelta;
                  pendingPinchRef.current.cx = cx;
                  pendingPinchRef.current.cy = cy;
                } else {
                  pendingPinchRef.current = { scaleDelta, prevCx, prevCy, cx, cy };
                  pinchRafRef.current = requestAnimationFrame(() => {
                    pinchRafRef.current = null;
                    const p = pendingPinchRef.current;
                    if (!p) return;
                    pendingPinchRef.current = null;
                    const next = Math.min(3, Math.max(0.25, zoomStateRef.current.current * p.scaleDelta));
                    applyZoomTransform(next, p.cx, p.cy, p.prevCx, p.prevCy);
                    zoomStateRef.current.current = next;
                    zoomStateRef.current.target = next;
                    zoomStateRef.current.isAnimating = false;
                    if (!zoomDisplayThrottleRef.current) {
                      zoomDisplayThrottleRef.current = setTimeout(() => {
                        setCanvasZoom(zoomStateRef.current.current);
                        zoomDisplayThrottleRef.current = null;
                      }, 80);
                    }
                  });
                }
              }}
              onPinchGestureEnd={startMomentum}
              brushSettings={brushSettings}
              placedItems={placedItems}
              selectedAsset={selectedAsset}
              selectedPaper={selectedPaper ?? null}
              customFonts={customFonts}
              onStrokeUpdate={handleStrokeUpdate}
              onStrokeComplete={handleStrokeComplete}
              onUndoStroke={handleUndoStroke}
              onRedoStroke={handleRedoStroke}
              onPlaceAsset={handlePlaceAsset}
              onAddTextItem={(item) => {
                const placed = placeTextItem(
                  item.text ?? "",
                  item.x,
                  item.y,
                  item.textColor ?? brushSettings.color,
                  item.textSize ?? 32,
                  item.textFont ?? '"Space Mono", monospace',
                  item.layerIndex ?? layerOrder[layerOrder.length - 1] ?? 0,
                );
                if (placed) broadcastPlacedItemAdd(placed);
                return placed ?? undefined;
              }}
              onUpdatePlacedItem={updatePlacedItem}
              removePlacedItem={handleRemovePlacedItem}
              onItemSelected={setSelectedItemId}
              externalSelectedItemId={selectedItemId}
              backgroundOffsetX={worldOffset.x}
              backgroundOffsetY={worldOffset.y}
              width={CANVAS_W}
              height={CANVAS_H}
              currentDrawingLayer={activeLayer}
              defaultLayerIndex={activeLayer}
              maxLayerIndex={layerCount - 1}
              layerOrder={layerOrder}
              hiddenLayerIds={hiddenLayerIds}
              remoteStrokes={remoteCompletedStrokes}
              dbStrokes={dbStrokes}
            />

            <canvas
              ref={remoteStrokeCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="pointer-events-none absolute inset-0"
              style={{ width: "100%", height: "100%", zIndex: 5 }}
            />

            {remoteArtists.map((member) => {
              const x = member.x - worldOffset.x;
              const y = member.y - worldOffset.y;
              if (x < -80 || y < -80 || x > CANVAS_W + 80 || y > CANVAS_H + 80)
                return null;
              
              const layerLabel = member.activeLayer !== undefined ? `L${member.activeLayer + 1}` : "";
              
              // Tool icon component
              const ToolIcon = () => {
                const iconProps = { size: 12, strokeWidth: 2, className: "opacity-80" };
                switch (member.tool) {
                  case "pen": return <Pencil {...iconProps} />;
                  case "eraser": return <Eraser {...iconProps} />;
                  case "select": return <MousePointer {...iconProps} />;
                  case "text": return <Type {...iconProps} />;
                  case "washi": return <Scissors {...iconProps} />;
                  case "asset": return <Image {...iconProps} />;
                  case "animated": return <Sparkles {...iconProps} />;
                  default: return <Pencil {...iconProps} />;
                }
              };
              
              return (
                <div
                  key={member.presenceKey}
                  className="pointer-events-none absolute z-40 flex items-center gap-1"
                  style={{ left: x, top: y }}
                >
                  {/* Cursor arrow */}
                  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={{ display: "block" }}>
                    <path
                      d="M1 1L1 14.5L4.2 10.8L6.6 17L8.8 16.1L6.3 9.8L11.2 9.8Z"
                      fill={member.color}
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Compact info badge */}
                  <div
                    className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white shadow-md"
                    style={{ background: member.color }}
                  >
                    {/* Avatar or initials */}
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[8px]">
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    
                    {/* Name */}
                    <span className="max-w-[60px] truncate">{member.name}</span>
                    
                    {/* Tool */}
                    <ToolIcon />
                    
                    {/* Layer */}
                    {layerLabel && (
                      <span className="rounded bg-white/20 px-1 text-[9px]">{layerLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Export modal */}
        {exportModalOpen && (
          <ExportModal
            isExporting={isExporting}
            hasAnimation={placedItems.some((p) => p.isAnimated)}
            staticFormat={staticFormat}
            onStaticFormatChange={setStaticFormat}
            onExportWhole={handleExportWhole}
            onSelectRegion={handleSelectRegion}
            onClose={() => setExportModalOpen(false)}
          />
        )}

        {/* Region selector overlay */}
        {selectingRegion && studioScrollRef.current && (
          <CanvasRegionSelector
            scrollEl={studioScrollRef.current}
            zoom={zoomStateRef.current.current}
            onZoom={(deltaY, deltaMode, clientX, clientY) => {
              const raw = deltaMode === 1 ? deltaY * 8 : deltaY;
              const delta = Math.max(-80, Math.min(80, raw));
              const factor = Math.exp(-delta * 0.004);
              const newZoom = Math.min(3, Math.max(0.25, zoomStateRef.current.current * factor));
              applyZoomTransform(newZoom, clientX, clientY, clientX, clientY);
              zoomStateRef.current.current = newZoom;
              zoomStateRef.current.target = newZoom;
              zoomStateRef.current.isAnimating = false;
              setCanvasZoom(newZoom);
            }}
            onConfirm={handleRegionConfirm}
            onCancel={() => setSelectingRegion(false)}
          />
        )}

        {/* Zoom controls — horizontal pill, bottom-left */}
        <div
          className="pointer-events-auto absolute z-50 flex items-center gap-0.5 rounded-2xl p-1.5"
          style={{
            left: "calc(4.5rem + env(safe-area-inset-left, 0px))",
            bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(186,156,214,0.3)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            backdropFilter: "blur(10px)",
          }}
        >
          <button
            onClick={zoomOut}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold"
            style={{ color: "var(--muted-strong)" }}
            title="Zoom out (-)"
          >
            −
          </button>

          <span className="min-w-12 text-center text-[11px] font-semibold tabular-nums" style={{ color: "var(--muted-strong)" }}>
            {Math.round(canvasZoom * 100)}%
          </span>

          <button
            onClick={zoomIn}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold"
            style={{ color: "var(--muted-strong)" }}
            title="Zoom in (+)"
          >
            +
          </button>

          <div className="mx-0.5 h-5 w-px bg-[rgba(186,156,214,0.3)]" />

          <button
            onClick={zoomReset}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-[13px] font-bold"
            style={{ background: canvasZoom !== 1 ? "rgba(167,139,250,0.15)" : "transparent", color: "#6d28d9" }}
            title="Reset zoom (100%)"
            disabled={canvasZoom === 1}
          >
            ⌂
          </button>
        </div>

        {/* Layers toggle button */}
        <button
          onClick={() => setShowLayerPanel((v) => !v)}
          title={showLayerPanel ? "Hide layers" : "Show layers"}
          className="btn-smooth absolute right-3 top-18 z-50 inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold"
          style={{
            background: showLayerPanel
              ? "rgba(167,139,250,0.18)"
              : "rgba(255,255,255,0.92)",
            color: showLayerPanel ? "#6d28d9" : "#6b7280",
            border: "1px solid rgba(167,139,250,0.25)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <FiLayers size={13} />
          Layers
        </button>

        {/* Layer panel — floats above the scrollable canvas */}
        {showLayerPanel && (
          <LayerPanel
            items={placedItems}
            selectedItemId={selectedItemId}
            onSelectItem={(id) => {
              setSelectedItemId(id);
              if (id) setBrushSettings((prev) => ({ ...prev, tool: "select" }));
            }}
            onUpdateItem={updatePlacedItem}
            onDeleteItem={handleRemovePlacedItem}
            onHide={() => setShowLayerPanel(false)}
            align="right"
            layerOrder={layerOrder}
            hiddenLayerIds={hiddenLayerIds}
            maxLayers={maxLayers}
            onAddLayer={handleAddLayer}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            activeLayer={activeLayer}
            onActiveLayerChange={setActiveLayer}
            onMoveLayerUp={handleMoveLayerUp}
            onMoveLayerDown={handleMoveLayerDown}
          />
        )}

        <StudioToolbar
          brushSettings={brushSettings}
          onBrushChange={handleBrushChange}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => { canvasRef.current?.clearCanvas(); clearDbStrokes(); }}
          onExport={handleExport}
          isExporting={isExporting}
          stickers={stickers}
          washiTapes={washiTapes}
          papers={papers}
          customFonts={customFonts}
          kitLibrary={assets.kitLibrary}
          storeItems={store.storeItems}
          viewer={account.viewer}
          selectedAsset={selectedAsset}
          selectedPaper={selectedPaper ?? null}
          onSelectSticker={handleSelectSticker}
          onSelectWashi={handleSelectWashi}
          onSelectPaper={setSelectedPaper}
          onDeselectAsset={handleDeselectAsset}
          onDeleteSticker={removeSticker}
          onDeleteWashi={removeWashiTape}
          onDeletePaper={removePaper}
          onDeleteCustomFont={removeCustomFont}
          onSaveSticker={addSticker}
          onSaveWashi={addWashiTape}
          onSaveCustomFont={addCustomFont}
          onAddKitToLibrary={assets.addKitToLibrary}
          onRemoveKit={assets.removeKit}
          onPublishKit={(kit, publishToShop) => {
            if (publishToShop) {
              store.publishKitToStore(kit, mail.user.name, account.viewer.accountId ?? "guest");
            }
            assets.addKitToLibrary(kit);
          }}
          collaborators={artistList.map((a) => ({
            id: a.id,
            name: a.name,
            color: a.color,
            avatarUrl: a.avatarUrl,
            username: a.username,
          }))}
          selfCollaboratorId={selfArtistId}
          onJumpToCollaborator={(artistId) => {
            const member = roomMembers.find((m) => m.presenceKey === artistId);
            if (member) jumpToMember(member);
          }}
          onOpenOwnProfile={() => setAccountOpen(true)}
        />

        {/* Floating bottom tab bar — studio only */}
        <nav
          className="pointer-events-auto absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-2"
          style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(186,156,214,0.3)",
            boxShadow: "0 8px 32px rgba(143,109,178,0.18), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
          aria-label="Navigation"
        >
          {/* Canvas — active indicator */}
          <span
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(167,139,250,0.12))",
              color: "var(--pink)",
            }}
          >
            <FiEdit3 size={17} />
            <span className="hidden sm:inline">Canvas</span>
          </span>

          <div className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--border)" }} />

          <button
            onClick={() => setActiveTab("mail")}
            className="btn-smooth btn-ripple relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ color: "var(--muted-strong)" }}
            aria-label="Mail"
          >
            <FiMail size={17} />
            <span className="hidden sm:inline">Mail</span>
            {unreadCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                style={{ background: "var(--pink)" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("store")}
            className="btn-smooth btn-ripple flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ color: "var(--muted-strong)" }}
            aria-label="Shop"
          >
            <FiShoppingBag size={17} />
            <span className="hidden sm:inline">Shop</span>
          </button>

          <button
            onClick={() => router.push("/rooms")}
            className="btn-smooth btn-ripple flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ color: "var(--muted-strong)" }}
            aria-label="Rooms"
          >
            <FiUsers size={17} />
            <span className="hidden sm:inline">Rooms</span>
          </button>

          <div className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--border)" }} />

          {/* Account */}
          <button
            onClick={() => setAccountOpen((p) => !p)}
            className="btn-smooth flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2"
            style={{
              borderColor: account.viewer.accentColor ?? "var(--pink)",
              background: account.viewer.accentColor ? `${account.viewer.accentColor}22` : "rgba(255,107,157,0.1)",
            }}
            aria-label="Account"
            title={account.viewer.name}
          >
            <img
              src={account.viewer.avatarUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(account.viewer.name || "mochimail")}`}
              alt={account.viewer.name}
              className="h-full w-full object-cover"
            />
          </button>
        </nav>
      </div>

      {/* Mail */}
      <div
        className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center overflow-y-auto px-3 pb-3 pt-2 sm:px-4"
        style={{ display: activeTab === "mail" ? "flex" : "none" }}
      >
        <div className="panel flex w-full max-w-4xl flex-col overflow-visible">
          {mailView === "compose" ? (
            <MailComposePanel
              senderName={mail.user.name}
              stickers={stickers}
              washiTapes={washiTapes}
              papers={papers}
              stamps={stamps}
              envelopes={envelopes}
              customFonts={customFonts}
              onSaveSticker={addSticker}
              onSaveWashi={addWashiTape}
              onSavePaper={addPaper}
              onSaveStamp={addStamp}
              onSaveEnvelope={addEnvelope}
              onSaveCustomFont={addCustomFont}
              onDeleteSticker={removeSticker}
              onDeleteWashi={removeWashiTape}
              onDeletePaper={removePaper}
              onDeleteStamp={removeStamp}
              onDeleteEnvelope={removeEnvelope}
              onDeleteCustomFont={removeCustomFont}
              onBack={() => setMailView("inbox")}
              onSend={(payload) => {
                mail.sendLetter(payload);
                trackMailSent({ speed: payload.speed, hasStamp: !!payload.stampName, hasCustomEnvelope: !!payload.envelopeName });
              }}
            />
          ) : (
            <MailboxPanel
              inbox={mail.inbox}
              sent={mail.sent}
              userId={mail.user.id}
              isDelivered={mail.isDelivered}
              getDeliveryProgress={mail.getDeliveryProgress}
              getTimeRemaining={mail.getTimeRemaining}
              markAsRead={mail.markAsRead}
              onCompose={() => { setMailView("compose"); trackMailComposeFocus(); }}
            />
          )}
        </div>
      </div>

      {/* Store */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ display: activeTab === "store" ? "block" : "none" }}
      >
        <div className="mx-auto max-w-7xl p-3 sm:p-4">
          <StoreView
            storeItems={store.storeItems}
            allStoreItems={store.allStoreItems}
            filterType={store.filterType}
            setFilterType={store.setFilterType}
            searchQuery={store.searchQuery}
            setSearchQuery={store.setSearchQuery}
            sortBy={store.sortBy}
            setSortBy={store.setSortBy}
            likedItemIds={store.likedItemIds}
            onLike={store.toggleLike}
            onAddToAssets={handleStoreAddToAssets}
            userStickers={stickers}
            userWashiTapes={washiTapes}
            userPapers={papers}
            userStamps={stamps}
            userEnvelopes={envelopes}
            userFonts={customFonts}
            onPublish={handleStorePublish}
            currentUserId={account.viewer.accountId ?? account.viewer.id}
            isGuest={account.viewer.accountId == null}
            onUpdateStoreItem={store.updateStoreItem}
            onRemoveFromStore={store.removeFromStore}
          />
        </div>
      </div>
    </div>
  );
}
