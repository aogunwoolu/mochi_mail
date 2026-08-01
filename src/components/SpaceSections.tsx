"use client";

import { useEffect, useState } from "react";
import { UserSpace } from "@/types";
import {
  FONT_CATEGORY_LABELS,
  FONT_OPTIONS,
  FontCategory,
  FontConfig,
  SECTION_TYPE_META,
  SectionFont,
  SectionWidth,
  SpaceLink,
  SpaceSection,
  clampWeight,
  fontCss,
  fontOption,
  isVisitorNote,
  loadFontByLabel,
} from "@/lib/spaceConfig";
import { generateId } from "@/lib/id";

// Static class strings so Tailwind can see them (dynamic names get purged)
const WIDTH_CLASS: Record<SectionWidth, string> = {
  full: "col-span-6",
  twothirds: "col-span-6 md:col-span-4",
  half: "col-span-6 md:col-span-3",
  third: "col-span-6 md:col-span-2",
};

const WIDTH_LABELS: ReadonlyArray<{ value: SectionWidth; label: string }> = [
  { value: "full", label: "Full" },
  { value: "twothirds", label: "⅔" },
  { value: "half", label: "½" },
  { value: "third", label: "⅓" },
];

// ─── Embed helpers ────────────────────────────────────────────────────────────

