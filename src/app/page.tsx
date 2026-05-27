
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
import { exportCanvas } from "@/components/ExportUtil";
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

  const { account, assets, mail, store } = useMochi();

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
    isOwner: roomIsOwner,
    collabScope,
    members: roomMembers,
    trackCursor,
    selfColor,
    error: roomError,
    setRoomPublic,
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
    ) => {
      broadcastStroke(strokeId, pts, color, size, tool, isLast);
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
    ) => {
      void saveStroke(strokeId, pts, color, size, tool);
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [layerCount, setLayerCount] = useState(1);
  const [activeLayer, setActiveLayer] = useState(0);


  const handleMoveLayerUp = useCallback((layerIdx: number) => {
    if (layerIdx >= layerCount - 1) return;
    // Swap items between layerIdx and layerIdx + 1
    const itemsAbove = placedItems.filter((i) => (i.layerIndex ?? 0) === layerIdx + 1);
    const itemsBelow = placedItems.filter((i) => (i.layerIndex ?? 0) === layerIdx);
    
    itemsAbove.forEach((item) => {
      updatePlacedItem(item.id, { layerIndex: layerIdx });
    });
    itemsBelow.forEach((item) => {
      updatePlacedItem(item.id, { layerIndex: layerIdx + 1 });
    });
    
    // Update active layer if it was the one being moved
    if (activeLayer === layerIdx) {
      setActiveLayer(layerIdx + 1);
    } else if (activeLayer === layerIdx + 1) {
      setActiveLayer(layerIdx);
    }
  }, [layerCount, placedItems, updatePlacedItem, activeLayer]);

  const handleMoveLayerDown = useCallback((layerIdx: number) => {
    if (layerIdx <= 0) return;
    // Swap items between layerIdx and layerIdx - 1
    const itemsAbove = placedItems.filter((i) => (i.layerIndex ?? 0) === layerIdx);
    const itemsBelow = placedItems.filter((i) => (i.layerIndex ?? 0) === layerIdx - 1);
    
    itemsAbove.forEach((item) => {
      updatePlacedItem(item.id, { layerIndex: layerIdx - 1 });
    });
    itemsBelow.forEach((item) => {
      updatePlacedItem(item.id, { layerIndex: layerIdx });
    });
    
    // Update active layer if it was the one being moved
    if (activeLayer === layerIdx) {
      setActiveLayer(layerIdx - 1);
    } else if (activeLayer === layerIdx - 1) {
      setActiveLayer(layerIdx);
    }
  }, [placedItems, updatePlacedItem, activeLayer]);


  const handleExport = useCallback(() => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);
    exportCanvas(canvasRef.current, placedItems, "mochimail_letter")
      .then(() => toast("Canvas saved!", { icon: "save" }))
      .catch(() => toast("Export failed — try again", { variant: "error", icon: "warning" }))
      .finally(() => setIsExporting(false));
    trackCanvasExport();
  }, [placedItems, isExporting, trackCanvasExport]);

  const [triggerOpenAssets, setTriggerOpenAssets] = useState(0);

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
      toast(`${item.name} added to your studio!`, { icon: "sparkle" });
      setActiveTab("studio");
      setTriggerOpenAssets((n) => n + 1);
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

  // ── Canvas zoom (Ctrl+wheel / pinch) — optimized with RAF throttling ──────
  const pinchStateRef = useRef<{
    startDist: number;
    startZoom: number;
    centerX: number;
    centerY: number;
    initialScrollLeft: number;
    initialScrollTop: number;
  } | null>(null);
  
  // Use refs for smooth zoom animation without React re-renders
  const zoomStateRef = useRef({ current: 1, target: 1, isAnimating: false });
  const canvasWorldRef = useRef<HTMLDivElement>(null);
  const zoomRafRef = useRef<number | null>(null);
  const gestureStartDistRef = useRef(0);
  const gestureStartZoomRef = useRef(1);
  const gestureCenterRef = useRef({ x: 0, y: 0 });
  const gestureScrollRef = useRef({ left: 0, top: 0 });

  // Apply zoom using CSS transform for GPU acceleration (no React render)
  const applyZoomTransform = useCallback((zoom: number, centerX?: number, centerY?: number) => {
    const worldEl = canvasWorldRef.current;
    const scrollEl = studioScrollRef.current;
    if (!worldEl || !scrollEl) return;

    // Use CSS transform for GPU-accelerated zooming
    worldEl.style.transform = `scale(${zoom})`;
    worldEl.style.transformOrigin = "top left";
    
    // Adjust container size to match zoom
    const scaledW = CANVAS_W * zoom;
    const scaledH = CANVAS_H * zoom;
    worldEl.style.width = `${scaledW}px`;
    worldEl.style.height = `${scaledH}px`;
    
    // Keep focal point stable if center coordinates provided
    if (centerX !== undefined && centerY !== undefined) {
      const rect = scrollEl.getBoundingClientRect();
      const viewportX = centerX - rect.left;
      const viewportY = centerY - rect.top;
      const focalWorldX = (scrollEl.scrollLeft + viewportX) / zoomStateRef.current.current;
      const focalWorldY = (scrollEl.scrollTop + viewportY) / zoomStateRef.current.current;
      scrollEl.scrollLeft = focalWorldX * zoom - viewportX;
      scrollEl.scrollTop = focalWorldY * zoom - viewportY;
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

  useEffect(() => {
    if (activeTab !== "studio") return;
    const el = studioScrollRef.current;
    if (!el) return;

    // Wheel zoom with Ctrl/Meta - throttled with RAF
    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
    let accumulatedDelta = 0;
    
    const onWheel = (e: WheelEvent) => {
      // Normal scroll (no modifier) - let browser handle it natively
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }
      
      e.preventDefault();
      
      // Accumulate delta for smooth zooming
      accumulatedDelta += -e.deltaY * 0.002;
      
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      } else {
        // First wheel event - capture focal point
        const rect = el.getBoundingClientRect();
        gestureCenterRef.current = { x: e.clientX, y: e.clientY };
        gestureScrollRef.current = { left: el.scrollLeft, top: el.scrollTop };
      }
      
      wheelTimeout = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const viewportX = gestureCenterRef.current.x - rect.left;
        const viewportY = gestureCenterRef.current.y - rect.top;
        const focalWorldX = (gestureScrollRef.current.left + viewportX) / zoomStateRef.current.target;
        const focalWorldY = (gestureScrollRef.current.top + viewportY) / zoomStateRef.current.target;
        
        const newZoom = Math.min(3, Math.max(0.25, zoomStateRef.current.target * (1 + accumulatedDelta)));
        setZoomSmooth(newZoom, gestureCenterRef.current.x, gestureCenterRef.current.y);
        
        accumulatedDelta = 0;
        wheelTimeout = null;
      }, 16); // One frame delay for batching
    };

    // Touch pinch zoom - optimized
    const getTouchDistance = (t1: Touch, t2: Touch) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const center = getTouchCenter(t1, t2);
        gestureStartDistRef.current = getTouchDistance(t1, t2);
        gestureStartZoomRef.current = zoomStateRef.current.target;
        gestureCenterRef.current = center;
        gestureScrollRef.current = { left: el.scrollLeft, top: el.scrollTop };
        pinchStateRef.current = {
          startDist: gestureStartDistRef.current,
          startZoom: gestureStartZoomRef.current,
          centerX: center.x,
          centerY: center.y,
          initialScrollLeft: el.scrollLeft,
          initialScrollTop: el.scrollTop,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        
        const newDist = getTouchDistance(t1, t2);
        const scale = newDist / pinchStateRef.current.startDist;
        const nextZoom = Math.min(3, Math.max(0.25, pinchStateRef.current.startZoom * scale));
        
        const currentCenter = getTouchCenter(t1, t2);
        
        // Apply zoom immediately for responsive pinch
        zoomStateRef.current.target = nextZoom;
        if (!zoomStateRef.current.isAnimating) {
          zoomStateRef.current.current = nextZoom;
          applyZoomTransform(nextZoom, currentCenter.x, currentCenter.y);
        }
      }
    };

    const onTouchEnd = () => {
      if (pinchStateRef.current) {
        // Sync final zoom to React state
        setCanvasZoom(zoomStateRef.current.target);
        pinchStateRef.current = null;
      }
    };

    // Legacy Safari gesture events (backup for older iOS)
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      gestureStartZoomRef.current = zoomStateRef.current.target;
      gestureCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      gestureScrollRef.current = { left: el.scrollLeft, top: el.scrollTop };
    };
    
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number };
      if (typeof ge.scale === "number") {
        const nextZoom = Math.min(3, Math.max(0.25, gestureStartZoomRef.current * ge.scale));
        setZoomSmooth(nextZoom, gestureCenterRef.current.x, gestureCenterRef.current.y);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("gesturestart", onGestureStart, { passive: false } as EventListenerOptions);
    el.addEventListener("gesturechange", onGestureChange, { passive: false } as EventListenerOptions);
    
    return () => {
      if (zoomRafRef.current) {
        cancelAnimationFrame(zoomRafRef.current);
      }
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [activeTab, applyZoomTransform, setZoomSmooth]);

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
      const maxLeft = Math.max(0, CANVAS_W - el.clientWidth);
      const maxTop = Math.max(0, CANVAS_H - el.clientHeight);
      let dx = 0;
      let dy = 0;
      if (el.scrollLeft < thresholdX || el.scrollLeft > maxLeft - thresholdX)
        dx = centerLeft - el.scrollLeft;
      if (el.scrollTop < thresholdY || el.scrollTop > maxTop - thresholdY)
        dy = centerTop - el.scrollTop;

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
            router.push("/space");
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
          isOwner={roomIsOwner}
          shareUrl={mounted ? globalThis.location?.href ?? "" : ""}
          error={roomError}
          onTogglePublic={setRoomPublic}
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
        <div ref={studioScrollRef} className="h-full w-full overflow-auto" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
          <div
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
                  item.layerIndex ?? layerCount - 1,
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

        {/* Zoom controls */}
        <div
          className="pointer-events-auto absolute bottom-20 right-4 z-50 flex flex-col items-center gap-1 rounded-2xl p-1.5"
          style={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(186,156,214,0.3)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            backdropFilter: "blur(10px)",
          }}
        >
          <button
            onClick={zoomIn}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold transition-all hover:scale-105"
            style={{ color: "var(--muted-strong)" }}
            title="Zoom in (+)"
          >
            +
          </button>
          
          <div className="flex h-8 items-center justify-center">
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--muted-strong)" }}>
              {Math.round(canvasZoom * 100)}%
            </span>
          </div>
          
          <button
            onClick={zoomOut}
            className="btn-smooth flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold transition-all hover:scale-105"
            style={{ color: "var(--muted-strong)" }}
            title="Zoom out (-)"
          >
            −
          </button>
          
          <div className="my-0.5 h-px w-5 bg-[rgba(186,156,214,0.3)]" />
          
          <button
            onClick={zoomReset}
            className="btn-smooth flex h-7 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
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
            layerCount={layerCount}
            onLayerCountChange={setLayerCount}
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
          triggerOpenAssets={triggerOpenAssets}
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
            isInCollection={store.isInCollection}
            addToCollection={store.addToCollection}
            removeFromCollection={store.removeFromCollection}
            onAddToAssets={handleStoreAddToAssets}
            userStickers={stickers}
            userWashiTapes={washiTapes}
            userPapers={papers}
            userStamps={stamps}
            userEnvelopes={envelopes}
            userFonts={customFonts}
            onPublish={handleStorePublish}
            currentUserId={account.viewer.accountId ?? account.viewer.id}
            isGuest={!account.isAuthenticated}
            onUpdateStoreItem={store.updateStoreItem}
            onRemoveFromStore={store.removeFromStore}
          />
        </div>
      </div>
    </div>
  );
}
