
import React, { useMemo, useState } from "react";
import type { ScrapbookKit, ScrapbookKitElement, Sticker, StoreItem, ViewerIdentity } from "@/types";
import { renderBuiltInKits } from "@/data/scrapbookKitsData";
import CreateKitModal from "./CreateKitModal";

type KitTab = "builtin" | "library" | "shop";

interface ScrapbookViewProps {
  kitLibrary: ScrapbookKit[];
  shopKits: StoreItem[];
  userStickers: Sticker[];
  viewer: ViewerIdentity;
  onAddElement: (el: ScrapbookKitElement) => void;
  onAddKit: (kit: ScrapbookKit) => void;
  onAddKitToLibrary: (kit: ScrapbookKit) => void;
  onRemoveKit: (id: string) => void;
  onPublishKit: (kit: ScrapbookKit, publishToShop: boolean) => void;
}

// ── Kit Card ──────────────────────────────────────────────────────────────────

interface KitCardProps {
  kit: ScrapbookKit;
  onAddElement: (el: ScrapbookKitElement) => void;
  onAddKit: (kit: ScrapbookKit) => void;
  onRemove?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  downloads?: number;
}

function KitCard({ kit, onAddElement, onAddKit, onRemove, actionLabel, onAction, downloads }: KitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addedAll, setAddedAll] = useState(false);
  const [addedEl, setAddedEl] = useState<string | null>(null);
  const c = kit.accent || "#a78bfa";

  function handleAddKit() {
    onAddKit(kit);
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 1800);
  }

  function handleAddElement(el: ScrapbookKitElement) {
    onAddElement(el);
    setAddedEl(el.name);
    setTimeout(() => setAddedEl(null), 1800);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ border: `1.5px solid ${c}33`, background: "var(--surface)" }}
    >
      {/* Header bar */}
      <div
        className="px-3 py-2.5 flex items-start gap-2"
        style={{ background: `${c}18`, borderBottom: `1px solid ${c}22` }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: c }}>{kit.name}</p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: c, opacity: 0.75 }}>
            {kit.description || "No description"} · by {kit.creator}
          </p>
          {downloads !== undefined && (
            <p className="text-[9px] mt-0.5" style={{ color: c, opacity: 0.55 }}>{downloads} downloads</p>
          )}
        </div>
        <button
          onClick={handleAddKit}
          className="btn-smooth shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm transition-all"
          style={{ background: addedAll ? "#22c55e" : c, color: "#fff" }}
          title={`Add all ${kit.elements.length} elements`}
        >
          {addedAll ? "✓ Added!" : `+ All ${kit.elements.length}`}
        </button>
      </div>

      {/* Thumbnail grid — 2×2 or 2×3 */}
      <div className="grid grid-cols-4 gap-1 p-2">
        {kit.elements.slice(0, 4).map((el) => (
          <button
            key={el.name}
            onClick={() => handleAddElement(el)}
            title={`Add "${el.name}"`}
            className="btn-smooth rounded-lg overflow-hidden aspect-square flex items-center justify-center p-1 transition-all hover:scale-110 relative"
            style={{ background: addedEl === el.name ? `${c}30` : `${c}12`, border: `1px solid ${addedEl === el.name ? c : `${c}25`}` }}
          >
            {addedEl === el.name
              ? <span className="text-[11px] font-bold" style={{ color: c }}>✓</span>
              : <img src={el.imageData} alt={el.name} className="max-w-full max-h-full object-contain" style={{ imageRendering: "auto" }} />}
          </button>
        ))}
      </div>

      {/* Tags */}
      {kit.tags.length > 0 && (
        <div className="px-2 pb-1 flex flex-wrap gap-1">
          {kit.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-1.5 py-px text-[9px] font-medium"
              style={{ background: `${c}15`, color: c }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse */}
      <div className="px-2 pb-2 flex flex-col gap-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-smooth w-full rounded-lg py-1 text-[10px] font-semibold"
          style={{ color: c, background: `${c}10` }}
        >
          {expanded ? "▲ Hide" : `▼ ${kit.elements.length} elements`}
        </button>

        {expanded && (
          <div className="flex flex-col gap-1 mt-0.5">
            {kit.elements.map((el) => (
              <button
                key={el.name}
                onClick={() => handleAddElement(el)}
                className="btn-smooth flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:scale-[1.01] transition-all"
                style={{ background: addedEl === el.name ? `${c}18` : `${c}08`, border: `1px solid ${addedEl === el.name ? c : `${c}20`}` }}
              >
                <div
                  className="h-9 w-9 flex-shrink-0 rounded overflow-hidden flex items-center justify-center p-0.5"
                  style={{ background: "white", border: `1px solid ${c}20` }}
                >
                  <img src={el.imageData} alt={el.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: c }}>{el.name}</p>
                  <p className="text-[9px]" style={{ color: c, opacity: 0.55 }}>{el.width}×{el.height}px</p>
                </div>
                <span className="text-[10px] shrink-0 font-semibold" style={{ color: c, opacity: addedEl === el.name ? 1 : 0.6 }}>
                  {addedEl === el.name ? "✓ Added" : "+ Add"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Secondary action row */}
        <div className="flex gap-1 mt-0.5">
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="btn-smooth flex-1 rounded-lg py-1 text-[10px] font-semibold"
              style={{ background: `${c}15`, color: c }}
            >
              {actionLabel}
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="btn-smooth rounded-lg px-3 py-1 text-[10px] font-semibold"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div className="py-12 text-center">
      <div className="text-4xl mb-2 opacity-50">{icon}</div>
      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{text}</p>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScrapbookView({
  kitLibrary,
  shopKits,
  userStickers,
  viewer,
  onAddElement,
  onAddKit,
  onAddKitToLibrary,
  onRemoveKit,
  onPublishKit,
}: Readonly<ScrapbookViewProps>) {
  const [tab, setTab] = useState<KitTab>("builtin");
  const [showCreate, setShowCreate] = useState(false);

  const builtInKits = useMemo(() => renderBuiltInKits(), []);

  const kitStoreItems = useMemo(() => shopKits.filter((i) => i.type === "kit"), [shopKits]);

  const tabMeta: { id: KitTab; label: string; count?: number }[] = [
    { id: "builtin", label: "Built-in", count: builtInKits.length },
    { id: "library", label: "My Library", count: kitLibrary.length },
    { id: "shop", label: "Shop Kits", count: kitStoreItems.length },
  ];

  return (
    <div className="panel-soft p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Scrapbook Kits</h3>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Tap a thumbnail to add one element, or "+ All" to add the whole kit.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-smooth shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", color: "#fff" }}
        >
          + Create Kit
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(167,139,250,0.08)" }}>
        {tabMeta.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="btn-smooth flex-1 rounded-lg py-1.5 text-[11px] font-semibold flex items-center justify-center gap-1"
            style={{
              background: tab === id ? "white" : "transparent",
              color: tab === id ? "var(--lavender)" : "var(--muted)",
              boxShadow: tab === id ? "0 1px 4px rgba(167,139,250,0.2)" : "none",
            }}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className="rounded-full px-1.5 py-px text-[9px]"
                style={{
                  background: tab === id ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.1)",
                  color: "var(--lavender)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Kit grid */}
      {tab === "builtin" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {builtInKits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              onAddElement={onAddElement}
              onAddKit={onAddKit}
            />
          ))}
        </div>
      )}

      {tab === "library" && (
        kitLibrary.length === 0 ? (
          <EmptyState
            icon="📦"
            text="Your library is empty"
            sub="Add kits from the Shop or create your own with + Create Kit"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {kitLibrary.map((kit) => (
              <KitCard
                key={kit.id}
                kit={kit}
                onAddElement={onAddElement}
                onAddKit={onAddKit}
                onRemove={() => onRemoveKit(kit.id)}
              />
            ))}
          </div>
        )
      )}

      {tab === "shop" && (
        kitStoreItems.length === 0 ? (
          <EmptyState
            icon="🏪"
            text="No kits in the shop yet"
            sub="Be the first! Create a kit and publish it to the shop."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {kitStoreItems.map((item) => {
              const kit = item.kitData;
              if (!kit) return null;
              const isOwned = kitLibrary.some((k) => k.id === kit.id || k.id === item.id);
              return (
                <KitCard
                  key={item.id}
                  kit={{ ...kit, id: kit.id || item.id }}
                  onAddElement={onAddElement}
                  onAddKit={(k) => {
                    onAddKit(k);
                    if (!isOwned) onAddKitToLibrary(k);
                  }}
                  downloads={item.downloads}
                  actionLabel={isOwned ? "✓ In Library" : "Save to Library"}
                  onAction={isOwned ? undefined : () => onAddKitToLibrary({ ...kit, id: kit.id || item.id })}
                />
              );
            })}
          </div>
        )
      )}

      {/* Create Kit Modal */}
      {showCreate && (
        <CreateKitModal
          userStickers={userStickers}
          viewer={viewer}
          onClose={() => setShowCreate(false)}
          onSave={(kit, publishToShop) => {
            onAddKitToLibrary(kit);
            onPublishKit(kit, publishToShop);
            setShowCreate(false);
            setTab("library");
          }}
        />
      )}
    </div>
  );
}
