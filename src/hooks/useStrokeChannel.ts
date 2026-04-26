"use client";

import { useCallback, useEffect, useRef } from "react";
import { getStroke } from "perfect-freehand";
import { strokeToPath2D } from "@/lib/canvas/strokeUtils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DrawingCanvasHandle } from "@/components/DrawingCanvas";

type StrokePayload = {
  artistId: string;
  strokeId: string;
  pts: [number, number, number][];
  color: string;
  size: number;
  isLast: boolean;
};

type UseStrokeChannelOptions = {
  hasSession: boolean;
  collabScope: string;
  selfIdRef: React.RefObject<string>;
  canvasRef: React.RefObject<DrawingCanvasHandle | null>;
  remoteStrokeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
};

export function useStrokeChannel({
  hasSession,
  collabScope,
  selfIdRef,
  canvasRef,
  remoteStrokeCanvasRef,
}: UseStrokeChannelOptions) {
  type ChannelType = ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]>;
  const strokeChannelRef = useRef<ChannelType | null>(null);
  const strokeRafRef = useRef<number | null>(null);
  const remoteActiveStrokesRef = useRef<Map<string, { strokeId: string; pts: [number, number, number][]; color: string; size: number }>>(new Map());

  const renderRemoteStrokes = useCallback(() => {
    const canvas = remoteStrokeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of remoteActiveStrokesRef.current.values()) {
      const outline = getStroke(stroke.pts, { size: stroke.size, thinning: 0.5, smoothing: 0.5, streamline: 0.4, simulatePressure: false });
      if (!outline.length) continue;
      ctx.save();
      ctx.fillStyle = stroke.color;
      ctx.fill(strokeToPath2D(outline));
      ctx.restore();
    }
    if (remoteActiveStrokesRef.current.size > 0) {
      strokeRafRef.current = requestAnimationFrame(renderRemoteStrokes);
    } else {
      strokeRafRef.current = null;
    }
  }, [remoteStrokeCanvasRef]);

  useEffect(() => {
    if (!hasSession) return;

    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`mochimail-strokes:${collabScope}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const data = payload as StrokePayload;
        if (!data?.artistId || data.artistId === selfIdRef.current) return;

        if (data.isLast) {
          remoteActiveStrokesRef.current.delete(data.artistId);
          const drawingCanvas = canvasRef.current?.getCanvas();
          if (drawingCanvas) {
            const ctx = drawingCanvas.getContext("2d");
            if (ctx) {
              const outline = getStroke(data.pts, { size: data.size, thinning: 0.5, smoothing: 0.5, streamline: 0.4, simulatePressure: false });
              ctx.save();
              ctx.fillStyle = data.color;
              ctx.fill(strokeToPath2D(outline));
              ctx.restore();
            }
          }
        } else {
          remoteActiveStrokesRef.current.set(data.artistId, {
            strokeId: data.strokeId,
            pts: data.pts,
            color: data.color,
            size: data.size,
          });
          if (!strokeRafRef.current) {
            strokeRafRef.current = requestAnimationFrame(renderRemoteStrokes);
          }
        }
      });

    ch.subscribe();
    strokeChannelRef.current = ch;

    return () => {
      if (strokeRafRef.current) {
        cancelAnimationFrame(strokeRafRef.current);
        strokeRafRef.current = null;
      }
      remoteActiveStrokesRef.current.clear();
      void supabase.removeChannel(ch);
      strokeChannelRef.current = null;
    };
  }, [hasSession, collabScope, renderRemoteStrokes]);

  return { strokeChannelRef };
}
