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
  liveX: number;
  liveY: number;
};

const SPACE_ACCENT_PRESETS = [
  "#ff6b9d",
  "#67d4f1",
  "#6ee7b7",
  "#a78bfa",
  "#fb923c",
  "#fbbf24",
  "#f472b6",
  "#34d399",
] as const;

const NOTE_COLOR_PRESETS = ["#ffe08a", "#d9f7ff", "#ffd6ec", "#e4dcff", "#d9f99d", "#ffd7ba"] as const;

const DOODLE_INK_PRESETS = ["#352742", "#ff6b9d", "#7c3aed", "#0f766e", "#ea580c", "#2563eb"] as const;

const SPACE_WALLPAPER_PRESETS = [
  {
    id: "petal-blush",
    name: "Petal Blush",
    value: "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  },
  {
    id: "mint-airmail",
    name: "Mint Airmail",
    value: "linear-gradient(135deg, rgba(237,247,255,0.95), rgba(203,244,255,0.92), rgba(244,255,252,0.96))",
  },
  {
    id: "apricot-note",
    name: "Apricot Note",
    value: "linear-gradient(145deg, rgba(255,248,228,0.96), rgba(255,224,208,0.92), rgba(255,245,236,0.96))",
  },
  {
    id: "lilac-dream",
    name: "Lilac Dream",
    value: "linear-gradient(145deg, rgba(246,241,255,0.96), rgba(226,223,255,0.92), rgba(255,245,252,0.96))",
  },
  {
    id: "blue-sky",
    name: "Blue Sky",
    value: "linear-gradient(180deg, rgba(223,242,255,0.98), rgba(255,255,255,0.95) 55%, rgba(234,255,246,0.96) 100%)",
  },
  {
    id: "matcha-paper",
    name: "Matcha Paper",
    value: "linear-gradient(160deg, rgba(244,255,239,0.97), rgba(221,245,216,0.94), rgba(255,251,235,0.96))",
  },
] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

async function createUploadedPhotoCard(
  file: File | null,
  onAddItemToOwnSpace: (type: SpaceItemType, seed?: Partial<SpaceItem>) => SpaceItem | undefined,
  onSelectItem: (itemId: string) => void
) {
  if (!file) return;
  const imageUrl = await readFileAsDataUrl(file);
  if (!imageUrl) return;
  const item = onAddItemToOwnSpace("image", {
    imageUrl,
    title: file.name.replace(/\.[^.]+$/, "") || "Photo card",
  });
  if (item) onSelectItem(item.id);
}

async function replaceSelectedItemImage(
  file: File | null,
  spaceId: string,
  itemId: string,
  onUpdateSpaceItem: (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => void
) {
  if (!file) return;
  const imageUrl = await readFileAsDataUrl(file);
  if (!imageUrl) return;
  onUpdateSpaceItem(spaceId, itemId, { imageUrl });
}

function SwatchButton({
  color,
  active,
  onClick,
  label,
}: Readonly<{ color: string; active: boolean; onClick: () => void; label: string }>) {
  return (
    <button
      onClick={onClick}
      className="btn-smooth h-9 w-9 rounded-full border-2"
      style={{
        background: color,
        borderColor: active ? "rgba(53,39,66,0.85)" : "rgba(53,39,66,0.12)",
        boxShadow: active ? "0 0 0 3px rgba(255,255,255,0.92), 0 0 0 5px rgba(53,39,66,0.12)" : "none",
      }}
      title={label}
      aria-label={label}
    />
  );
}

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
        <div className="flex items-center gap-2">
          {DOODLE_INK_PRESETS.map((color) => (
            <SwatchButton
              key={color}
              color={color}
              active={ink === color}
              onClick={() => setInk(color)}
              label={`Ink ${color}`}
            />
          ))}
        </div>
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

interface OwnerToolsPanelProps {
  selectedSpace: UserSpace;
  selectedWallpaperId: string | null;
  selectedItemId: string | null;
  setSelectedItemId: (itemId: string | null) => void;
  newImageUrl: string;
  setNewImageUrl: (value: string) => void;
  onUpdateOwnSpace: (patch: Partial<UserSpace>) => void;
  onAddItemToOwnSpace: (type: SpaceItemType, seed?: Partial<SpaceItem>) => SpaceItem | undefined;
  onUpdateSpaceItem: (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => void;
}

interface ItemInspectorProps {
  selectedSpace: UserSpace;
  selectedItem: SpaceItem;
  isOwner: boolean;
  onUpdateSpaceItem: (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => void;
  onRemoveSpaceItem: (spaceId: string, itemId: string) => void;
}

function OwnerToolsPanel(props: Readonly<OwnerToolsPanelProps>) {
  return (
    <>
      <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="section-title mb-2">Space Settings</p>
        <div className="grid gap-2">
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.72)" }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Accent Color
            </p>
            <div className="flex flex-wrap gap-2">
              {SPACE_ACCENT_PRESETS.map((color) => (
                <SwatchButton
                  key={color}
                  color={color}
                  active={props.selectedSpace.accentColor === color}
                  onClick={() => props.onUpdateOwnSpace({ accentColor: color })}
                  label={`Accent ${color}`}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.72)" }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Wallpaper
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SPACE_WALLPAPER_PRESETS.map((preset) => {
                const active = props.selectedWallpaperId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => props.onUpdateOwnSpace({ wallpaper: preset.value })}
                    className="btn-smooth overflow-hidden rounded-2xl border text-left"
                    style={{
                      borderColor: active ? props.selectedSpace.accentColor : "var(--border)",
                      background: "rgba(255,255,255,0.88)",
                    }}
                  >
                    <div className="h-16 w-full" style={{ background: preset.value }} />
                    <div className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--foreground-soft)" }}>
                      {preset.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🏷️ Space Title</p>
            <input
              value={props.selectedSpace.title}
              onChange={(e) => props.onUpdateOwnSpace({ title: e.target.value })}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder="My cozy corner"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>💬 Tagline</p>
            <input
              value={props.selectedSpace.tagline}
              onChange={(e) => props.onUpdateOwnSpace({ tagline: e.target.value })}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder="A tiny note about your space"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>📝 About Me</p>
            <textarea
              value={props.selectedSpace.aboutMe}
              onChange={(e) => props.onUpdateOwnSpace({ aboutMe: e.target.value })}
              rows={3}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder="Tell visitors what this page is about"
            />
          </div>
          <label
            className="btn-smooth flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
          >
            <span>Upload profile image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file) {
                  void readFileAsDataUrl(file).then((imageUrl) => {
                    if (imageUrl) props.onUpdateOwnSpace({ avatarUrl: imageUrl });
                  });
                }
                e.currentTarget.value = "";
              }}
            />
          </label>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🖼️ Avatar URL</p>
            <input
              value={props.selectedSpace.avatarUrl}
              onChange={(e) => props.onUpdateOwnSpace({ avatarUrl: e.target.value })}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder="Or paste an avatar image URL"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🎵 YouTube Link</p>
            <input
              value={props.selectedSpace.youtubeUrl}
              onChange={(e) => props.onUpdateOwnSpace({ youtubeUrl: e.target.value })}
              className="input-soft px-3 py-2 text-sm outline-none"
              placeholder="Paste a YouTube link"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="section-title mb-2">Add To Board</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => props.onAddItemToOwnSpace("note")} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#fff0a8" }}>+ Sticky note</button>
          <button onClick={() => props.onAddItemToOwnSpace("about", { width: 260, height: 220 })} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#d9f7ff" }}>+ About card</button>
          <button
            onClick={() => {
              const item = props.onAddItemToOwnSpace("image", { imageUrl: props.newImageUrl.trim() });
              if (item) {
                props.setSelectedItemId(item.id);
                props.setNewImageUrl("");
              }
            }}
            className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.9)" }}
          >
            + Photo card
          </button>
          <button onClick={() => props.onAddItemToOwnSpace("drawing")} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.9)" }}>+ Blank frame</button>
        </div>
        <div>
          <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🔗 Photo URL</p>
          <input
            value={props.newImageUrl}
            onChange={(e) => props.setNewImageUrl(e.target.value)}
            className="input-soft px-3 py-2 text-sm outline-none"
            placeholder="Paste an image URL for a photo card"
          />
        </div>
        <label
          className="btn-smooth mt-2 flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
        >
          <span>Upload photo card image</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void createUploadedPhotoCard(e.target.files?.[0] ?? null, props.onAddItemToOwnSpace, props.setSelectedItemId);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <DoodlePad
        onCreate={(imageUrl) => {
          const item = props.onAddItemToOwnSpace("drawing", { imageUrl, title: "Fresh doodle" });
          if (item) props.setSelectedItemId(item.id);
        }}
      />
    </>
  );
}

