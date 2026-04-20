"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SpaceItem, SpaceItemType, UserSpace, ViewerIdentity } from "@/types";

interface SpaceStudioProps {
  viewer: ViewerIdentity;
  isAuthenticated: boolean;
  spaces: UserSpace[];
  ownSpace: UserSpace | null;
  selectedSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
  onRequireAccount: () => void;
  onUpdateOwnSpace: (patch: Partial<UserSpace>) => void;
  onAddItemToOwnSpace: (type: SpaceItemType, seed?: Partial<SpaceItem>) => SpaceItem | undefined;
  onUpdateSpaceItem: (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => void;
  onRemoveSpaceItem: (spaceId: string, itemId: string) => void;
  onLeaveVisitorNote: (spaceId: string, authorName: string, message: string) => void;
}

type DragState = {
  itemId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

function extractYouTubeId(url: string): string {
  const input = url.trim();
  if (!input) return "";
  const shortMatch = /youtu\.be\/([^?&]+)/.exec(input);
  if (shortMatch) return shortMatch[1];
  const longMatch = /[?&]v=([^?&]+)/.exec(input);
  if (longMatch) return longMatch[1];
  const embedMatch = /embed\/([^?&]+)/.exec(input);
  if (embedMatch) return embedMatch[1];
  return "";
}

function getItemBody(item: SpaceItem) {
  if (item.type === "image" || item.type === "drawing") {
    return item.imageUrl ? (
      <img src={item.imageUrl} alt={item.title} className="h-full w-full rounded-[inherit] object-cover" />
    ) : (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--muted)" }}>
        Add an image URL in the inspector.
      </div>
    );
  }

  return (
    <div className="h-full whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "rgba(53,39,66,0.88)" }}>
      {item.content}
    </div>
  );
}

function DoodlePad({ onCreate }: Readonly<{ onCreate: (imageUrl: string) => void }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState("#352742");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fffdfb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
  }, []);

  const drawPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    if (!pointRef.current) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      pointRef.current = { x, y };
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pointRef.current.x, pointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    pointRef.current = { x, y };
  };

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
          Doodle Pad
        </p>
        <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} className="h-8 w-8 rounded-lg border-0 bg-transparent p-0" />
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={180}
        className="w-full rounded-xl border bg-white"
        style={{ borderColor: "var(--border)" }}
        onPointerDown={(event) => {
          drawingRef.current = true;
          drawPoint(event);
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          drawPoint(event);
        }}
        onPointerUp={() => {
          drawingRef.current = false;
          pointRef.current = null;
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
          pointRef.current = null;
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            ctx.fillStyle = "#fffdfb";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }}
          className="btn-smooth rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
        >
          Clear
        </button>
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            onCreate(canvas.toDataURL("image/png"));
          }}
          className="btn-smooth rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
        >
          Add doodle to space
        </button>
      </div>
    </div>
  );
}

