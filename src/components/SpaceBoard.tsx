'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import InfiniteViewer from 'react-infinite-viewer'
import type { OnScroll as OnViewerScroll } from 'react-infinite-viewer'
import Moveable from 'react-moveable'
import type { SpaceItem, SpaceItemStyle } from '@/types'
import { fontCss } from '@/lib/spaceConfig'

// ─── Zoom limits (mirrors tldraw's comfortable range) ──────────────────────────

const ZOOM_RANGE: [number, number] = [0.4, 2.5]

// ─── Per-item content renderer ─────────────────────────────────────────────────
// Pure presentation — identical markup to the previous tldraw shape, just driven
// straight off SpaceItem and sized to fill its positioned wrapper (100% / 100%).

function SpaceItemContent({ item }: { item: SpaceItem }) {
  const w = item.width ?? 200
  const h = item.height ?? 160
  const color = item.color ?? '#ffe08a'
  const itemType = item.type
  const title = item.title ?? ''
  const content = item.content ?? ''
  const imageUrl = item.imageUrl ?? ''

  const stickerMode = color === 'sticker'
  const visitorMode = color === 'visitor'
  const pinned = title.startsWith('📌 ')
  const shownTitle = pinned ? title.slice(3) : title
  const hasImage = (itemType === 'image' || itemType === 'drawing') && !!imageUrl
  const style = item.style ?? {}
  const ov = containerOverrides(style)
  const textColor = style.textColor
  const fam = style.fontFamily ? fontCss(style.fontFamily) : undefined

  const fill: React.CSSProperties = { width: '100%', height: '100%' }

  // ── Emoji sticker ──────────────────────────────────────────────────────────
  if (stickerMode) {
    return (
      <div style={{
        ...fill,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.min(w, h) * 0.72,
        filter: 'drop-shadow(0 4px 8px rgba(53,39,66,0.18))',
        opacity: ov.opacity,
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {content}
      </div>
    )
  }

  // ── Header / heading text ───────────────────────────────────────────────────
  if (itemType === 'header') {
    return (
      <div style={{ ...fill, display: 'flex', alignItems: 'center', opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none' }}>
        <span style={{
          fontFamily: fam, fontWeight: 800, fontSize: Math.min(h * 0.52, 34), lineHeight: 1.1,
          letterSpacing: '-0.01em', color: textColor ?? 'rgba(53,39,66,0.92)', whiteSpace: 'pre-wrap',
        }}>
          {shownTitle || 'Section title'}
        </span>
      </div>
    )
  }

  // ── Divider ─────────────────────────────────────────────────────────────────
  if (itemType === 'divider') {
    const line = style.borderColor ?? textColor ?? 'rgba(53,39,66,0.25)'
    return (
      <div style={{ ...fill, display: 'flex', alignItems: 'center', gap: 0, opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none' }}>
        <div style={{ flex: 1, borderTop: `2px dashed ${line}` }} />
        {shownTitle ? <span style={{ padding: '0 12px', fontSize: 12, fontWeight: 600, color: line, fontFamily: fam, whiteSpace: 'nowrap' }}>{shownTitle}</span> : null}
        {shownTitle ? <div style={{ flex: 1, borderTop: `2px dashed ${line}` }} /> : null}
      </div>
    )
  }

  // ── Link / music card ───────────────────────────────────────────────────────
  if (itemType === 'link' || itemType === 'music') {
    const isMusic = itemType === 'music'
    const domain = domainOf(content)
    return (
      <div style={{
        ...fill, display: 'flex', alignItems: 'center', gap: 12,
        background: color && color !== 'transparent' ? color : 'rgba(255,255,255,0.92)',
        borderRadius: ov.borderRadius ?? 16,
        border: ov.border ?? '1px solid rgba(53,39,66,0.08)',
        boxShadow: ov.boxShadow ?? '0 8px 22px rgba(53,39,66,0.10)',
        padding: 14, overflow: 'hidden', opacity: ov.opacity,
        userSelect: 'none', pointerEvents: 'none',
      }}>
        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(53,39,66,0.06)', overflow: 'hidden' }}>
          {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (isMusic ? '🎵' : '🔗')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontFamily: fam, fontWeight: 700, fontSize: 15, color: textColor ?? 'rgba(53,39,66,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shownTitle || (isMusic ? 'Now spinning' : 'My link')}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(53,39,66,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {domain || content}
          </p>
        </div>
        <span style={{ flexShrink: 0, fontSize: 13, color: 'rgba(53,39,66,0.4)' }}>↗</span>
      </div>
    )
  }

  // ── Photo / doodle → polaroid frame ─────────────────────────────────────────
  if (hasImage) {
    return (
      <div style={{
        ...fill,
        display: 'flex', flexDirection: 'column',
        background: color && color !== 'transparent' && !color.startsWith('rgba(255,255,255') ? color : '#fffdfa',
        borderRadius: ov.borderRadius ?? 6,
        padding: 8,
        paddingBottom: shownTitle ? 30 : 8,
        boxShadow: ov.boxShadow ?? '0 10px 24px rgba(53,39,66,0.18), inset 0 0 0 1px rgba(53,39,66,0.05)',
        opacity: ov.opacity,
        userSelect: 'none', pointerEvents: 'none', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', borderRadius: 2, background: '#f1ece6' }}>
          <img
            src={imageUrl} alt={shownTitle}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        {shownTitle && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: fam ?? "'Dancing Script', 'Segoe Script', cursive",
            fontSize: 15, color: textColor ?? 'rgba(53,39,66,0.78)',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '0 10px',
          }}>
            {pinned && <span style={{ fontSize: 11 }}>📌</span>}
            {shownTitle}
          </div>
        )}
      </div>
    )
  }

  // ── Note / about cards — material driven by style.texture ────────────────────
  const texture = style.texture ?? (itemType === 'about' ? 'card' : 'paper')
  const paper = visitorMode ? '#fff7b0' : (color && color !== 'transparent' ? color : (itemType === 'about' ? '#d9f7ff' : '#ffe08a'))
  const labelRow = (
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      {pinned && <PinIcon />}
      {visitorMode && (
        <span style={{ borderRadius: 9999, padding: '2px 6px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', background: '#fde68a', color: '#78350f' }}>visitor</span>
      )}
      {shownTitle ? (
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(53,39,66,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shownTitle}
        </span>
      ) : null}
    </div>
  )
  const bodyText = (
    <p style={{ fontSize: itemType === 'about' ? 15 : 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: textColor ?? 'rgba(53,39,66,0.82)', fontFamily: fam, margin: 0 }}>
      {content}
    </p>
  )

  // Soft rounded card
  if (texture === 'card') {
    return (
      <div style={{
        ...fill, borderRadius: ov.borderRadius ?? 20,
        border: ov.border ?? '1px solid rgba(255,255,255,0.6)',
        background: paper, padding: 18, overflow: 'hidden',
        boxShadow: ov.boxShadow ?? '0 10px 28px rgba(53,39,66,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
        opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none',
      }}>
        {labelRow}
        {bodyText}
      </div>
    )
  }

  // Plain minimal card
  if (texture === 'plain') {
    return (
      <div style={{
        ...fill, borderRadius: ov.borderRadius ?? 12,
        border: ov.border ?? '1px solid rgba(53,39,66,0.10)',
        background: color && color !== 'transparent' ? color : 'rgba(255,255,255,0.9)',
        padding: 14, overflow: 'hidden',
        boxShadow: ov.boxShadow ?? 'none',
        opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none',
      }}>
        {labelRow}
        {bodyText}
      </div>
    )
  }

  // Default: paper sticky note
  return (
    <div style={{
      ...fill, position: 'relative',
      background: `linear-gradient(160deg, ${paper}, ${shadeColor(paper, -6)})`,
      padding: 14, borderRadius: ov.borderRadius ?? 2,
      boxShadow: ov.boxShadow ?? '0 1px 1px rgba(53,39,66,0.10), 6px 10px 18px rgba(53,39,66,0.14)',
      border: ov.border, opacity: ov.opacity,
      userSelect: 'none', pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* washi tape */}
      <div style={{
        position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(-2deg)',
        width: 58, height: 18, borderRadius: 1,
        background: 'rgba(255,255,255,0.45)', boxShadow: '0 1px 2px rgba(53,39,66,0.10)',
      }} />
      {labelRow}
      <p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: textColor ?? 'rgba(53,39,66,0.82)', fontFamily: fam, margin: 0 }}>
        {content}
      </p>
      {/* curled corner */}
      <div style={{
        position: 'absolute', right: 0, bottom: 0, width: 0, height: 0,
        borderStyle: 'solid', borderWidth: '0 0 16px 16px',
        borderColor: `transparent transparent ${shadeColor(paper, -14)} transparent`,
        filter: 'drop-shadow(-1px -1px 1px rgba(53,39,66,0.12))',
      }} />
    </div>
  )
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2l3 7h5l-4 3 1.5 7L12 15l-5.5 4L8 12 4 9h5z" stroke="rgba(53,39,66,0.55)" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(53,39,66,0.15)" />
    </svg>
  )
}

// Darken/lighten a hex color by a percentage (negative = darker).
function shadeColor(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const f = (h: string) => clamp(parseInt(h, 16) * (1 + percent / 100))
  const to2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to2(f(m[1]))}${to2(f(m[2]))}${to2(f(m[3]))}`
}

const SHADOW_CSS: Record<NonNullable<SpaceItemStyle['shadow']>, string> = {
  none: 'none',
  soft: '0 6px 18px rgba(53,39,66,0.10)',
  strong: '0 16px 36px rgba(53,39,66,0.24)',
}

// Per-element style → container CSS overrides (undefined = keep the material default).
function containerOverrides(style: SpaceItemStyle): {
  borderRadius?: number
  opacity?: number
  border?: string
  boxShadow?: string
} {
  return {
    borderRadius: style.radius,
    opacity: style.opacity != null ? Math.max(0, Math.min(1, style.opacity / 100)) : undefined,
    border: style.borderColor ? `1px solid ${style.borderColor}` : undefined,
    boxShadow: style.shadow ? SHADOW_CSS[style.shadow] : undefined,
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// CSS transform for a positioned item (translate from x/y, rotate from degrees).
function itemTransform(x: number, y: number, rotation: number): string {
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`
}

// ─── Public component ─────────────────────────────────────────────────────────

interface SpaceBoardProps {
  items: SpaceItem[]
  isOwner: boolean
  accent: string
  onItemChange: (itemId: string, patch: Partial<SpaceItem>) => void
  onSelectItem: (itemId: string | null) => void
  onEditItem: (itemId: string) => void
  onDeleteItem: (itemId: string) => void
  selectedItemId: string | null
}

export default function SpaceBoard({ items, isOwner, accent, onItemChange, onSelectItem, onEditItem, onDeleteItem, selectedItemId }: SpaceBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<InfiniteViewer>(null)
  const moveableRef = useRef<Moveable>(null)
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map())

  const [zoom, setZoom] = useState(1)
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null)
  const [editBtn, setEditBtn] = useState<{ x: number; y: number; id: string } | null>(null)

  // Live frame mutated by Moveable during a gesture; seeded on each gesture start.
  const frameRef = useRef<{ translate: [number, number]; rotate: number }>({ translate: [0, 0], rotate: 0 })

  // Latest items, for reads inside event handlers without stale closures.
  const itemsRef = useRef(items)
  itemsRef.current = items

  // ── Floating ✎ button position (screen-space, like the previous tldraw overlay) ──
  const updateEditBtn = useCallback(() => {
    if (!isOwner) { setEditBtn(null); return }
    const id = selectedItemId
    const el = id ? elementsRef.current.get(id) : null
    const board = boardRef.current
    if (!id || !el || !board) { setEditBtn(null); return }
    const r = el.getBoundingClientRect()
    const b = board.getBoundingClientRect()
    // Anchor the control stack to the item's top-right corner.
    setEditBtn({ x: r.right - b.left, y: r.top - b.top, id })
  }, [isOwner, selectedItemId])

  // Point Moveable at the selected element (owner only). `items` in deps so a
  // remounted element is re-grabbed from the ref map.
  useLayoutEffect(() => {
    if (!isOwner) { setTargetEl(null); return }
    setTargetEl(selectedItemId ? elementsRef.current.get(selectedItemId) ?? null : null)
  }, [selectedItemId, isOwner, items])

  // Keep the edit button glued to the selection across selection/content changes.
  useLayoutEffect(() => {
    updateEditBtn()
  }, [updateEditBtn, items, zoom])

  // ── Fit all items into view once, on first mount (replaces tldraw zoomToFit) ──
  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || items.length === 0) return
    const viewer = viewerRef.current
    const board = boardRef.current
    if (!viewer || !board) return
    didFit.current = true
    requestAnimationFrame(() => {
      const cw = board.clientWidth
      const ch = board.clientHeight
      const list = itemsRef.current
      if (!cw || !ch || list.length === 0) return
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const it of list) {
        const w = it.width ?? 200
        const h = it.height ?? 160
        minX = Math.min(minX, it.x); minY = Math.min(minY, it.y)
        maxX = Math.max(maxX, it.x + w); maxY = Math.max(maxY, it.y + h)
      }
      const pad = 96
      const bw = Math.max(1, maxX - minX)
      const bh = Math.max(1, maxY - minY)
      const z = Math.max(ZOOM_RANGE[0], Math.min(ZOOM_RANGE[1], Math.min((cw - pad) / bw, (ch - pad) / bh, 1)))
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      viewer.setZoom(z)
      viewer.scrollTo(cx - cw / (2 * z), cy - ch / (2 * z))
      setZoom(z)
    })
  }, [items])

  // ── Gesture seeding / persistence helpers ────────────────────────────────────
  const seedFrame = useCallback(() => {
    const it = itemsRef.current.find((i) => i.id === selectedItemId)
    frameRef.current = { translate: [it?.x ?? 0, it?.y ?? 0], rotate: it?.rotation ?? 0 }
  }, [selectedItemId])

  const persist = useCallback((target: HTMLElement | SVGElement) => {
    if (!selectedItemId) return
    const el = target as HTMLElement
    onItemChange(selectedItemId, {
      x: Math.round(frameRef.current.translate[0]),
      y: Math.round(frameRef.current.translate[1]),
      width: Math.round(el.offsetWidth),
      height: Math.round(el.offsetHeight),
      rotation: Math.round(frameRef.current.rotate * 10) / 10,
    })
  }, [onItemChange, selectedItemId])

  // ── Viewer events ────────────────────────────────────────────────────────────
  const onViewerScroll = useCallback((e: OnViewerScroll) => {
    setZoom(e.zoomX)
    moveableRef.current?.updateRect()
    updateEditBtn()
  }, [updateEditBtn])

  return (
    <div
      ref={boardRef}
      className="absolute inset-0"
      style={{
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Contain the edit-button overlay's z-index so it can't stack above the
        // floating toolbar / panels / item sheet that live outside this canvas.
        isolation: 'isolate',
      }}
    >
      <InfiniteViewer
        ref={viewerRef}
        className="absolute inset-0 h-full w-full"
        useMouseDrag
        useWheelScroll
        useGesture
        usePinch
        useAutoZoom
        zoomRange={ZOOM_RANGE}
        displayHorizontalScroll={false}
        displayVerticalScroll={false}
        margin={0}
        threshold={0}
        onScroll={onViewerScroll}
        // A press on an item (or its Moveable handles) must NOT start a viewer
        // pan — gesto sits between the item and React's delegated root, so it
        // fires before our item handler and stopPropagation can't reach it.
        // Returning false here cancels the pan, so the press only selects (and
        // never triggers the deselect in onDragEnd below).
        onDragStart={(e) => {
          const t = e.inputEvent?.target as HTMLElement | null
          if (t?.closest?.('[data-item-id], .moveable-control-box, .moveable-area')) {
            return false
          }
        }}
        // A press on empty canvas that doesn't turn into a pan = deselect.
        onDragEnd={(e) => { if (!e.isDrag) onSelectItem(null) }}
      >
        <div className="viewport" style={{ position: 'relative' }}>
          {items.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) elementsRef.current.set(item.id, el)
                else elementsRef.current.delete(item.id)
              }}
              data-item-id={item.id}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: item.width ?? 200,
                height: item.height ?? 160,
                transform: itemTransform(item.x, item.y, item.rotation ?? 0),
                transformOrigin: 'center center',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              onPointerDown={(e) => {
                if (!isOwner) return
                // Select on press and keep the viewer from panning, so a press on
                // an item never scrolls the canvas.
                e.stopPropagation()
                if (selectedItemId !== item.id) onSelectItem(item.id)
              }}
              // Visitors can't select/drag, but tapping an item opens the
              // read-only sheet (notes read in full, link/music cards openable).
              onClick={() => { if (!isOwner) onEditItem(item.id) }}
            >
              <SpaceItemContent item={item} />
            </div>
          ))}
        </div>
      </InfiniteViewer>

      {/* Moveable lives OUTSIDE the zoomed viewport (screen space). This lets it
          walk up through the viewport's scale transform to the target, so drag /
          resize deltas are correctly de-scaled by the current zoom — without this
          the item lags the cursor ("parallax") at any zoom ≠ 1. */}
      {isOwner && targetEl && (
        <Moveable
          ref={moveableRef}
          target={targetEl}
          rootContainer={boardRef.current ?? undefined}
          flushSync={flushSync}
          origin={false}
          draggable
          resizable
          rotatable
          keepRatio={false}
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          onDragStart={(e) => { seedFrame(); e.set(frameRef.current.translate) }}
          onDrag={(e) => {
            frameRef.current.translate = [e.beforeTranslate[0], e.beforeTranslate[1]]
            e.target.style.transform = itemTransform(e.beforeTranslate[0], e.beforeTranslate[1], frameRef.current.rotate)
            updateEditBtn()
          }}
          onDragEnd={(e) => persist(e.target)}
          onResizeStart={(e) => {
            seedFrame()
            e.setOrigin(['%', '%'])
            if (e.dragStart) e.dragStart.set(frameRef.current.translate)
          }}
          onResize={(e) => {
            frameRef.current.translate = [e.drag.beforeTranslate[0], e.drag.beforeTranslate[1]]
            e.target.style.width = `${e.width}px`
            e.target.style.height = `${e.height}px`
            e.target.style.transform = itemTransform(e.drag.beforeTranslate[0], e.drag.beforeTranslate[1], frameRef.current.rotate)
            updateEditBtn()
          }}
          onResizeEnd={(e) => persist(e.target)}
          onRotateStart={(e) => { seedFrame(); e.set(frameRef.current.rotate) }}
          onRotate={(e) => {
            frameRef.current.rotate = e.beforeRotate
            e.target.style.transform = itemTransform(frameRef.current.translate[0], frameRef.current.translate[1], e.beforeRotate)
            updateEditBtn()
          }}
          onRotateEnd={(e) => persist(e.target)}
        />
      )}

      {/* Floating controls at the selected item's top-right corner, running down
          the right side (owner only): edit (✎) on top, delete (✕) underneath. */}
      {isOwner && editBtn && (
        <div
          style={{
            position: 'absolute', left: editBtn.x, top: editBtn.y,
            transform: 'translate(10px, 0)',
            display: 'flex', flexDirection: 'column', gap: 8,
            zIndex: 1000, pointerEvents: 'all',
          }}
        >
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEditItem(editBtn.id) }}
            title="Edit"
            aria-label="Edit item"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 9999,
              background: accent, color: 'white', border: '2px solid white',
              boxShadow: '0 4px 14px rgba(53,39,66,0.30)', cursor: 'pointer', fontSize: 15,
            }}
          >
            ✎
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDeleteItem(editBtn.id) }}
            title="Delete"
            aria-label="Delete item"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 9999,
              background: '#ef4444', color: 'white', border: '2px solid white',
              boxShadow: '0 4px 14px rgba(53,39,66,0.30)', cursor: 'pointer', fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
