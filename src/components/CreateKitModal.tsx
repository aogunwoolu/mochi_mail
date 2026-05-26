
import React, { useRef, useState } from "react";
import type { ScrapbookKit, ScrapbookKitElement, Sticker, ViewerIdentity } from "@/types";
import { createScrapbookKit } from "@/data/scrapbookKitsData";
import { PASTEL_COLORS } from "@/types";

const ACCENT_OPTIONS = [
  "#ff6b9d", "#f0abfc", "#a78bfa", "#38bdf8", "#4ade80",
  "#fbbf24", "#fb923c", "#f87171", "#67d4f1", "#6ee7b7",
];

interface CreateKitModalProps {
  userStickers: Sticker[];
  viewer: ViewerIdentity;
  onClose: () => void;
  onSave: (kit: ScrapbookKit, publishToShop: boolean) => void;
}

export default function CreateKitModal({ userStickers, viewer, onClose, onSave }: Readonly<CreateKitModalProps>) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState(ACCENT_OPTIONS[0]);
  const [tags, setTags] = useState("");
  const [elements, setElements] = useState<ScrapbookKitElement[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const authorName = viewer.name || viewer.username || "You";
  const authorId = viewer.accountId ?? viewer.id ?? "guest";

  // ── Step 1 helpers ──────────────────────────────────────────────────────────

  const canProceed = name.trim().length >= 2;

  // ── Step 2 helpers ──────────────────────────────────────────────────────────

  function addFromSticker(sticker: Sticker) {
    if (elements.some((e) => e.name === sticker.name && e.imageData === sticker.imageData)) return;
    setElements((prev) => [...prev, {
      name: sticker.name,
      imageData: sticker.imageData,
      width: sticker.width,
      height: sticker.height,
    }]);
  }

  function removeElement(idx: number) {
    setElements((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please pick an image file.");
      return;
    }
    const elName = uploadName.trim() || file.name.replace(/\.[^.]+$/, "");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setElements((prev) => [...prev, {
          name: elName,
          imageData: src,
          width: img.naturalWidth || 200,
          height: img.naturalHeight || 200,
        }]);
        setUploadName("");
        setUploadError(null);
        if (fileRef.current) fileRef.current.value = "";
      };
      img.onerror = () => setUploadError("Could not load image.");
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleSave(publish: boolean) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const kit = createScrapbookKit(name.trim(), description.trim(), accent, tagList, elements, authorName, authorId);
    onSave(kit, publish);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              {step === 1 ? "Create a Kit — Details" : "Create a Kit — Add Elements"}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
              {step === 1 ? "Give your kit a name and a vibe." : "Pick stickers or upload images."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {([1, 2] as const).map((n) => (
                <div
                  key={n}
                  className="h-1.5 w-6 rounded-full transition-all"
                  style={{ background: step >= n ? accent : "var(--border)" }}
                />
              ))}
            </div>
            <button onClick={onClose} className="btn-smooth rounded-full h-7 w-7 flex items-center justify-center text-lg" style={{ color: "var(--muted)" }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">

          {step === 1 && (
            <>
              {/* Kit name */}
              <div>
                <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Kit Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Café Vibes, Ocean Day…"
                  maxLength={40}
                  className="input-soft w-full px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's the vibe of this kit?"
                  rows={2}
                  maxLength={120}
                  className="input-soft w-full px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>

              {/* Accent color */}
              <div>
                <label className="block mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Accent Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAccent(c)}
                      className="btn-smooth h-8 w-8 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: c,
                        boxShadow: accent === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : "none",
                        transform: accent === c ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Tags <span style={{ fontWeight: 400 }}>(comma separated)</span>
                </label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. cute, pastel, summer"
                  className="input-soft w-full px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>

              {/* Kit preview chip */}
              {name.trim() && (
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: `${accent}18`, border: `1.5px solid ${accent}33` }}
                >
                  <div className="h-8 w-8 rounded-xl flex-shrink-0" style={{ background: accent }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: accent }}>{name}</p>
                    {description && <p className="text-[11px]" style={{ color: accent, opacity: 0.75 }}>{description}</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Upload custom element */}
              <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Upload Image</p>
                <label htmlFor="upload-element-name" className="sr-only">Element name</label>
                <input
                  id="upload-element-name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Element name (optional)"
                  className="input-soft px-3 py-2 text-xs outline-none"
                  style={{ background: "white", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <label
                  className="btn-smooth flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                  style={{ background: `${accent}18`, color: accent, border: `1px dashed ${accent}55` }}
                >
                  📎 Choose image file
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                {uploadError && <p className="text-[11px]" style={{ color: "var(--coral)" }}>{uploadError}</p>}
              </div>

              {/* Pick from existing stickers */}
              {userStickers.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Or pick from your stickers
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {userStickers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addFromSticker(s)}
                        title={s.name}
                        className="btn-smooth h-14 w-14 rounded-xl overflow-hidden flex items-center justify-center p-1 hover:scale-110 transition-transform"
                        style={{ background: "var(--surface)", border: `1.5px solid ${accent}33` }}
                      >
                        <img src={s.imageData} alt={s.name} className="max-w-full max-h-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Elements in kit */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Kit Elements ({elements.length})
                </p>
                {elements.length === 0 ? (
                  <p className="text-xs py-4 text-center rounded-xl" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                    No elements yet — upload images or pick from stickers above.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {elements.map((el, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                        style={{ background: `${accent}0a`, border: `1px solid ${accent}20` }}
                      >
                        <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden flex items-center justify-center p-0.5" style={{ background: "white" }}>
                          <img src={el.imageData} alt={el.name} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: accent }}>{el.name}</p>
                          <p className="text-[9px]" style={{ color: accent, opacity: 0.55 }}>{el.width}×{el.height}px</p>
                        </div>
                        <button
                          onClick={() => removeElement(i)}
                          className="btn-smooth text-[11px] px-2 py-0.5 rounded-lg"
                          style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-5 pt-3 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-smooth flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="btn-smooth flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-30"
                style={{ background: accent, color: "#fff" }}
              >
                Next → Add Elements
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-smooth rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
                ← Back
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={elements.length === 0}
                className="btn-smooth flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-30"
                style={{ background: `${accent}20`, color: accent }}
              >
                Save Privately
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={elements.length === 0}
                className="btn-smooth flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-30"
                style={{ background: accent, color: "#fff" }}
              >
                ✨ Publish to Shop
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