function ItemInspector(props: Readonly<ItemInspectorProps>) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="section-title">Item Inspector</p>
        {props.isOwner ? (
          <button
            onClick={() => props.onRemoveSpaceItem(props.selectedSpace.id, props.selectedItem.id)}
            className="btn-smooth rounded-lg px-2 py-1 text-[10px] font-semibold"
            style={{ background: "rgba(251,146,60,0.16)", color: "var(--coral)" }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🏷️ Item Title</p>
          <input
            value={props.selectedItem.title}
            onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { title: e.target.value })}
            className="input-soft px-3 py-2 text-sm outline-none"
            placeholder="Item title"
            disabled={!props.isOwner}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>📝 Item Text</p>
          <textarea
            value={props.selectedItem.content}
            onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { content: e.target.value })}
            rows={props.selectedItem.type === "note" || props.selectedItem.type === "about" ? 5 : 2}
            className="input-soft px-3 py-2 text-sm outline-none"
            placeholder="Item text"
            disabled={!props.isOwner}
          />
        </div>
        {props.selectedItem.type === "image" || props.selectedItem.type === "drawing" ? (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>🖼️ Image URL</p>
              <input
                value={props.selectedItem.imageUrl ?? ""}
                onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { imageUrl: e.target.value })}
                className="input-soft px-3 py-2 text-sm outline-none"
                placeholder="Image URL"
                disabled={!props.isOwner}
              />
            </div>
            {props.isOwner ? (
              <label
                className="btn-smooth flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
              >
                <span>Upload replacement image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void replaceSelectedItemImage(
                      e.target.files?.[0] ?? null,
                      props.selectedSpace.id,
                      props.selectedItem.id,
                      props.onUpdateSpaceItem
                    );
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            ) : null}
          </>
        ) : null}
        <div className="rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.72)" }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>📐 Position & Size</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>📍 X</p>
              <input value={String(props.selectedItem.x)} onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { x: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="X" disabled={!props.isOwner} />
            </div>
            <div>
              <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>📍 Y</p>
              <input value={String(props.selectedItem.y)} onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { y: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Y" disabled={!props.isOwner} />
            </div>
            <div>
              <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>↔️ Width</p>
              <input value={String(props.selectedItem.width)} onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { width: Number(e.target.value) || 120 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Width" disabled={!props.isOwner} />
            </div>
            <div>
              <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>↕️ Height</p>
              <input value={String(props.selectedItem.height)} onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { height: Number(e.target.value) || 120 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Height" disabled={!props.isOwner} />
            </div>
            <div className="col-span-2">
              <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>🌀 Rotation</p>
              <input value={String(props.selectedItem.rotation)} onChange={(e) => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { rotation: Number(e.target.value) || 0 })} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Rotation" disabled={!props.isOwner} />
            </div>
          </div>
        </div>
        {props.selectedItem.type === "note" || props.selectedItem.type === "about" ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Card Color
            </p>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLOR_PRESETS.map((color) => (
                <SwatchButton
                  key={color}
                  color={color}
                  active={props.selectedItem.color === color}
                  onClick={() => props.onUpdateSpaceItem(props.selectedSpace.id, props.selectedItem.id, { color })}
                  label={`Item color ${color}`}
                />
              ))}
            </div>
          </div>
        ) : null}
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
  const selectedWallpaperId = SPACE_WALLPAPER_PRESETS.find((preset) => preset.value === selectedSpace?.wallpaper)?.id ?? null;

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
      setDragState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          liveX: Math.max(12, prev.originX + (event.clientX - prev.startX)),
          liveY: Math.max(12, prev.originY + (event.clientY - prev.startY)),
        };
      });
    };

    const handleUp = () => {
      setDragState((prev) => {
        if (!prev) return null;
        // commit final position to parent (and eventually DB) once on release
        onUpdateSpaceItem(selectedSpace.id, prev.itemId, { x: prev.liveX, y: prev.liveY });
        return null;
      });
    };

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
    <div className="grid h-full gap-4 overflow-auto lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
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
              <>
                {/* Hidden background audio — no video square visible */}
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&loop=1&playlist=${youtubeId}&controls=0&mute=0`}
                  title={`${selectedSpace.ownerName} soundtrack`}
                  allow="autoplay"
                  className="pointer-events-none absolute opacity-0"
                  style={{ width: 1, height: 1, left: -9999, top: -9999 }}
                />
                {/* Mini now-playing chip */}
                <div
                  className="absolute bottom-5 right-6 flex items-center gap-2 rounded-full border px-4 py-2 shadow-[0_8px_20px_rgba(53,39,66,0.14)]"
                  style={{ borderColor: `${selectedSpace.accentColor}55`, background: "rgba(255,255,255,0.88)" }}
                >
                  <span className="text-lg" aria-hidden>🎵</span>
                  <span className="text-[11px] font-semibold" style={{ color: selectedSpace.accentColor }}>
                    Now playing
                  </span>
                  <a
                    href={selectedSpace.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-smooth rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${selectedSpace.accentColor}22`, color: selectedSpace.accentColor }}
                  >
                    Open
                  </a>
                </div>
              </>
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
                      liveX: item.x,
                      liveY: item.y,
                    });
                  }}
                  className="btn-smooth absolute overflow-hidden rounded-3xl border p-3 text-left shadow-[0_12px_28px_rgba(53,39,66,0.12)]"
                  style={{
                    left: dragState?.itemId === item.id ? dragState.liveX : item.x,
                    top: dragState?.itemId === item.id ? dragState.liveY : item.y,
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

      <aside className="panel flex min-h-0 flex-col gap-3 overflow-y-auto p-3 lg:col-span-2 xl:col-span-1">
        {isOwner ? (
          <OwnerToolsPanel
            selectedSpace={selectedSpace}
            selectedWallpaperId={selectedWallpaperId}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            newImageUrl={newImageUrl}
            setNewImageUrl={setNewImageUrl}
            onUpdateOwnSpace={onUpdateOwnSpace}
            onAddItemToOwnSpace={onAddItemToOwnSpace}
            onUpdateSpaceItem={onUpdateSpaceItem}
          />
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

        {selectedItem ? <ItemInspector selectedSpace={selectedSpace} selectedItem={selectedItem} isOwner={isOwner} onUpdateSpaceItem={onUpdateSpaceItem} onRemoveSpaceItem={onRemoveSpaceItem} /> : null}
      </aside>
    </div>
  );
}