
import React, { useState, useRef } from "react";
import { PlacedSticker } from "@/types";

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
  /** Current number of active layers (1–5). */
  layerCount?: number;
  /** Called when user adds a new layer. */
  onLayerCountChange?: (n: number) => void;
  /** Where pen-drawing sits (0 = below layer 0, layerCount = above all). */
  drawingLayerIndex?: number;
  /** Called when user moves the drawing row. */
  onDrawingLayerChange?: (n: number) => void;
}

const MAX_LAYERS = 5;

const LAYER_COLORS = [
  "#f87171",
  "#fb923c",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
];

const LAYER_NAMES = ["Layer 1", "Layer 2", "Layer 3", "Layer 4", "Layer 5"];

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
        <span style={{ fontSize: 8, color: "#9ca3af" }}>?</span>
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
  layerCount = 1,
  onLayerCountChange,
  drawingLayerIndex = 0,
  onDrawingLayerChange,
}: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOverLayer, setDragOverLayer] = useState<number | "drawing" | null>(null);
  const dragItemIdRef = useRef<string | null>(null);
  const draggingDrawingRef = useRef(false);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) ?? null : null;
  const selectedLayerIndex = selectedItem?.layerIndex ?? 0;

  const byLayer: PlacedSticker[][] = Array.from({ length: MAX_LAYERS }, (_, i) =>
    items.filter((item) => (item.layerIndex ?? 0) === i),
  );

  const positionStyle: React.CSSProperties =
    align === "right"
      ? { position: "absolute", top: 114, right: 10, zIndex: 30 }
      : { position: "absolute", bottom: 12, left: 12, zIndex: 30 };

  // Build the ordered list of rows (top = front).
  // Layers are rendered high-to-low; Drawing row slots in at drawingLayerIndex.
  type Row = { kind: "layer"; idx: number } | { kind: "drawing" };
  const rows: Row[] = [];
  for (let visual = layerCount - 1; visual >= 0; visual--) {
    // Insert drawing row ABOVE layers that are below drawingLayerIndex
    if (visual === drawingLayerIndex - 1 || (drawingLayerIndex === layerCount && visual === layerCount - 1 && rows.findIndex(r => r.kind === "drawing") === -1)) {
      // handled below
    }
    rows.push({ kind: "layer", idx: visual });
  }
  // Insert drawing row at the correct visual position
  const drawingInsertPos = layerCount - drawingLayerIndex; // 0 = top, layerCount = bottom
  rows.splice(drawingInsertPos, 0, { kind: "drawing" });

  const handleItemDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemIdRef.current = itemId;
    draggingDrawingRef.current = false;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrawingDragStart = (e: React.DragEvent) => {
    draggingDrawingRef.current = true;
    dragItemIdRef.current = null;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLayerDragOver = (e: React.DragEvent, targetLayerIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLayer(targetLayerIdx);
  };

  const handleDrawingDragOver = (e: React.DragEvent) => {
    if (!draggingDrawingRef.current) return; // only drawing row can drop on itself (no-op)
    e.preventDefault();
    setDragOverLayer("drawing");
  };

  const handleLayerDrop = (e: React.DragEvent, targetLayerIdx: number) => {
    e.preventDefault();
    setDragOverLayer(null);
    if (draggingDrawingRef.current && onDrawingLayerChange) {
      onDrawingLayerChange(targetLayerIdx);
      draggingDrawingRef.current = false;
    } else if (dragItemIdRef.current) {
      onUpdateItem(dragItemIdRef.current, { layerIndex: targetLayerIdx });
      dragItemIdRef.current = null;
    }
  };

  const handleDragEnd = () => {
    setDragOverLayer(null);
    dragItemIdRef.current = null;
    draggingDrawingRef.current = false;
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
            fontSize: 9, color: "#6d28d9", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
          }}
        >
          {collapsed ? "▾" : "▴"}
        </button>
        {onHide && (
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); }}
            title="Hide layer panel"
            style={{
              width: 18, height: 18, borderRadius: "50%", border: "none",
              background: "rgba(0,0,0,0.06)", cursor: "pointer",
              fontSize: 11, color: "#9ca3af", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: "4px 0 2px" }}>
            {rows.map((row, rowIdx) => {
              if (row.kind === "drawing") {
                const isDropTarget = dragOverLayer === "drawing";
                return (
                  <div
                    key="drawing"
                    draggable
                    onDragStart={handleDrawingDragStart}
                    onDragOver={handleDrawingDragOver}
                    onDrop={(e) => { e.preventDefault(); setDragOverLayer(null); }}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "5px 10px 5px 12px",
                      borderTop: rowIdx > 0 ? "1px solid rgba(0,0,0,0.04)" : undefined,
                      borderBottom: rowIdx < rows.length - 1 ? "1px solid rgba(0,0,0,0.04)" : undefined,
                      background: isDropTarget ? "rgba(167,139,250,0.08)" : "rgba(109,40,217,0.03)",
                      cursor: "grab",
                      transition: "background 0.1s",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#c4b5fd", marginRight: 1, lineHeight: 1 }}>⠿</span>
                    <div style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: "rgba(109,40,217,0.25)", flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: '"Space Mono", monospace', flex: 1 }}>
                      Drawing
                    </span>
                    <span style={{ fontSize: 8, color: "#c4b5fd", fontFamily: "monospace" }}>drag</span>
                  </div>
                );
              }

              const layerIdx = row.idx;
              const layerItems = byLayer[layerIdx] ?? [];
              const color = LAYER_COLORS[layerIdx]!;
              const name = LAYER_NAMES[layerIdx]!;
              const isActiveLayer = selectedItem !== null && selectedLayerIndex === layerIdx;
              const users = layerUsers[layerIdx] ?? [];
              const isDropTarget = dragOverLayer === layerIdx;

              return (
                <div
                  key={layerIdx}
                  onDragOver={(e) => handleLayerDragOver(e, layerIdx)}
                  onDrop={(e) => handleLayerDrop(e, layerIdx)}
                  onDragLeave={() => setDragOverLayer(null)}
                  style={{
                    borderLeft: isActiveLayer ? `3px solid ${color}` : isDropTarget ? `3px solid ${color}88` : "3px solid transparent",
                    background: isDropTarget ? `${color}18` : isActiveLayer ? `${color}12` : "transparent",
                    transition: "background 0.1s",
                    outline: isDropTarget ? `1px dashed ${color}66` : "none",
                    outlineOffset: -1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", padding: "5px 10px 5px 9px", gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10, fontWeight: isActiveLayer ? 700 : 500,
                      color: isActiveLayer ? "#374151" : "#6b7280",
                      fontFamily: '"Space Mono", monospace', flex: 1, minWidth: 0,
                    }}>
                      {name}
                      {layerIdx === layerCount - 1 && (
                        <span style={{ fontSize: 8, color: "#a78bfa", marginLeft: 4, fontWeight: 400 }}>top</span>
                      )}
                      {layerIdx === 0 && (
                        <span style={{ fontSize: 8, color: "#9ca3af", marginLeft: 4, fontWeight: 400 }}>back</span>
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
                            onClick={() => onSelectItem(isSelected ? null : item.id)}
                            title={`${item.type === "text" ? (item.text ?? "Text") : item.type} — drag to move layer`}
                            style={{
                              cursor: "grab",
                              outline: isSelected ? `2px solid ${color}` : "2px solid transparent",
                              borderRadius: 6, outlineOffset: 1, transition: "outline 0.1s",
                            }}
                          >
                            <MiniThumb item={item} />
                          </div>
                        );
                      })}
                      {layerItems.length > 6 && (
                        <span style={{ fontSize: 9, color: "#9ca3af", fontFamily: "monospace", padding: "2px 4px" }}>
                          +{layerItems.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add layer button */}
            {onLayerCountChange && layerCount < MAX_LAYERS && (
              <button
                onClick={() => onLayerCountChange(layerCount + 1)}
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
                fontSize: 9, color: "#9ca3af",
                fontFamily: '"Space Mono", monospace',
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                Move selected to layer:
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {Array.from({ length: layerCount }, (_, i) => i).map((targetIdx) => {
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
                        padding: "3px 7px", fontSize: 12, fontWeight: 700, borderRadius: 8,
                        border: "1px solid rgba(220,38,38,0.2)",
                        background: "rgba(220,38,38,0.07)", color: "#dc2626",
                        cursor: "pointer", lineHeight: 1.2, flexShrink: 0,
                      }}
                    >
                      ×
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
