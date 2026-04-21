"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AccountPanel from "@/components/AccountPanel";
import DrawingCanvas, { DrawingCanvasHandle } from "@/components/DrawingCanvas";
import StudioToolbar from "@/components/StudioToolbar";
import MailComposePanel from "@/components/MailComposePanel";
import MailboxPanel from "@/components/MailboxPanel";
import StoreView from "@/components/StoreView";
import { FiEdit3, FiMail, FiShoppingBag } from "react-icons/fi";
import { exportWithDSBorder } from "@/components/ExportUtil";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { useAssets } from "@/hooks/useAssets";
import { useMail } from "@/hooks/useMail";
import { useStore } from "@/hooks/useStore";
import { AppTab, BrushSettings, CustomFont, EnvelopeStyle, MailStamp, PaperBackground, Sticker, WashiTape, StoreItem } from "@/types";

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "studio", label: "Canvas", icon: "edit" },
  { id: "mail", label: "Mail", icon: "mail" },
  { id: "store", label: "Shop", icon: "shop" },
];

const TAB_ICONS: Record<string, ReactNode> = {
  edit: <FiEdit3 />,
  mail: <FiMail />,
  shop: <FiShoppingBag />,
};

const PRESENCE_COLORS = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"];

type ArtistPresence = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  lastSeen: number;
  avatarUrl?: string;
  username?: string;
};

type PresencePayload = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  ts: number;
  avatarUrl?: string;
  username?: string;
};

type PresenceTransport = {
  publish: (payload: PresencePayload) => void;
  close: () => void;
};