function musicEmbedSrc(url: string): { src: string; height: number } | null {
  const s = url.trim();
  if (!s) return null;
  const yt =
    /youtu\.be\/([^?&]+)/.exec(s)?.[1] ??
    /[?&]v=([^?&]+)/.exec(s)?.[1] ??
    /embed\/([^?&]+)/.exec(s)?.[1];
  if (yt) return { src: `https://www.youtube.com/embed/${yt}`, height: 200 };
  const spotify = /open\.spotify\.com\/(?:embed\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/.exec(s);
  if (spotify) return { src: `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`, height: spotify[1] === "track" ? 152 : 352 };
  return null;
}

export function makeSection(type: SpaceSection["type"]): SpaceSection {
  const base: SpaceSection = { id: generateId(), type };
  switch (type) {
    case "text": return { ...base, title: "✨ New section", text: "Write something lovely here…" };
    case "links": return { ...base, title: "🔗 Links", links: [{ label: "My favourite place", url: "https://" }] };
    case "gallery": return { ...base, title: "📷 Gallery", images: [] };
    case "guestbook": return { ...base, title: "💌 Guestbook" };
    case "friends": return { ...base, title: "👯 Top friends", friends: [] };
    case "marquee": return { ...base, text: "⋆｡ﾟ☁︎｡⋆ welcome to my space ⋆｡ﾟ☾ﾟ｡⋆" };
    case "music": return { ...base, title: "🎶 Song of the moment", url: "" };
    case "board": return { ...base, title: "🎨 My board", size: "m" };
    default: return base;
  }
}

// ─── Small building blocks ────────────────────────────────────────────────────

function SectionCard({ accent, children, plain }: Readonly<{ accent: string; children: React.ReactNode; plain?: boolean }>) {
  if (plain) return <div className="relative">{children}</div>;
  return (
    <div
      className="relative overflow-hidden rounded-[24px] border shadow-[0_12px_32px_rgba(53,39,66,0.10)]"
      style={{ borderColor: `${accent}33`, background: "rgba(255,255,255,0.84)", backdropFilter: "blur(12px)" }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ title, fontStyle }: Readonly<{ title?: string; fontStyle: React.CSSProperties }>) {
  if (!title) return null;
  return (
    <p className="mb-3 font-bold" style={{ ...fontStyle, fontSize: Math.min((Number(fontStyle.fontSize) || 14) + 4, 26) }}>
      {title}
    </p>
  );
}

// ─── Typography editor (per-section font / weight / size / colour / align) ───

function TypographyEditor({
  value, pageFont, accent, onChange,
}: Readonly<{
  value: SectionFont | undefined;
  pageFont: FontConfig;
  accent: string;
  onChange: (font: SectionFont | undefined) => void;
}>) {
  const font = value ?? {};
  const set = (patch: Partial<SectionFont>) => onChange({ ...font, ...patch });
  const activeFamily = font.family ?? pageFont.family;
  const weights = fontOption(activeFamily)?.weights ?? [400, 700];
  const categories = [...new Set(FONT_OPTIONS.map((f) => f.category))] as FontCategory[];

  return (
    <div className="space-y-2.5 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>🔤 Text style</p>
        <button onClick={() => onChange(undefined)}
          className="btn-smooth rounded-lg px-2 py-0.5 text-[10px]" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
          Use page font
        </button>
      </div>

      <div>
        <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>Font</p>
        <select
          value={font.family ?? ""}
          onChange={(e) => {
            const family = e.target.value || undefined;
            if (family) loadFontByLabel(family);
            set({ family, ...(font.weight ? { weight: clampWeight(family ?? pageFont.family, font.weight) } : {}) });
          }}
          className="input-soft w-full px-2.5 py-2 text-sm outline-none"
          style={{ fontFamily: fontCss(activeFamily) }}
        >
          <option value="">Page font ({pageFont.family})</option>
          {categories.map((cat) => (
            <optgroup key={cat} label={FONT_CATEGORY_LABELS[cat]}>
              {FONT_OPTIONS.filter((f) => f.category === cat).map((f) => (
                <option key={f.label} value={f.label}>{f.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>Weight</p>
        <div className="flex flex-wrap gap-1">
          {weights.map((w) => (
            <button key={w} onClick={() => set({ weight: w })}
              className="btn-smooth rounded-lg px-2.5 py-1 text-xs"
              style={{
                fontWeight: w,
                background: (font.weight ?? 400) === w ? `${accent}22` : "white",
                color: (font.weight ?? 400) === w ? accent : "var(--foreground-soft)",
                border: `1px solid ${(font.weight ?? 400) === w ? accent : "var(--border)"}`,
              }}>
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>Size — {font.size ?? pageFont.size}px</p>
          <input type="range" min={10} max={32} value={font.size ?? pageFont.size}
            onChange={(e) => set({ size: Number(e.target.value) })} className="w-full" />
        </div>
        <label className="flex shrink-0 flex-col items-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
          Colour
          <input type="color" value={font.color ?? pageFont.color}
            onChange={(e) => set({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border-0" />
        </label>
      </div>

      <div>
        <p className="mb-1 text-[10px]" style={{ color: "var(--muted)" }}>Align</p>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "white" }}>
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} onClick={() => set({ align: a })}
              className="btn-smooth flex-1 rounded-lg py-1 text-[11px] font-semibold capitalize"
              style={{ background: (font.align ?? "left") === a ? "var(--surface-active)" : "transparent", color: "var(--foreground-soft)" }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border px-3 py-2" style={{
        borderColor: "var(--border)", background: "rgba(255,255,255,0.8)",
        fontFamily: fontCss(activeFamily),
        fontWeight: clampWeight(activeFamily, font.weight),
        fontSize: font.size ?? pageFont.size,
        color: font.color ?? pageFont.color,
        textAlign: font.align ?? "left",
      }}>
        The quick brown fox jumps ✨
      </div>
    </div>
  );
}

function EditField({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Per-type inline editors (owner only) ────────────────────────────────────

function SectionEditor({
  section, accent, pageFont, onChange, onUploadImage,
}: Readonly<{
  section: SpaceSection;
  accent: string;
  pageFont: FontConfig;
  onChange: (patch: Partial<SpaceSection>) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}>) {
  const [uploading, setUploading] = useState(false);
  const links = section.links ?? [];
  const images = section.images ?? [];
  const friends = section.friends ?? [];

  return (
    <div className="space-y-3 border-t px-4 pb-4 pt-3" style={{ borderColor: `${accent}22`, background: "rgba(255,255,255,0.6)" }}>
      <EditField label="Section width">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface)" }}>
          {WIDTH_LABELS.map(({ value, label }) => (
            <button key={value} onClick={() => onChange({ width: value })}
              className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold"
              style={{
                background: (section.width ?? "full") === value ? "white" : "transparent",
                color: (section.width ?? "full") === value ? "var(--foreground)" : "var(--muted)",
                boxShadow: (section.width ?? "full") === value ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>Narrow sections sit side by side when they fit on a row.</p>
      </EditField>

      {section.type !== "marquee" && section.type !== "profile" && (
        <EditField label="Section title">
          <input value={section.title ?? ""} onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Give this section a name" className="input-soft w-full px-3 py-2 text-sm outline-none" />
        </EditField>
      )}

      {(section.type === "text" || section.type === "marquee") && (
        <EditField label={section.type === "marquee" ? "Scrolling text" : "Text"}>
          <textarea value={section.text ?? ""} onChange={(e) => onChange({ text: e.target.value })}
            rows={section.type === "marquee" ? 2 : 4} placeholder="Write something…"
            className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
        </EditField>
      )}

      {section.type === "music" && (
        <EditField label="YouTube or Spotify link">
          <input value={section.url ?? ""} onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://open.spotify.com/… or https://youtu.be/…"
            className="input-soft w-full px-3 py-2 text-sm outline-none" />
        </EditField>
      )}

      {section.type === "board" && (
        <EditField label="Board height">
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface)" }}>
            {(["s", "m", "l"] as const).map((s) => (
              <button key={s} onClick={() => onChange({ size: s })}
                className="btn-smooth flex-1 rounded-lg py-1.5 text-xs font-semibold uppercase"
                style={{
                  background: (section.size ?? "m") === s ? "white" : "transparent",
                  color: (section.size ?? "m") === s ? "var(--foreground)" : "var(--muted)",
                  boxShadow: (section.size ?? "m") === s ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                }}>
                {s === "s" ? "Small" : s === "m" ? "Medium" : "Tall"}
              </button>
            ))}
          </div>
        </EditField>
      )}

      {section.type === "links" && (
        <EditField label="Links">
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input value={link.label} placeholder="Label"
                  onChange={(e) => {
                    const next = links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l));
                    onChange({ links: next });
                  }}
                  className="input-soft w-28 min-w-0 px-2.5 py-1.5 text-xs outline-none" />
                <input value={link.url} placeholder="https://…"
                  onChange={(e) => {
                    const next = links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l));
                    onChange({ links: next });
                  }}
                  className="input-soft min-w-0 flex-1 px-2.5 py-1.5 text-xs outline-none" />
                <button onClick={() => onChange({ links: links.filter((_, j) => j !== i) })}
                  className="btn-smooth shrink-0 rounded-lg px-2 text-xs" style={{ background: "rgba(251,146,60,0.12)", color: "#ea580c" }}>✕</button>
              </div>
            ))}
            <button onClick={() => onChange({ links: [...links, { label: "", url: "https://" }] })}
              className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: `${accent}18`, color: accent }}>
              + Add link
            </button>
          </div>
        </EditField>
      )}

      {section.type === "gallery" && (
        <EditField label="Photos">
          <div className="space-y-2">
            {images.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                <input value={url}
                  onChange={(e) => onChange({ images: images.map((u, j) => (j === i ? e.target.value : u)) })}
                  className="input-soft min-w-0 flex-1 px-2.5 py-1.5 text-xs outline-none" />
                <button onClick={() => onChange({ images: images.filter((_, j) => j !== i) })}
                  className="btn-smooth shrink-0 rounded-lg px-2 text-xs" style={{ background: "rgba(251,146,60,0.12)", color: "#ea580c" }}>✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => onChange({ images: [...images, ""] })}
                className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: `${accent}18`, color: accent }}>
                + Add image URL
              </button>
              <label className="btn-smooth cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--surface-active)", color: "var(--muted-strong)", opacity: uploading ? 0.6 : 1 }}>
                {uploading ? "Uploading…" : "⬆️ Upload"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const url = await onUploadImage(file);
                    setUploading(false);
                    if (url) onChange({ images: [...images, url] });
                    input.value = "";
                  }} />
              </label>
            </div>
          </div>
        </EditField>
      )}

      {section.type !== "profile" && (
        <TypographyEditor
          value={section.font}
          pageFont={pageFont}
          accent={accent}
          onChange={(font) => onChange({ font })}
        />
      )}

      {section.type === "friends" && (
        <EditField label="Friend usernames (they link to their spaces)">
          <div className="space-y-2">
            {friends.map((name, i) => (
              <div key={i} className="flex gap-2">
                <span className="flex items-center text-xs" style={{ color: "var(--muted)" }}>@</span>
                <input value={name} placeholder="username"
                  onChange={(e) => onChange({ friends: friends.map((f, j) => (j === i ? e.target.value : f)) })}
                  className="input-soft min-w-0 flex-1 px-2.5 py-1.5 text-xs outline-none" />
                <button onClick={() => onChange({ friends: friends.filter((_, j) => j !== i) })}
                  className="btn-smooth shrink-0 rounded-lg px-2 text-xs" style={{ background: "rgba(251,146,60,0.12)", color: "#ea580c" }}>✕</button>
              </div>
            ))}
            {friends.length < 8 && (
              <button onClick={() => onChange({ friends: [...friends, ""] })}
                className="btn-smooth rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: `${accent}18`, color: accent }}>
                + Add friend {friends.length ? `(${friends.length}/8)` : ""}
              </button>
            )}
          </div>
        </EditField>
      )}
    </div>
  );
}

// ─── Section renderer ─────────────────────────────────────────────────────────

interface SpaceSectionsProps {
  space: UserSpace;
  sections: SpaceSection[];
  isOwner: boolean;
  accent: string;
  pageFont: FontConfig;
  onUpdateSections: (next: SpaceSection[]) => void;
  onOpenVisitorNote: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  /** Renders the pinboard canvas for one board section — each board section id
   *  gets its own independent set of items. */
  renderBoard: (size: "s" | "m" | "l", sectionId: string) => React.ReactNode;
}

export default function SpaceSections({
  space, sections, isOwner, accent, pageFont,
  onUpdateSections, onOpenVisitorNote, onUploadImage, renderBoard,
}: Readonly<SpaceSectionsProps>) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Base (page-level) text style; sections may override any part of it
  const fontStyle: React.CSSProperties = {
    fontFamily: fontCss(pageFont.family),
    fontSize: pageFont.size,
    color: pageFont.color,
    fontWeight: clampWeight(pageFont.family, pageFont.weight),
  };

  // Visitors need any per-section Google Fonts loaded too
  useEffect(() => {
    for (const s of sections) loadFontByLabel(s.font?.family);
  }, [sections]);

  /** Section body text style = page font + this section's overrides. */
  const sectionStyle = (section: SpaceSection): React.CSSProperties => {
    const f = section.font ?? {};
    return {
      fontFamily: f.family ? fontCss(f.family) : fontStyle.fontFamily,
      fontWeight: f.weight ? clampWeight(f.family ?? pageFont.family, f.weight) : fontStyle.fontWeight,
      fontSize: f.size ?? fontStyle.fontSize,
      color: f.color ?? fontStyle.color,
      ...(f.align ? { textAlign: f.align } : {}),
    };
  };

  /** Heading style — follows the section font but stays accent-coloured unless overridden. */
  const headingStyle = (section: SpaceSection): React.CSSProperties => ({
    ...sectionStyle(section),
    color: section.font?.color ?? accent,
  });

  const updateSection = (id: string, patch: Partial<SpaceSection>) =>
    onUpdateSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSection = (id: string) => {
    onUpdateSections(sections.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };
  const moveSection = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onUpdateSections(next);
  };

  const visitorNotes = space.items.filter(isVisitorNote);

  const renderBody = (section: SpaceSection) => {
    switch (section.type) {
      case "profile":
        return (
          <div className="p-5">
            <div className="flex items-center gap-4">
              {space.avatarUrl ? (
                <img src={space.avatarUrl} alt={space.ownerName} className="h-20 w-20 shrink-0 rounded-3xl border-2 object-cover" style={{ borderColor: accent }} />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-2 text-3xl font-bold text-white" style={{ borderColor: accent, background: accent }}>
                  {space.ownerName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold" style={{ ...fontStyle, fontSize: Math.min((Number(fontStyle.fontSize) || 14) + 8, 30) }}>
                  {space.title || space.ownerName}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--muted)" }}>
                  <span className="truncate">@{space.slug}</span>
                  {space.ownerIsSupporter ? (
                    <span title="Mochi Plus supporter" aria-label="Mochi Plus supporter" style={{ color: "var(--pink)" }}>♡</span>
                  ) : null}
                </p>
                {space.tagline ? (
                  <p className="mt-1.5 text-sm leading-snug" style={{ color: "var(--foreground-soft)" }}>{space.tagline}</p>
                ) : null}
              </div>
            </div>
            {space.aboutMe ? (
              <p className="mt-4 border-t pt-3 text-sm leading-relaxed" style={{ borderColor: `${accent}22`, ...fontStyle }}>
                {space.aboutMe}
              </p>
            ) : null}
          </div>
        );

      case "board":
        return (
          <div className="p-2">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            <div
              className="relative overflow-hidden rounded-2xl border"
              style={{
                borderColor: `${accent}33`,
                height: section.size === "s" ? "40vh" : section.size === "l" ? "82vh" : "62vh",
              }}
            >
              {renderBoard(section.size ?? "m", section.id)}
            </div>
          </div>
        );

      case "text":
        return (
          <div className="p-5">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            <p className="whitespace-pre-wrap leading-relaxed" style={sectionStyle(section)}>{section.text}</p>
          </div>
        );

      case "links": {
        const links = (section.links ?? []).filter((l): l is SpaceLink => Boolean(l?.url && l.url !== "https://"));
        return (
          <div className="p-5">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            {links.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>{isOwner ? "Add some links with the ✎ button." : "Nothing here yet."}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="btn-smooth rounded-2xl border px-4 py-2 font-semibold"
                    style={{ borderColor: `${accent}44`, background: `${accent}10`, ...headingStyle(section), fontSize: 14 }}>
                    {link.label || link.url} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "gallery": {
        const images = (section.images ?? []).filter(Boolean);
        return (
          <div className="p-5">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            {images.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>{isOwner ? "Add photos with the ✎ button." : "No photos yet."}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((url, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border" style={{ borderColor: `${accent}33`, transform: `rotate(${(i % 3 - 1) * 1.4}deg)` }}>
                    <img src={url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "guestbook":
        return (
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading title={section.title ?? "💌 Guestbook"} fontStyle={headingStyle(section)} />
              {!isOwner && (
                <button onClick={onOpenVisitorNote}
                  className="btn-smooth -mt-3 shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, var(--lavender))` }}>
                  ✍️ Sign it
                </button>
              )}
            </div>
            {visitorNotes.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {isOwner ? "No notes yet — share your space so friends can sign it!" : "Be the first to leave a note 💌"}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visitorNotes.map((note, i) => (
                  <div key={note.id} className="rounded-2xl p-3 shadow-sm" style={{ background: "#fff8c4", transform: `rotate(${(i % 2 ? 1 : -1) * 0.8}deg)` }}>
                    <p className="text-xs font-bold" style={{ color: "#78350f" }}>{note.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-snug" style={{ color: "#44403c" }}>{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "friends": {
        const friends = (section.friends ?? []).map((f) => f.trim()).filter(Boolean);
        return (
          <div className="p-5">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            {friends.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>{isOwner ? "Add up to 8 friends with the ✎ button." : "No friends listed yet."}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {friends.slice(0, 8).map((name) => (
                  <a key={name} href={`/space/${encodeURIComponent(name)}`}
                    className="btn-smooth flex flex-col items-center gap-2 rounded-2xl border p-3"
                    style={{ borderColor: `${accent}33`, background: "rgba(255,255,255,0.7)" }}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ background: accent }}>
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-full truncate text-xs font-semibold" style={{ color: "var(--foreground-soft)" }}>@{name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "marquee": {
        // Two identical halves so the -50% translate loops seamlessly
        const half = Array.from({ length: 3 }, () => section.text || "✨").join("  ·  ") + "  ·  ";
        return (
          <div className="overflow-hidden py-2.5" style={{ background: `${accent}14` }}>
            <div className="space-marquee whitespace-nowrap font-semibold" style={headingStyle(section)}>
              {half}{half}
            </div>
          </div>
        );
      }

      case "music": {
        const embed = musicEmbedSrc(section.url ?? "");
        return (
          <div className="p-5">
            <SectionHeading title={section.title} fontStyle={headingStyle(section)} />
            {embed ? (
              <iframe
                src={embed.src}
                title={section.title || "music"}
                height={embed.height}
                className="w-full rounded-2xl border-0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {isOwner ? "Paste a YouTube or Spotify link with the ✎ button." : "No song picked yet."}
              </p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-6 items-start gap-5">
      {sections.map((section, i) => (
        <div key={section.id} className={`group relative ${WIDTH_CLASS[section.width ?? "full"]}`}>
          <SectionCard accent={accent}>
            {renderBody(section)}
            {isOwner && editingId === section.id && (
              <SectionEditor
                section={section}
                accent={accent}
                pageFont={pageFont}
                onChange={(patch) => updateSection(section.id, patch)}
                onUploadImage={onUploadImage}
              />
            )}
          </SectionCard>

          {/* Owner controls — float over the section's top-right corner */}
          {isOwner && (
            <div
              className="absolute -top-2.5 right-3 z-10 flex items-center gap-1 rounded-full border px-1.5 py-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              style={{ background: "rgba(255,255,255,0.95)", borderColor: `${accent}44`, boxShadow: "0 4px 12px rgba(53,39,66,0.14)" }}
            >
              <button onClick={() => moveSection(section.id, -1)} disabled={i === 0} title="Move up"
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-30"
                style={{ color: "var(--muted-strong)" }}>↑</button>
              <button onClick={() => moveSection(section.id, 1)} disabled={i === sections.length - 1} title="Move down"
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:opacity-30"
                style={{ color: "var(--muted-strong)" }}>↓</button>
              <button onClick={() => setEditingId((prev) => (prev === section.id ? null : section.id))} title="Edit section"
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: editingId === section.id ? `${accent}22` : "transparent", color: editingId === section.id ? accent : "var(--muted-strong)" }}>✎</button>
              <button onClick={() => removeSection(section.id)} title="Remove section"
                className="btn-smooth flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ color: "#ea580c" }}>✕</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Layout panel body (rendered inside SpaceStudio's PanelShell) ─────────────

export function LayoutPanelBody({
  sections, accent, layout, onChangeLayout, onUpdateSections,
}: Readonly<{
  sections: SpaceSection[];
  accent: string;
  layout: "sections" | "canvas";
  onChangeLayout: (layout: "sections" | "canvas") => void;
  onUpdateSections: (next: SpaceSection[]) => void;
}>) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Page style</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "sections" as const, emoji: "🧩", label: "Sections page", blurb: "Arranged blocks, side by side or stacked" },
            { value: "canvas" as const, emoji: "🎨", label: "Classic canvas", blurb: "Just your board, edge to edge" },
          ]).map((m) => (
            <button key={m.value} onClick={() => onChangeLayout(m.value)}
              className="btn-smooth rounded-2xl border px-3 py-2.5 text-left"
              style={{
                background: layout === m.value ? `${accent}12` : "var(--surface)",
                borderColor: layout === m.value ? accent : "var(--border)",
              }}>
              <p className="text-xs font-semibold" style={{ color: layout === m.value ? accent : "var(--foreground-soft)" }}>{m.emoji} {m.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--muted)" }}>{m.blurb}</p>
            </button>
          ))}
        </div>
        {layout === "canvas" && (
          <p className="mt-2 text-[10px]" style={{ color: "var(--muted)" }}>
            Your sections are kept safe — switch back to the sections page any time.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Your page, top to bottom</p>
        <div className="space-y-1.5">
          {sections.map((s, i) => {
            const meta = SECTION_TYPE_META.find((m) => m.type === s.type);
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <span>{meta?.emoji ?? "🧩"}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: "var(--foreground-soft)" }}>
                  {s.title || meta?.label || s.type}
                </span>
                <button
                  onClick={() => {
                    if (i === 0) return;
                    const next = [...sections];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onUpdateSections(next);
                  }}
                  disabled={i === 0}
                  className="btn-smooth h-6 w-6 rounded-lg text-xs disabled:opacity-30" style={{ color: "var(--muted-strong)" }}>↑</button>
                <button
                  onClick={() => {
                    if (i === sections.length - 1) return;
                    const next = [...sections];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    onUpdateSections(next);
                  }}
                  disabled={i === sections.length - 1}
                  className="btn-smooth h-6 w-6 rounded-lg text-xs disabled:opacity-30" style={{ color: "var(--muted-strong)" }}>↓</button>
                <button onClick={() => onUpdateSections(sections.filter((x) => x.id !== s.id))}
                  className="btn-smooth h-6 w-6 rounded-lg text-xs" style={{ color: "#ea580c" }}>✕</button>
              </div>
            );
          })}
          {sections.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>Your page is empty — add a section below!</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Add a section</p>
        <div className="grid grid-cols-2 gap-2">
          {SECTION_TYPE_META.map((meta) => (
            <button key={meta.type}
              onClick={() => onUpdateSections([...sections, makeSection(meta.type)])}
              className="btn-smooth rounded-2xl border px-3 py-2.5 text-left"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--foreground-soft)" }}>{meta.emoji} {meta.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--muted)" }}>{meta.blurb}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px]" style={{ color: "var(--muted)" }}>
          Everything you change here is saved to your space and is what visitors see. ✨
        </p>
      </div>
    </div>
  );
}