export default function SpaceStudio({
  viewer,
  isAuthenticated,
  spaces,
  ownSpace,
  selectedSpaceId,
  onSelectSpace,
  onRequireAccount,
  onUpdateOwnSpace,
  onAddItemToOwnSpace,
  onUpdateSpaceItem,
  onRemoveSpaceItem,
  onLeaveVisitorNote,
}: Readonly<SpaceStudioProps>) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [visitorMessage, setVisitorMessage] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) ?? ownSpace ?? spaces[0] ?? null,
    [ownSpace, selectedSpaceId, spaces]
  );

  const isOwner = selectedSpace?.id === ownSpace?.id;
  const selectedItem = selectedSpace?.items.find((item) => item.id === selectedItemId) ?? null;
  const youtubeId = extractYouTubeId(selectedSpace?.youtubeUrl ?? "");

  useEffect(() => {
    if (!selectedSpace) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !selectedSpace.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(selectedSpace.items[0]?.id ?? null);
    }
  }, [selectedItemId, selectedSpace]);

  useEffect(() => {
    if (!dragState || !selectedSpace || !isOwner) return;

    const handleMove = (event: PointerEvent) => {
      onUpdateSpaceItem(selectedSpace.id, dragState.itemId, {
        x: Math.max(12, dragState.originX + (event.clientX - dragState.startX)),
        y: Math.max(12, dragState.originY + (event.clientY - dragState.startY)),
      });
    };

    const handleUp = () => setDragState(null);

    globalThis.addEventListener("pointermove", handleMove);
    globalThis.addEventListener("pointerup", handleUp);
    return () => {
      globalThis.removeEventListener("pointermove", handleMove);
      globalThis.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, isOwner, onUpdateSpaceItem, selectedSpace]);

  if (!selectedSpace) {
    return (
      <div className="panel flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Create your profile space</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Spaces are now profile pages only. Create an account to unlock your permanent page.
          </p>
          <button
            onClick={onRequireAccount}
            className="btn-smooth mt-4 rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
          >
            Open account panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <aside className="panel flex min-h-0 flex-col overflow-hidden p-3">
        <div className="mb-3">
          <p className="section-title mb-1">Profile Spaces</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Every account has exactly one public profile page you can visit.
          </p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {spaces.map((space) => {
            const active = space.id === selectedSpace.id;
            return (
              <button
                key={space.id}
                onClick={() => onSelectSpace(space.id)}
                className="btn-smooth w-full rounded-2xl border p-3 text-left"
                style={{
                  borderColor: active ? space.accentColor : "var(--border)",
                  background: active ? "rgba(255,255,255,0.9)" : "var(--surface)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <img src={space.avatarUrl} alt={space.ownerName} className="h-10 w-10 rounded-xl border object-cover" style={{ borderColor: "var(--border)" }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{space.title}</p>
                    <p className="truncate text-xs" style={{ color: "var(--muted)" }}>{space.ownerName}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-xs" style={{ color: "var(--foreground-soft)" }}>{space.tagline}</p>
              </button>
            );
          })}
        </div>
        {isAuthenticated ? null : (
          <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-sm font-semibold">Claim your profile page</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              You can browse as {viewer.name}, but sign up to get your own permanent space.
            </p>
            <button
              onClick={onRequireAccount}
              className="btn-smooth mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
            >
              Create account
            </button>
          </div>
        )}
      </aside>

      <section className="panel flex min-h-0 flex-col overflow-hidden p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center gap-3">
            <img src={selectedSpace.avatarUrl} alt={selectedSpace.ownerName} className="h-12 w-12 rounded-2xl border object-cover" style={{ borderColor: selectedSpace.accentColor }} />
            <div>
              <h2 className="text-lg font-semibold">{selectedSpace.title}</h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{selectedSpace.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-strong)" }}>
            <span className="rounded-full px-3 py-1" style={{ background: "var(--surface-active)" }}>by {selectedSpace.ownerName}</span>
            <span className="rounded-full px-3 py-1" style={{ background: "var(--surface-active)" }}>{selectedSpace.items.length} pinned items</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-[28px] border" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.55)" }}>
          <div className="relative h-230 min-w-275 overflow-hidden" style={{ background: selectedSpace.wallpaper || "var(--surface)" }}>
            <div className="absolute inset-x-0 top-0 h-32" style={{ background: `linear-gradient(180deg, ${selectedSpace.accentColor}22, transparent)` }} />
            <div className="absolute left-10 top-10 max-w-sm rounded-[28px] border px-5 py-4 shadow-[0_14px_32px_rgba(53,39,66,0.12)]" style={{ borderColor: `${selectedSpace.accentColor}55`, background: "rgba(255,255,255,0.78)" }}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                About this space
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>{selectedSpace.aboutMe}</p>
            </div>

            {youtubeId ? (
              <div className="absolute right-10 top-10 w-85 rounded-[28px] border p-3 shadow-[0_14px_32px_rgba(53,39,66,0.12)]" style={{ borderColor: `${selectedSpace.accentColor}55`, background: "rgba(255,255,255,0.82)" }}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Space soundtrack
                </p>
                <div className="aspect-video overflow-hidden rounded-2xl">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={`${selectedSpace.ownerName} music`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              </div>
            ) : null}

            {selectedSpace.items.map((item) => {
              const active = item.id === selectedItemId;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  onPointerDown={(event) => {
                    if (!isOwner) return;
                    setSelectedItemId(item.id);
                    setDragState({
                      itemId: item.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: item.x,
                      originY: item.y,
                    });
                  }}
                  className="btn-smooth absolute overflow-hidden rounded-3xl border p-3 text-left shadow-[0_12px_28px_rgba(53,39,66,0.12)]"
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    transform: `rotate(${item.rotation}deg)`,
                    borderColor: active ? selectedSpace.accentColor : "rgba(53,39,66,0.08)",
                    background: item.type === "note" || item.type === "about" ? item.color : "rgba(255,255,255,0.9)",
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(53,39,66,0.68)" }}>
                      {item.title}
                    </span>
                    {isOwner ? <span className="text-[10px]" style={{ color: "rgba(53,39,66,0.5)" }}>drag</span> : null}
                  </div>
                  <div className="h-[calc(100%-1.75rem)] overflow-hidden rounded-2xl">{getItemBody(item)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="panel flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
        {isOwner ? (
          <>
            <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="section-title mb-2">Space Settings</p>
              <div className="grid gap-2">
                <input
                  value={selectedSpace.title}
                  onChange={(e) => onUpdateOwnSpace({ title: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="Space title"
                />
                <input
                  value={selectedSpace.tagline}
                  onChange={(e) => onUpdateOwnSpace({ tagline: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="Tagline"
                />
                <textarea
                  value={selectedSpace.aboutMe}
                  onChange={(e) => onUpdateOwnSpace({ aboutMe: e.target.value })}
                  rows={3}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="About me"
                />
                <input
                  value={selectedSpace.avatarUrl}
                  onChange={(e) => onUpdateOwnSpace({ avatarUrl: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="Avatar image URL"
                />
                <input
                  value={selectedSpace.youtubeUrl}
                  onChange={(e) => onUpdateOwnSpace({ youtubeUrl: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="YouTube link"
                />
                <input
                  value={selectedSpace.accentColor}
                  onChange={(e) => onUpdateOwnSpace({ accentColor: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="#ff6b9d"
                />
                <textarea
                  value={selectedSpace.wallpaper}
                  onChange={(e) => onUpdateOwnSpace({ wallpaper: e.target.value })}
                  rows={2}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="CSS wallpaper background"
                />
              </div>
            </div>

            <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="section-title mb-2">Add To Board</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onAddItemToOwnSpace("note")} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#fff0a8" }}>+ Sticky note</button>
                <button onClick={() => onAddItemToOwnSpace("about", { width: 260, height: 220 })} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#d9f7ff" }}>+ About card</button>
                <button
                  onClick={() => {
                    const item = onAddItemToOwnSpace("image", { imageUrl: newImageUrl.trim() });
                    if (item) {
                      setSelectedItemId(item.id);
                      setNewImageUrl("");
                    }
                  }}
                  className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.9)" }}
                >
                  + Photo card
                </button>
                <button onClick={() => onAddItemToOwnSpace("drawing")} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.9)" }}>+ Blank frame</button>
              </div>
              <input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="input-soft mt-2 px-3 py-2 text-sm outline-none"
                placeholder="Image URL for a photo card"
              />
            </div>

            <DoodlePad
              onCreate={(imageUrl) => {
                const item = onAddItemToOwnSpace("drawing", { imageUrl, title: "Fresh doodle" });
                if (item) setSelectedItemId(item.id);
              }}
            />
          </>
        ) : (
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="section-title mb-2">Leave A Note</p>
            <textarea
              value={visitorMessage}
              onChange={(e) => setVisitorMessage(e.target.value)}
              rows={4}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder={`Say hi to ${selectedSpace.ownerName}`}
            />
            <button
              onClick={() => {
                onLeaveVisitorNote(selectedSpace.id, viewer.name, visitorMessage);
                setVisitorMessage("");
              }}
              className="btn-smooth mt-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
              style={{ background: selectedSpace.accentColor }}
            >
              Pin note to board
            </button>
          </div>
        )}

        {selectedItem ? (
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="section-title">Item Inspector</p>
              {isOwner ? (
                <button
                  onClick={() => onRemoveSpaceItem(selectedSpace.id, selectedItem.id)}
                  className="btn-smooth rounded-lg px-2 py-1 text-[10px] font-semibold"
                  style={{ background: "rgba(251,146,60,0.16)", color: "var(--coral)" }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-2">
              <input
                value={selectedItem.title}
                onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { title: e.target.value })}
                className="input-soft px-3 py-2 text-sm outline-none"
                placeholder="Item title"
                disabled={!isOwner}
              />
              <textarea
                value={selectedItem.content}
                onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { content: e.target.value })}
                rows={selectedItem.type === "note" || selectedItem.type === "about" ? 5 : 2}
                className="input-soft px-3 py-2 text-sm outline-none"
                placeholder="Item text"
                disabled={!isOwner}
              />
              {selectedItem.type === "image" || selectedItem.type === "drawing" ? (
                <input
                  value={selectedItem.imageUrl ?? ""}
                  onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { imageUrl: e.target.value })}
                  className="input-soft px-3 py-2 text-sm outline-none"
                  placeholder="Image URL"
                  disabled={!isOwner}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <input value={String(selectedItem.x)} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { x: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="X" disabled={!isOwner} />
                <input value={String(selectedItem.y)} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { y: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Y" disabled={!isOwner} />
                <input value={String(selectedItem.width)} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { width: Number(e.target.value) || 120 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Width" disabled={!isOwner} />
                <input value={String(selectedItem.height)} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { height: Number(e.target.value) || 120 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Height" disabled={!isOwner} />
                <input value={selectedItem.color} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { color: e.target.value })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Color" disabled={!isOwner} />
                <input value={String(selectedItem.rotation)} onChange={(e) => onUpdateSpaceItem(selectedSpace.id, selectedItem.id, { rotation: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Rotation" disabled={!isOwner} />
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}