function pruneStaleArtists(
  artists: Record<string, ArtistPresence>,
  selfId: string,
  cutoff: number
): Record<string, ArtistPresence> {
  const next: Record<string, ArtistPresence> = {};
  for (const artist of Object.values(artists)) {
    if (artist.id === selfId || artist.lastSeen > cutoff) {
      next[artist.id] = artist;
    }
  }
  return next;
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>("studio");
  const [mailView, setMailView] = useState<"inbox" | "compose">("inbox");
  const [accountOpen, setAccountOpen] = useState(false);
  const [selfArtistId] = useState(() => {
    if (!globalThis.window) return "";
    const saved = sessionStorage.getItem("mochimail_artist_id");
    const id = saved ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("mochimail_artist_id", id);
    return id;
  });

  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const studioScrollRef = useRef<HTMLDivElement>(null);
  const worldOffsetRef = useRef({ x: 0, y: 0 });
  const [worldOffset, setWorldOffset] = useState({ x: 0, y: 0 });
  const hasCenteredRef = useRef(false);
  const selfIdRef = useRef(selfArtistId);
  const selfColorRef = useRef(PRESENCE_COLORS[(selfArtistId.codePointAt(0) ?? 0) % PRESENCE_COLORS.length]);
  const channelRef = useRef<PresenceTransport | null>(null);
  const lastMouseWorldRef = useRef<{ x: number; y: number } | null>(null);

  const CANVAS_W = 6000;
  const CANVAS_H = 4800;

  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    color: "#1e1e2e",
    size: 4,
    tool: "pen",
    textSize: 34,
    textFont: '"Space Mono", monospace',
  });

  const account = useAccount();

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
    shiftPlacedItems,
    updatePlacedItem,
    removeSticker,
    removeWashiTape,
    removePaper,
    removeStamp,
    removeEnvelope,
    removeCustomFont,
  } = useAssets(account.viewer);

  const [artists, setArtists] = useState<Record<string, ArtistPresence>>({});
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });

  const mail = useMail(account.viewer);
  const store = useStore(account.viewer);

  const handleBrushChange = useCallback((update: Partial<BrushSettings>) => {
    setBrushSettings((prev) => ({ ...prev, ...update }));
  }, []);

  const handleSelectSticker = useCallback(
    (s: Sticker) => {
      setSelectedAsset(s);
      setBrushSettings((prev) => ({ ...prev, tool: "sticker" }));
    },
    [setSelectedAsset]
  );

  const handleSelectWashi = useCallback(
    (w: WashiTape) => {
      setSelectedAsset(w);
      setBrushSettings((prev) => ({ ...prev, tool: "washi" }));
    },
    [setSelectedAsset]
  );

  const handleDeselectAsset = useCallback(() => {
    setSelectedAsset(null);
  }, [setSelectedAsset]);

  const handleExport = useCallback(() => {
    if (canvasRef.current) exportWithDSBorder(canvasRef.current, "mochimail_letter");
  }, []);

  const handleStoreAddToAssets = useCallback(
    (item: StoreItem) => {
      if (item.type === "sticker") {
        addSticker(item.name, item.imageData, item.width, item.height);
      } else if (item.type === "washi") {
        addWashiTape(item.name, item.imageData, item.opacity ?? 0.7, item.width, item.height);
      } else if (item.type === "background") {
        const paper = addPaper(item.name, item.imageData, item.width, item.height);
        setSelectedPaper(paper);
      } else if (item.type === "stamp") {
        addStamp(item.name, item.imageData, item.width, item.height);
      } else if (item.type === "envelope") {
        addEnvelope(item.name, item.imageData, item.width, item.height);
      } else if (item.type === "font" && item.fontData) {
        addCustomFont(item.fontData.name, item.fontData.glyphs, item.fontData.glyphWidth, item.fontData.glyphHeight);
      }
    },
    [addSticker, addWashiTape, addPaper, addStamp, addEnvelope, addCustomFont, setSelectedPaper]
  );

  const handleStorePublish = useCallback(
    (item: Sticker | WashiTape | PaperBackground | CustomFont | MailStamp | EnvelopeStyle, itemType: StoreItem["type"], tags: string[]) => {
      store.publishToStore(item, itemType, account.viewer.name, account.viewer.accountId ?? account.viewer.id, tags);
    },
    [account.viewer, store]
  );

  const unreadCount = mail.inbox.filter((l) => !l.read && mail.isDelivered(l)).length;

  const getViewportCenterWorld = useCallback(() => {
    const el = studioScrollRef.current;
    if (!el) return { x: worldOffsetRef.current.x, y: worldOffsetRef.current.y };
    return {
      x: el.scrollLeft + el.clientWidth / 2 + worldOffsetRef.current.x,
      y: el.scrollTop + el.clientHeight / 2 + worldOffsetRef.current.y,
    };
  }, []);

  const publishPresence = useCallback(() => {
    const id = selfIdRef.current;
    if (!id) return;
    const pos = lastMouseWorldRef.current ?? getViewportCenterWorld();
    const payload: PresencePayload = {
      id,
      name: mail.user.name,
      color: selfColorRef.current,
      x: pos.x,
      y: pos.y,
      ts: Date.now(),
      avatarUrl: account.viewer.avatarUrl,
      username: account.viewer.username,
    };
    setArtists((prev) => ({
      ...prev,
      [id]: {
        id: payload.id,
        name: payload.name,
        color: payload.color,
        x: payload.x,
        y: payload.y,
        lastSeen: payload.ts,
        avatarUrl: payload.avatarUrl,
        username: payload.username,
      },
    }));
    channelRef.current?.publish(payload);
  }, [getViewportCenterWorld, mail.user.name, account.viewer.avatarUrl, account.viewer.username]);

  const jumpToArtist = useCallback(
    (artist: ArtistPresence) => {
      const el = studioScrollRef.current;
      if (!el) return;
      const canvasX = artist.x - worldOffsetRef.current.x;
      const canvasY = artist.y - worldOffsetRef.current.y;
      const maxLeft = Math.max(0, CANVAS_W - el.clientWidth);
      const maxTop = Math.max(0, CANVAS_H - el.clientHeight);
      const nextLeft = Math.max(0, Math.min(maxLeft, canvasX - el.clientWidth / 2));
      const nextTop = Math.max(0, Math.min(maxTop, canvasY - el.clientHeight / 2));
      el.scrollTo({ left: nextLeft, top: nextTop, behavior: "smooth" });
    },
    [CANVAS_H, CANVAS_W]
  );

  useEffect(() => {
    if (activeTab !== "studio") return;
    const el = studioScrollRef.current;
    if (!el) return;

    if (!hasCenteredRef.current) {
      const left = Math.max(0, Math.floor((CANVAS_W - el.clientWidth) / 2));
      const top = Math.max(0, Math.floor((CANVAS_H - el.clientHeight) / 2));
      el.scrollTo({ left, top, behavior: "auto" });
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

      if (el.scrollLeft < thresholdX || el.scrollLeft > maxLeft - thresholdX) {
        dx = centerLeft - el.scrollLeft;
      }
      if (el.scrollTop < thresholdY || el.scrollTop > maxTop - thresholdY) {
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
      publishPresence();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const canvasX = el.scrollLeft + e.clientX - rect.left;
      const canvasY = el.scrollTop + e.clientY - rect.top;
      lastMouseWorldRef.current = {
        x: canvasX + worldOffsetRef.current.x,
        y: canvasY + worldOffsetRef.current.y,
      };
      publishPresence();
    };

    const onMouseLeave = () => {
      lastMouseWorldRef.current = null;
    };

    const updateViewSize = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    updateViewSize();
    setScrollPos({ left: el.scrollLeft, top: el.scrollTop });

    const ro = new ResizeObserver(updateViewSize);
    ro.observe(el);

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousemove", onMouseMove, { passive: true });
    el.addEventListener("mouseleave", onMouseLeave);
    publishPresence();

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [activeTab, CANVAS_H, CANVAS_W, publishPresence, shiftPlacedItems]);

  useEffect(() => {
    const id = selfArtistId;
    selfIdRef.current = id;
    selfColorRef.current =
      PRESENCE_COLORS[(id.codePointAt(0) ?? 0) % PRESENCE_COLORS.length];

    const handleIncomingPresence = (payload: PresencePayload) => {
      if (!payload?.id || payload.id === selfIdRef.current) return;
      setArtists((prev) => ({
        ...prev,
        [payload.id]: {
          id: payload.id,
          name: payload.name,
          color: payload.color,
          x: payload.x,
          y: payload.y,
          lastSeen: payload.ts,
          avatarUrl: payload.avatarUrl,
          username: payload.username,
        },
      }));
    };

    if (account.hasSession) {
      const supabase = createSupabaseBrowserClient();
      const realtime = supabase
        .channel("mochimail-presence", { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "presence" }, ({ payload }) => {
          handleIncomingPresence(payload as PresencePayload);
        });

      void realtime.subscribe((status) => {
        if (status === "SUBSCRIBED") publishPresence();
      });

      channelRef.current = {
        publish: (payload) => {
          void realtime.send({ type: "broadcast", event: "presence", payload });
        },
        close: () => {
          void supabase.removeChannel(realtime);
        },
      };
    } else {
      const bc = new BroadcastChannel("mochimail-presence");
      bc.onmessage = (event: MessageEvent<PresencePayload>) => {
        handleIncomingPresence(event.data);
      };
      channelRef.current = {
        publish: (payload) => bc.postMessage(payload),
        close: () => bc.close(),
      };
    }

    const heartbeat = globalThis.setInterval(() => publishPresence(), 900);
    const cleanup = globalThis.setInterval(() => {
      const cutoff = Date.now() - 4500;
      setArtists((prev) => pruneStaleArtists(prev, selfIdRef.current, cutoff));
    }, 1500);

    return () => {
      globalThis.clearInterval(heartbeat);
      globalThis.clearInterval(cleanup);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [account.hasSession, publishPresence, selfArtistId]);


  const artistList = Object.values(artists).sort((a, b) => {
    if (a.id === selfArtistId) return -1;
    if (b.id === selfArtistId) return 1;
    return b.lastSeen - a.lastSeen;
  });

  const remoteArtists = artistList.filter((artist) => artist.id !== selfArtistId);

  return (
    <div className="relative z-10 flex h-svh flex-col overflow-hidden">
      {/* Header */}
      <header className="glass-strong shrink-0 px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-10 w-10 rounded-xl bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/brand-mark.svg')" }}
            >
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">MochiMail</h1>
              <p className="hidden text-[10px] tracking-widest sm:block" style={{ color: "var(--muted)" }}>
                DIGITAL STATIONERY
              </p>
            </div>
          </div>

          <nav className="flex rounded-xl p-1" style={{ background: "var(--surface)" }} aria-label="Main navigation">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn-smooth relative flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{
                  background: activeTab === tab.id ? "var(--surface-hover)" : "transparent",
                  color: activeTab === tab.id ? "var(--foreground)" : "var(--muted)",
                }}
                aria-current={activeTab === tab.id ? "page" : undefined}
                aria-label={tab.label}
              >
                <span>{TAB_ICONS[tab.icon]}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "mail" && unreadCount > 0 && (
                  <span
                    className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                    style={{ background: "var(--pink)" }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setAccountOpen((prev) => !prev)}
            className="btn-smooth flex items-center gap-2 rounded-2xl px-3 py-2"
            style={{ background: "var(--surface)" }}
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: account.viewer.accentColor ?? "rgba(255,255,255,0.92)" }}>
              {account.viewer.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={account.viewer.avatarUrl} alt={account.viewer.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{account.hydrated ? account.viewer.name.slice(0, 2).toUpperCase() : "…"}</span>
              )}
            </span>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold">{account.hydrated ? account.viewer.name : ""}</div>
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                {account.hydrated ? account.accountLabel : ""}
              </div>
              {account.hydrated && account.identityHelp ? (
                <div className="max-w-64 text-[9px] leading-relaxed" style={{ color: "var(--coral)" }}>
                  {account.identityHelp}
                </div>
              ) : null}
            </div>
          </button>
        </div>
      </header>

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
          onOpenSpaces={() => { setAccountOpen(false); router.push("/space"); }}
        />
      ) : null}

      {/* Studio — stays mounted for canvas persistence */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{ display: activeTab === "studio" ? "flex" : "none" }}
      >
        {/* Edge presence indicators — off-screen remote cursors */}
        {viewSize.w > 0 && remoteArtists.map((artist) => {
            const MARGIN = 32;
            const canvasX = artist.x - worldOffset.x;
            const canvasY = artist.y - worldOffset.y;
            const vx = canvasX - scrollPos.left;
            const vy = canvasY - scrollPos.top;
            const isVisible = vx >= -16 && vx <= viewSize.w + 16 && vy >= -16 && vy <= viewSize.h + 16;
            if (isVisible) return null;
            const cx = viewSize.w / 2;
            const cy = viewSize.h / 2;
            const dx = vx - cx;
            const dy = vy - cy;
            const angle = Math.atan2(dy, dx);
            let tx = Infinity;
            if (dx > 0) tx = (viewSize.w - MARGIN - cx) / dx;
            else if (dx < 0) tx = (MARGIN - cx) / dx;
            let ty = Infinity;
            if (dy > 0) ty = (viewSize.h - MARGIN - cy) / dy;
            else if (dy < 0) ty = (MARGIN - cy) / dy;
            const t = Math.min(tx, ty);
            const ex = cx + dx * t;
            const ey = cy + dy * t;
            const angleDeg = (angle * 180) / Math.PI;
            return (
              <button
                key={artist.id}
                onClick={() => jumpToArtist(artist)}
                className="btn-smooth absolute z-50 flex flex-col items-center gap-0.5"
                style={{ left: ex, top: ey, transform: "translate(-50%, -50%)" }}
                title={`Jump to ${artist.name}`}
              >
                <span
                  className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                  style={{ background: artist.color, boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }}
                >
                  {artist.name}
                </span>
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: artist.color, transform: `rotate(${angleDeg}deg)`, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                >
                  <svg width="9" height="9" viewBox="-5 -5 10 10" fill="none">
                    <polygon points="5,0 -3.5,-3.5 -3.5,3.5" fill="white" />
                  </svg>
                </div>
              </button>
            );
          })}
          {/* Scrollable canvas area */}
          <div ref={studioScrollRef} className="h-full w-full overflow-auto">
            <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
              <DrawingCanvas
                ref={canvasRef}
                brushSettings={brushSettings}
                placedItems={placedItems}
                selectedAsset={selectedAsset}
                selectedPaper={selectedPaper}
                customFonts={customFonts}
                onPlaceAsset={(asset, x, y) => placeItem(asset, x, y)}
                onAddTextItem={(item) => placeTextItem(item.text ?? "Text", item.x, item.y, item.textColor ?? brushSettings.color, item.textSize ?? 32, item.textFont ?? '"Space Mono", monospace')}
                onUpdatePlacedItem={updatePlacedItem}
                backgroundOffsetX={worldOffset.x}
                backgroundOffsetY={worldOffset.y}
                width={CANVAS_W}
                height={CANVAS_H}
              />
              {remoteArtists.map((artist) => {
                const x = artist.x - worldOffset.x;
                const y = artist.y - worldOffset.y;
                if (x < -80 || y < -80 || x > CANVAS_W + 80 || y > CANVAS_H + 80) {
                  return null;
                }
                return (
                  <div
                    key={artist.id}
                    className="pointer-events-none absolute"
                    style={{ left: x, top: y }}
                  >
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={{ display: "block" }}>
                      <path
                        d="M1 1L1 14.5L4.2 10.8L6.6 17L8.8 16.1L6.3 9.8L11.2 9.8Z"
                        fill={artist.color}
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span
                      className="absolute left-4 top-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: artist.color, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
                    >
                      {artist.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        <StudioToolbar
          brushSettings={brushSettings}
          onBrushChange={handleBrushChange}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clearCanvas()}
          onExport={handleExport}
          stickers={stickers}
          washiTapes={washiTapes}
          papers={papers}
          customFonts={customFonts}
          selectedAsset={selectedAsset}
          selectedPaper={selectedPaper}
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
          collaborators={artistList.map((artist) => ({
            id: artist.id,
            name: artist.name,
            color: artist.color,
            avatarUrl: artist.avatarUrl,
            username: artist.username,
          }))}
          selfCollaboratorId={selfArtistId}
          onJumpToCollaborator={(artistId) => {
            const artist = artistList.find((item) => item.id === artistId);
            if (artist) jumpToArtist(artist);
          }}
        />
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
              onCompose={() => setMailView("compose")}
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
          />
        </div>
      </div>

    </div>
  );
}
