"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasRegionSelectorProps {
  scrollEl: HTMLDivElement;
  zoom: number;
  /** Called with raw wheel event data so the parent can apply its zoom transform. */
  onZoom: (deltaY: number, deltaMode: number, clientX: number, clientY: number) => void;
  onConfirm: (region: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export default function CanvasRegionSelector({
  scrollEl,
  zoom,
  onZoom,
  onConfirm,
  onCancel,
}: CanvasRegionSelectorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rect, setRect] = useState<ScreenRect | null>(null);

  const getOverlayPos = useCallback((clientX: number, clientY: number) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(clientY - bounds.top, bounds.height)),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const pos = getOverlayPos(e.clientX, e.clientY);
      dragStart.current = pos;
      setRect(null);
      setIsDragging(true);
    },
    [getOverlayPos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStart.current) return;
      const pos = getOverlayPos(e.clientX, e.clientY);
      const x = Math.min(dragStart.current.x, pos.x);
      const y = Math.min(dragStart.current.y, pos.y);
      const w = Math.abs(pos.x - dragStart.current.x);
      const h = Math.abs(pos.y - dragStart.current.y);
      setRect({ x, y, w, h });
    },
    [isDragging, getOverlayPos],
  );

  const onPointerUp = useCallback(() => {
    dragStart.current = null;
    setIsDragging(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!rect || rect.w < 10 || rect.h < 10) return;
    const canvasX = Math.round((rect.x + scrollEl.scrollLeft) / zoom);
    const canvasY = Math.round((rect.y + scrollEl.scrollTop) / zoom);
    const canvasW = Math.round(rect.w / zoom);
    const canvasH = Math.round(rect.h / zoom);
    onConfirm({ x: canvasX, y: canvasY, width: canvasW, height: canvasH });
  }, [rect, scrollEl, zoom, onConfirm]);

  // Forward wheel events so the user can zoom/scroll the canvas during selection.
  // React's synthetic onWheel is passive by default; use a native listener instead.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Don't interfere while actively drawing a selection rect
      if (dragStart.current) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        onZoom(e.deltaY, e.deltaMode, e.clientX, e.clientY);
      } else {
        // Pan — forward scroll to the canvas container
        scrollEl.scrollLeft += e.deltaX;
        scrollEl.scrollTop += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollEl, onZoom]);

  // Escape key cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const hasSelection = rect && rect.w > 10 && rect.h > 10 && !isDragging;

  // Compute action button position — keep it on-screen
  let btnLeft = rect ? rect.x : 0;
  let btnTop = rect ? rect.y + rect.h + 10 : 0;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[60] select-none"
      style={{ cursor: isDragging ? "crosshair" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Instruction banner */}
      <div
        className="pointer-events-none absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-2xl px-4 py-2 text-sm font-medium text-white"
        style={{
          background: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}
      >
        Drag to select the region you want to export
      </div>

      {/* Cancel (top-right, always visible) */}
      <button
        className="pointer-events-auto absolute right-4 top-4 z-20 rounded-xl px-3 py-1.5 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.92)",
          color: "var(--muted-strong, #374151)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
      >
        Cancel
      </button>

      {/* Dimmed overlay — 4 strips around selection rect */}
      {rect && rect.w > 0 && rect.h > 0 ? (
        <>
          {/* Top */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-0"
            style={{ height: rect.y, background: "rgba(0,0,0,0.45)" }}
          />
          {/* Bottom */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0"
            style={{ top: rect.y + rect.h, background: "rgba(0,0,0,0.45)" }}
          />
          {/* Left */}
          <div
            className="pointer-events-none absolute"
            style={{ top: rect.y, height: rect.h, left: 0, width: rect.x, background: "rgba(0,0,0,0.45)" }}
          />
          {/* Right */}
          <div
            className="pointer-events-none absolute"
            style={{ top: rect.y, height: rect.h, left: rect.x + rect.w, right: 0, background: "rgba(0,0,0,0.45)" }}
          />

          {/* Selection border + handles */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              border: "2px dashed rgba(255,255,255,0.92)",
              boxSizing: "border-box",
              outline: "1px solid rgba(0,0,0,0.25)",
            }}
          />

          {/* Dimension label */}
          <div
            className="pointer-events-none absolute text-[11px] font-mono font-semibold text-white"
            style={{
              left: rect.x + 6,
              top: rect.y + 5,
              textShadow: "0 1px 4px rgba(0,0,0,0.7)",
            }}
          >
            {Math.round(rect.w / zoom)} × {Math.round(rect.h / zoom)} px
          </div>
        </>
      ) : (
        /* Full dim when nothing is selected */
        <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,0.38)" }} />
      )}

      {/* Action buttons — appear after selection is made */}
      {hasSelection && rect && (
        <div
          className="pointer-events-auto absolute z-20 flex gap-2"
          style={{ left: btnLeft, top: btnTop }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, var(--pink, #ff6b9d), var(--lavender, #a78bfa))",
              boxShadow: "0 3px 12px rgba(255,107,157,0.42)",
            }}
          >
            Export region
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRect(null); }}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: "var(--muted-strong, #374151)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
            }}
          >
            Redraw
          </button>
        </div>
      )}
    </div>
  );
}
