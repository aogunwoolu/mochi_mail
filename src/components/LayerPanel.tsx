
import React, { useState, useRef } from "react";
import { FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiChevronUp, FiChevronDown, FiX, FiTrash2 } from "react-icons/fi";
import { PlacedSticker } from "@/types";
import { FREE, LAYER_CEILING } from "@/lib/plus";

export interface LayerUser {
  id: string;
  name: string;
  color?: string;
}

interface LayerPanelProps {
  items: PlacedSticker[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (id: string, updates: Partial<PlacedSticker>) => void;
  onDeleteItem?: (id: string) => void;
  layerUsers?: Record<number, LayerUser[]>;
  onHide?: () => void;
  align?: "left" | "right";
  /** Display order of stable layer ids — index 0 is back, last is front. */
  layerOrder?: number[];
  /** Stable ids of layers currently hidden from rendering. */
  hiddenLayerIds?: number[];
  /** Called when user adds a new layer. */
  onAddLayer?: () => void;
  /** Max number of layers the user may create (raised by Mochi Plus). */
  maxLayers?: number;
  /** Toggle visibility of a layer by its stable id. */
  onToggleLayerVisibility?: (layerId: number) => void;
  /** Currently active layer id for drawing and item placement */
  activeLayer?: number;
  /** Called when user clicks to activate a layer */
  onActiveLayerChange?: (n: number) => void;
  /** Move the given layer id one position toward the front. */
  onMoveLayerUp?: (layerId: number) => void;
  /** Move the given layer id one position toward the back. */
  onMoveLayerDown?: (layerId: number) => void;
}

// Size per-layer buckets to the absolute ceiling so existing content on higher
// layers always renders; the add-layer button is gated separately by the
// caller's entitlement (`maxLayers` prop).
const MAX_LAYERS = LAYER_CEILING;

const LAYER_COLORS = [
  "#f87171",
  "#fb923c",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
  "#facc15",
];

const LAYER_NAMES = Array.from({ length: MAX_LAYERS }, (_, i) => `Layer ${i + 1}`);

function UserDots({ users }: { users: LayerUser[] }) {
  if (!users.length) return null;
  const shown = users.slice(0, 2);
  const extra = users.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4, flexShrink: 0 }}>
      {shown.map((u) => (
        <div
          key={u.id}
          title={u.name}
          style={{
            width: 15, height: 15, borderRadius: "50%",
            background: u.color ?? "linear-gradient(135deg, #ff6b9d, #a78bfa)",
            fontSize: 7, fontWeight: 800, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid rgba(255,255,255,0.9)", fontFamily: "monospace", flexShrink: 0,
          }}
        >
          {u.name[0]?.toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div
          title={`+${extra} more`}
          style={{
            width: 15, height: 15, borderRadius: "50%",
            background: "rgba(0,0,0,0.18)", fontSize: 7, fontWeight: 800, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid rgba(255,255,255,0.9)", fontFamily: "monospace", flexShrink: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function MiniThumb({ item }: { item: PlacedSticker }) {
  return (
    <div
      title={item.type === "text" ? (item.text ?? "Text") : item.type}
      style={{
        width: 22, height: 22, borderRadius: 5, overflow: "hidden",
        background: item.type === "text" ? "rgba(167,139,250,0.15)" : "rgba(0,0,0,0.05)",
        border: "1px solid rgba(0,0,0,0.06)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {item.type === "text" ? (
        <span style={{ fontSize: 11, color: item.textColor ?? "#6d28d9", fontWeight: 800, fontFamily: "monospace" }}>T</span>
      ) : item.imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: 8, color: "var(--muted)" }}>?</span>
      )}
    </div>
  );
}

export default function LayerPanel({
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  layerUsers = {},
  onHide,
  align = "left",
  layerOrder = [0],
  hiddenLayerIds = [],
  onAddLayer,
  maxLayers = FREE.maxLayers,
  onToggleLayerVisibility,
  activeLayer = 0,
  onActiveLayerChange,
  onMoveLayerUp,
  onMoveLayerDown,
}: LayerPanelProps) {
  const layerCount = layerOrder.length;
  const hiddenSet = new Set(hiddenLayerIds);
  const topLayerId = layerOrder[layerOrder.length - 1];
  const backLayerId = layerOrder[0];
  const [collapsed, setCollapsed] = useState(false);
  const [dragOverLayer, setDragOverLayer] = useState<number | null>(null);
  const dragItemIdRef = useRef<string | null>(null);
  const touchDragItemRef = useRef<{ itemId: string; startX: number; startY: number } | null>(null);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) ?? null : null;
  const selectedLayerIndex = selectedItem?.layerIndex ?? 0;

  const byLayer: PlacedSticker[][] = Array.from({ length: MAX_LAYERS }, (_, i) =>
    items.filter((item) => (item.layerIndex ?? 0) === i),
  );

  const positionStyle: React.CSSProperties =
    align === "right"
      ? { position: "absolute", top: 114, right: 10, zIndex: 30 }
      : { position: "absolute", bottom: 12, left: 12, zIndex: 30 };

  // Build the ordered list of rows (top of panel = front of canvas).
  // Iterate layerOrder from end (front) → start (back) so the visual top is the front layer.
  type Row = { kind: "layer"; idx: number; pos: number };
  const rows: Row[] = [];
  for (let pos = layerOrder.length - 1; pos >= 0; pos--) {
    rows.push({ kind: "layer", idx: layerOrder[pos]!, pos });
  }

  const handleItemDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemIdRef.current = itemId;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLayerDragOver = (e: React.DragEvent, targetLayerIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLayer(targetLayerIdx);
  };

  const handleLayerDrop = (e: React.DragEvent, targetLayerIdx: number) => {
    e.preventDefault();
    setDragOverLayer(null);
    if (dragItemIdRef.current) {
      onUpdateItem(dragItemIdRef.current, { layerIndex: targetLayerIdx });
      dragItemIdRef.current = null;
    }
  };

  const handleDragEnd = () => {
    setDragOverLayer(null);
    dragItemIdRef.current = null;
  };

  // Touch handlers for iPad layer drag
  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    const touch = e.touches[0];
    touchDragItemRef.current = { itemId, startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent, targetLayerIdx: number) => {
    if (!touchDragItemRef.current) return;
    // NOTE: preventDefault() is useless here — React registers touchmove
    // passively at the root. Scrolling is suppressed instead via
    // `touchAction: "none"` on the draggable thumbs below.
    const touch = e.touches[0];
    const dx = touch.clientX - touchDragItemRef.current.startX;
    const dy = touch.clientY - touchDragItemRef.current.startY;
    
    // Only trigger drag if moved significantly (to distinguish from tap)
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      setDragOverLayer(targetLayerIdx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, targetLayerIdx: number) => {
    if (touchDragItemRef.current) {
      onUpdateItem(touchDragItemRef.current.itemId, { layerIndex: targetLayerIdx });
    }
    setDragOverLayer(null);
    touchDragItemRef.current = null;
  };

  return (
    <div
      style={{
        ...positionStyle,
        width: collapsed ? "auto" : 230,
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(167,139,250,0.28)",
        borderRadius: 18,
        boxShadow: "0 6px 28px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        backdropFilter: "blur(14px)",
        userSelect: "none",
        overflow: "hidden",
        transition: "width 0.15s ease",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: "flex", alignItems: "center",
          padding: "7px 10px 7px 12px", gap: 6,
          borderBottom: collapsed ? "none" : "1px solid rgba(167,139,250,0.13)",
          cursor: "pointer",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="14" height="3.5" rx="1.5" fill="#a78bfa" />
          <rect x="1" y="6.25" width="14" height="3.5" rx="1.5" fill="#a78bfa" opacity=".65" />
          <rect x="1" y="11.5" width="14" height="3.5" rx="1.5" fill="#a78bfa" opacity=".35" />
        </svg>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", color: "#6d28d9",
          fontFamily: '"Space Mono", monospace', flex: 1, lineHeight: 1,
        }}>
          LAYERS
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            width: 18, height: 18, borderRadius: "50%", border: "none",
            background: "rgba(167,139,250,0.13)", cursor: "pointer",
            fontSize: 11, color: "#6d28d9", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {collapsed ? <FiChevronDown /> : <FiChevronUp />}
        </button>
        {onHide && (
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); }}
            title="Hide layer panel"
            style={{
              width: 18, height: 18, borderRadius: "50%", border: "none",
              background: "rgba(167,139,250,0.09)", cursor: "pointer",
              fontSize: 11, color: "var(--muted)", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}
          >
            <FiX />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: "4px 0 2px" }}>
            {rows.map((row, rowIdx) => {
              const layerIdx = row.idx;
              const layerItems = byLayer[layerIdx] ?? [];
              const color = LAYER_COLORS[layerIdx]!;
              const name = LAYER_NAMES[layerIdx]!;
              const hasSelectedItem = selectedItem !== null && selectedLayerIndex === layerIdx;
              const isCurrentlyActive = activeLayer === layerIdx;
              const users = layerUsers[layerIdx] ?? [];
              const isDropTarget = dragOverLayer === layerIdx;
              const isHidden = hiddenSet.has(layerIdx);
              const canMoveUp = row.pos < layerCount - 1;
              const canMoveDown = row.pos > 0;

              return (
                <div
                  key={layerIdx}
                  onDragOver={(e) => handleLayerDragOver(e, layerIdx)}
                  onDrop={(e) => handleLayerDrop(e, layerIdx)}
                  onDragLeave={() => setDragOverLayer(null)}
                  onTouchMove={(e) => handleTouchMove(e, layerIdx)}
                  onTouchEnd={(e) => handleTouchEnd(e, layerIdx)}
                  onClick={() => onActiveLayerChange?.(layerIdx)}
                  style={{
                    borderLeft: isCurrentlyActive ? `3px solid ${color}` : hasSelectedItem ? `2px solid ${color}88` : isDropTarget ? `3px solid ${color}88` : "3px solid transparent",
                    background: isDropTarget ? `${color}18` : isCurrentlyActive ? `${color}15` : hasSelectedItem ? `${color}08` : "transparent",
                    transition: "background 0.1s",
                    outline: isDropTarget ? `1px dashed ${color}66` : "none",
                    outlineOffset: -1,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", padding: "5px 10px 5px 9px", gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10, fontWeight: isCurrentlyActive ? 700 : hasSelectedItem ? 600 : 500,
                      color: isCurrentlyActive ? "var(--foreground)" : hasSelectedItem ? "var(--foreground-soft)" : "var(--muted-strong)",
                      fontFamily: '"Space Mono", monospace', flex: 1, minWidth: 0,
                    }}>
                      <span style={{ opacity: isHidden ? 0.45 : 1, textDecoration: isHidden ? "line-through" : "none" }}>{name}</span>
                      {isCurrentlyActive && (
                        <span style={{ fontSize: 7, color: color, marginLeft: 3, fontWeight: 700 }}>●</span>
                      )}
                      {layerIdx === topLayerId && (
                        <span style={{ fontSize: 8, color: "#a78bfa", marginLeft: 4, fontWeight: 400 }}>top</span>
                      )}
                      {layerIdx === backLayerId && layerIdx !== topLayerId && (
                        <span style={{ fontSize: 8, color: "var(--muted)", marginLeft: 4, fontWeight: 400 }}>back</span>
                      )}
                    </span>
                    {layerItems.length > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: color,
                        background: `${color}18`, borderRadius: 6,
                        padding: "1px 5px", fontFamily: "monospace", flexShrink: 0,
                      }}>
                        {layerItems.length}
                      </span>
                    )}
                    <UserDots users={users} />
                    {/* Layer controls */}
                    <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
                      {onToggleLayerVisibility && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLayerVisibility(layerIdx);
                          }}
                          style={{
                            width: 18, height: 18,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: isHidden ? "rgba(167,139,250,0.20)" : "rgba(167,139,250,0.09)",
                            border: "none", borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 10,
                            color: isHidden ? "var(--muted)" : "var(--muted-strong)",
                          }}
                          title={isHidden ? "Show layer" : "Hide layer"}
                        >
                          {isHidden ? <FiEyeOff /> : <FiEye />}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveLayerUp?.(layerIdx);
                        }}
                        disabled={!canMoveUp}
                        style={{
                          width: 18, height: 18,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(167,139,250,0.09)",
                          border: "none", borderRadius: 6,
                          cursor: !canMoveUp ? "not-allowed" : "pointer",
                          opacity: !canMoveUp ? 0.3 : 1,
                          fontSize: 10, color: "var(--muted-strong)",
                        }}
                        title="Move layer up"
                      >
                        <FiArrowUp />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveLayerDown?.(layerIdx);
                        }}
                        disabled={!canMoveDown}
                        style={{
                          width: 18, height: 18,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(167,139,250,0.09)",
                          border: "none", borderRadius: 6,
                          cursor: !canMoveDown ? "not-allowed" : "pointer",
                          opacity: !canMoveDown ? 0.3 : 1,
                          fontSize: 10, color: "var(--muted-strong)",
                        }}
                        title="Move layer down"
                      >
                        <FiArrowDown />
                      </button>
                    </div>
                  </div>

                  {layerItems.length > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", flexWrap: "wrap",
                      gap: 4, padding: "2px 10px 6px 26px",
                    }}>
                      {layerItems.slice(0, 6).map((item) => {
                        const isSelected = item.id === selectedItemId;
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleItemDragStart(e, item.id)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, item.id)}
                            onClick={() => onSelectItem(isSelected ? null : item.id)}
                            title={`${item.type === "text" ? (item.text ?? "Text") : item.type} — drag to move layer`}
                            style={{
                              cursor: "grab",
                              touchAction: "none",
                              outline: isSelected ? `2px solid ${color}` : "2px solid transparent",
                              borderRadius: 6, outlineOffset: 1, transition: "outline 0.1s",
                            }}
                          >
                            <MiniThumb item={item} />
                          </div>
                        );
                      })}
                      {layerItems.length > 6 && (
                        <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", padding: "2px 4px" }}>
                          +{layerItems.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add layer button */}
            {onAddLayer && layerCount < maxLayers && (
              <button
                onClick={() => onAddLayer()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, width: "100%", padding: "6px 10px",
                  background: "transparent", border: "none",
                  borderTop: "1px solid rgba(167,139,250,0.10)",
                  cursor: "pointer", color: "#a78bfa",
                  fontSize: 9, fontWeight: 700,
                  fontFamily: '"Space Mono", monospace',
                  letterSpacing: "0.06em",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title={`Add Layer ${layerCount + 1}`}
              >
                + ADD LAYER
              </button>
            )}
          </div>

          {/* Selected item controls */}
          {selectedItem && (
            <div style={{
              borderTop: "1px solid rgba(167,139,250,0.13)",
              padding: "8px 10px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{
                fontSize: 9, color: "var(--muted)",
                fontFamily: '"Space Mono", monospace',
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                Move selected to layer:
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {layerOrder.map((targetIdx) => {
                  const isCurrentLayer = selectedLayerIndex === targetIdx;
                  const col = LAYER_COLORS[targetIdx]!;
                  return (
                    <button
                      key={targetIdx}
                      onClick={() => { if (!isCurrentLayer) onUpdateItem(selectedItem.id, { layerIndex: targetIdx }); }}
                      title={`Move to ${LAYER_NAMES[targetIdx]}`}
                      style={{
                        flex: 1, height: 24, borderRadius: 8,
                        border: isCurrentLayer ? `2px solid ${col}` : `1px solid ${col}44`,
                        background: isCurrentLayer ? `${col}22` : `${col}0a`,
                        color: col, cursor: isCurrentLayer ? "default" : "pointer",
                        fontSize: 8, fontWeight: 800, fontFamily: "monospace",
                        transition: "background 0.1s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {targetIdx + 1}
                    </button>
                  );
                })}
                {onDeleteItem && (
                  <>
                    <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.08)", margin: "0 2px", flexShrink: 0 }} />
                    <button
                      onClick={() => { onDeleteItem(selectedItem.id); onSelectItem(null); }}
                      title="Delete item"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        height: 24, width: 26, fontSize: 11, borderRadius: 8,
                        border: "1px solid rgba(255,107,157,0.28)",
                        background: "rgba(255,107,157,0.09)", color: "var(--pink)",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
