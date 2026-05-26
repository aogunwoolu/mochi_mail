
import React, { useState } from "react";
import { StoreItem } from "@/types";
import { exportImageAsset, exportFont } from "@/lib/exportAsset";

interface MyStorefrontProps {
  myItems: StoreItem[];
  isGuest: boolean;
  onUpdate: (id: string, updates: Partial<Pick<StoreItem, "name" | "tags">>) => void;
  onRemove: (id: string) => void;
}

function itemTypeLabel(type: StoreItem["type"]): string {
  if (type === "background") return "Paper";
  if (type === "washi") return "Washi Tape";
  if (type === "font") return "Font";
  if (type === "stamp") return "Stamp";
  if (type === "envelope") return "Envelope";
  if (type === "kit") return "Scrapbook Kit";
  return "Sticker";
}

interface EditState {
  name: string;
  tags: string;
}

export default function MyStorefront({ myItems, isGuest, onUpdate, onRemove }: Readonly<MyStorefrontProps>) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", tags: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startEdit = (item: StoreItem) => {
    setEditing(item.id);
    setEditState({ name: item.name, tags: item.tags.join(", ") });
    setConfirmDelete(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditState({ name: "", tags: "" });
  };

  const saveEdit = (id: string) => {
    const tags = editState.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdate(id, { name: editState.name.trim() || undefined, tags });
    setEditing(null);
  };

  const handleRemove = (id: string) => {
    if (confirmDelete === id) {
      onRemove(id);
      setConfirmDelete(null);
      if (editing === id) setEditing(null);
    } else {
      setConfirmDelete(id);
    }
  };

  if (isGuest) {
    return (
      <div className="py-16 text-center">
        <div className="text-5xl opacity-40">🏪</div>
        <div className="mt-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Sign in to manage your storefront
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Create an account to publish and manage your items in the community store.
        </div>
      </div>
    );
  }

  if (myItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-5xl opacity-40">🛍️</div>
        <div className="mt-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Your storefront is empty
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Publish stickers, tape, papers, stamps, envelopes, fonts, or kits to see them here.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {myItems.length} {myItems.length === 1 ? "item" : "items"} published
          </p>
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Total downloads: {myItems.reduce((sum, i) => sum + i.downloads, 0)} ⬇
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {myItems.map((item) => {
          const isEditingThis = editing === item.id;
          const isConfirmingDelete = confirmDelete === item.id;
          const isKit = item.type === "kit";
          const accent = isKit ? (item.kitData?.accent ?? "#a78bfa") : "var(--lavender)";

          return (
            <div
              key={item.id}
              className="glass rounded-2xl overflow-hidden transition-all"
              style={{ border: isEditingThis ? "1.5px solid rgba(167,139,250,0.5)" : "1.5px solid var(--border)" }}
            >
              {/* Preview */}
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{
                  height: "140px",
                  background: isKit ? `${accent}12` : "rgba(255,255,255,0.03)",
                }}
              >
                {isKit && item.kitData ? (
                  <div className="grid grid-cols-2 gap-1 p-3 w-full h-full">
                    {(item.kitData.elements ?? []).slice(0, 4).map((el) => (
                      <div
                        key={el.name}
                        className="rounded-lg overflow-hidden flex items-center justify-center p-1"
                        style={{ background: `${accent}18` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={el.imageData} alt={el.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ))}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageData}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    style={{
                      imageRendering:
                        item.type === "background" || item.type === "font" || item.type === "envelope"
                          ? "auto"
                          : "pixelated",
                      opacity: item.type === "washi" ? item.opacity ?? 0.7 : 1,
                    }}
                  />
                )}
                {item.isAnimated && (
                  <span
                    className="absolute bottom-1 right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: "rgba(217,119,6,0.9)", color: "#fff" }}
                  >
                    GIF
                  </span>
                )}
                {/* Stats overlay */}
                <div
                  className="absolute top-1 right-1 flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
                >
                  <span className="text-[10px] text-white">{item.downloads} ⬇</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-3">
                {isEditingThis ? (
                  /* ── Edit mode ─────────────────────────── */
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={editState.name}
                        onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                        className="input-soft w-full px-3 py-1.5 text-sm outline-none"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(item.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                        Tags
                      </label>
                      <input
                        type="text"
                        value={editState.tags}
                        onChange={(e) => setEditState((s) => ({ ...s, tags: e.target.value }))}
                        placeholder="tag1, tag2, tag3..."
                        className="input-soft w-full px-3 py-1.5 text-sm outline-none"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(item.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <p className="mt-0.5 text-[9px]" style={{ color: "var(--muted)" }}>Comma-separated</p>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold text-white"
                        style={{ background: "var(--lavender)" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold"
                        style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ──────────────────────── */
                  <>
                    <div className="mb-0.5 flex items-start justify-between gap-1">
                      <span className="truncate text-sm font-semibold leading-tight">{item.name}</span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: `${accent}18`, color: accent }}
                      >
                        {itemTypeLabel(item.type)}
                      </span>
                    </div>

                    <div className="mb-2 text-[10px]" style={{ color: "var(--muted)" }}>
                      Published {new Date(item.createdAt).toLocaleDateString()}
                    </div>

                    {item.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{ background: "var(--surface)", color: "var(--muted)" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEdit(item)}
                        className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold"
                        style={{ background: "var(--surface)", color: "var(--lavender)", border: "1px solid var(--border)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (item.type === "font" && item.fontData) {
                            exportFont(item.fontData, item.authorName);
                          } else {
                            exportImageAsset(item.name, item.authorName, item.imageData);
                          }
                        }}
                        className="btn-smooth rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
                        title={item.type === "font" ? "Download font (.json)" : "Download PNG"}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="btn-smooth rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: isConfirmingDelete ? "rgba(239,68,68,0.15)" : "var(--surface)",
                          color: isConfirmingDelete ? "#ef4444" : "var(--muted)",
                          border: isConfirmingDelete ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)",
                        }}
                        title={isConfirmingDelete ? "Click again to confirm unpublish" : "Unpublish"}
                      >
                        {isConfirmingDelete ? "Sure?" : "✕"}
                      </button>
                    </div>

                    {isConfirmingDelete && (
                      <div className="mt-2 text-center text-[10px]" style={{ color: "#ef4444" }}>
                        This will remove the item from the community store.{" "}
                        <button
                          className="underline"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
