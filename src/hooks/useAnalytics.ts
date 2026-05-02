import { useCallback, useEffect, useRef } from "react";
import { track, identifyUser, trackPageview } from "@/lib/posthog";

export function usePageview(path: string) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackPageview(path);
  }, [path]);
}

export function useIdentify(
  accountId: string | null | undefined,
  props?: { name?: string; username?: string; isGuest?: boolean },
) {
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!accountId || accountId === lastId.current) return;
    lastId.current = accountId;
    identifyUser(accountId, props);
  }, [accountId, props?.name, props?.username, props?.isGuest]);
}

export function useStudioAnalytics() {
  const trackToolSwitch = useCallback((tool: string) => {
    track("tool_selected", { tool });
  }, []);

  const trackBrushColorChange = useCallback((color: string) => {
    track("brush_color_changed", { color });
  }, []);

  const trackStickerPlaced = useCallback((stickerName: string) => {
    track("sticker_placed", { sticker_name: stickerName });
  }, []);

  const trackWashiPlaced = useCallback((tapeName: string) => {
    track("washi_tape_placed", { tape_name: tapeName });
  }, []);

  const trackCanvasExport = useCallback(() => {
    track("canvas_exported");
  }, []);

  const trackCanvasCleared = useCallback(() => {
    track("canvas_cleared");
  }, []);

  const trackUndoRedo = useCallback((action: "undo" | "redo") => {
    track("canvas_undo_redo", { action });
  }, []);

  const trackTabChange = useCallback((tab: string) => {
    track("tab_changed", { tab });
  }, []);

  return {
    trackToolSwitch,
    trackBrushColorChange,
    trackStickerPlaced,
    trackWashiPlaced,
    trackCanvasExport,
    trackCanvasCleared,
    trackUndoRedo,
    trackTabChange,
  };
}

export function useMailAnalytics() {
  const trackMailSent = useCallback((props: { speed?: string; hasStamp?: boolean; hasCustomEnvelope?: boolean; hasSticker?: boolean }) => {
    track("mail_sent", props);
  }, []);

  const trackMailOpened = useCallback((mailId: string) => {
    track("mail_opened", { mail_id: mailId });
  }, []);

  const trackMailDeleted = useCallback(() => {
    track("mail_deleted");
  }, []);

  const trackMailComposeFocus = useCallback(() => {
    track("mail_compose_started");
  }, []);

  return { trackMailSent, trackMailOpened, trackMailDeleted, trackMailComposeFocus };
}

export function useStoreAnalytics() {
  const trackItemViewed = useCallback((itemId: string, itemType: string, itemName: string) => {
    track("store_item_viewed", { item_id: itemId, item_type: itemType, item_name: itemName });
  }, []);

  const trackItemAdded = useCallback((itemId: string, itemType: string, itemName: string) => {
    track("store_item_added", { item_id: itemId, item_type: itemType, item_name: itemName });
  }, []);

  const trackItemPublished = useCallback((itemType: string, itemName: string) => {
    track("store_item_published", { item_type: itemType, item_name: itemName });
  }, []);

  return { trackItemViewed, trackItemAdded, trackItemPublished };
}

export function useKitAnalytics() {
  const trackKitElementAdded = useCallback((elementName: string, kitName: string) => {
    track("kit_element_added", { element_name: elementName, kit_name: kitName });
  }, []);

  const trackKitAdded = useCallback((kitName: string, elementCount: number) => {
    track("kit_added", { kit_name: kitName, element_count: elementCount });
  }, []);

  const trackKitSavedToLibrary = useCallback((kitName: string) => {
    track("kit_saved_to_library", { kit_name: kitName });
  }, []);

  const trackKitCreated = useCallback((kitName: string, elementCount: number, publishedToShop: boolean) => {
    track("kit_created", { kit_name: kitName, element_count: elementCount, published_to_shop: publishedToShop });
  }, []);

  return { trackKitElementAdded, trackKitAdded, trackKitSavedToLibrary, trackKitCreated };
}

export function useRoomAnalytics() {
  const trackRoomCreated = useCallback(() => {
    track("room_created");
  }, []);

  const trackRoomJoined = useCallback((roomId: string) => {
    track("room_joined", { room_id: roomId });
  }, []);

  const trackRoomVisibilityChanged = useCallback((isPublic: boolean) => {
    track("room_visibility_changed", { is_public: isPublic });
  }, []);

  return { trackRoomCreated, trackRoomJoined, trackRoomVisibilityChanged };
}
