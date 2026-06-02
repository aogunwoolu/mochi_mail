'use client'

import { useEffect, useRef } from 'react'
import {
  Tldraw,
  useEditor,
  useValue,
  createShapeId,
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
  T,
  type TLRecord,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { SpaceItem, SpaceItemStyle } from '@/types'
import { fontCss } from '@/lib/spaceConfig'

// ─── Shape type ───────────────────────────────────────────────────────────────

type SpaceItemProps = {
  w: number
  h: number
  itemId: string
  itemType: string
  title: string
  content: string
  color: string
  imageUrl: string
  styleJson: string
}

type SpaceItemShape = TLBaseShape<'space-item', SpaceItemProps>

// Register with tldraw's global type system so ShapeUtil<SpaceItemShape> is valid
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'space-item': SpaceItemProps
  }
}

// ─── Shape util ───────────────────────────────────────────────────────────────

class SpaceItemUtil extends ShapeUtil<SpaceItemShape> {
  static override type = 'space-item' as const
  static override props = {
    w: T.number,
    h: T.number,
    itemId: T.string,
    itemType: T.string,
    title: T.string,
    content: T.string,
    color: T.string,
    imageUrl: T.string,
    styleJson: T.string,
  }

  getDefaultProps(): SpaceItemProps {
    return { w: 200, h: 160, itemId: '', itemType: 'note', title: '', content: '', color: '#ffe08a', imageUrl: '', styleJson: '' }
  }

  getGeometry(shape: SpaceItemShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  getIndicatorPath(shape: SpaceItemShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  // Keep space items mounted regardless of viewport — without this, tldraw culls
  // these custom HTML shapes off-screen and they visibly "disappear".
  override canCull(): boolean {
    return false
  }

  component(shape: SpaceItemShape) {
    const { w, h, color, itemType, title, content, imageUrl, styleJson } = shape.props
    const stickerMode = color === 'sticker'
    const visitorMode = color === 'visitor'
    const pinned = title.startsWith('📌 ')
    const shownTitle = pinned ? title.slice(3) : title
    const hasImage = (itemType === 'image' || itemType === 'drawing') && !!imageUrl
    const style = parseStyleJson(styleJson)
    const ov = containerOverrides(style)
    const textColor = style.textColor
    const fam = style.fontFamily ? fontCss(style.fontFamily) : undefined

    // ── Emoji sticker ──────────────────────────────────────────────────────────
    if (stickerMode) {
      return (
        <HTMLContainer>
          <div style={{
            width: w, height: h,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.min(w, h) * 0.72,
            filter: 'drop-shadow(0 4px 8px rgba(53,39,66,0.18))',
            opacity: ov.opacity,
            userSelect: 'none', pointerEvents: 'none',
          }}>
            {content}
          </div>
        </HTMLContainer>
      )
    }

    // ── Header / heading text ───────────────────────────────────────────────────
    if (itemType === 'header') {
      return (
        <HTMLContainer>
          <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none' }}>
            <span style={{
              fontFamily: fam, fontWeight: 800, fontSize: Math.min(h * 0.52, 34), lineHeight: 1.1,
              letterSpacing: '-0.01em', color: textColor ?? 'rgba(53,39,66,0.92)', whiteSpace: 'pre-wrap',
            }}>
              {shownTitle || 'Section title'}
            </span>
          </div>
        </HTMLContainer>
      )
    }

    // ── Divider ─────────────────────────────────────────────────────────────────
    if (itemType === 'divider') {
      const line = style.borderColor ?? textColor ?? 'rgba(53,39,66,0.25)'
      return (
        <HTMLContainer>
          <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', gap: 0, opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none' }}>
            <div style={{ flex: 1, borderTop: `2px dashed ${line}` }} />
            {shownTitle ? <span style={{ padding: '0 12px', fontSize: 12, fontWeight: 600, color: line, fontFamily: fam, whiteSpace: 'nowrap' }}>{shownTitle}</span> : null}
            {shownTitle ? <div style={{ flex: 1, borderTop: `2px dashed ${line}` }} /> : null}
          </div>
        </HTMLContainer>
      )
    }

    // ── Link / music card ───────────────────────────────────────────────────────
    if (itemType === 'link' || itemType === 'music') {
      const isMusic = itemType === 'music'
      const domain = domainOf(content)
      return (
        <HTMLContainer>
          <div style={{
            width: w, height: h, display: 'flex', alignItems: 'center', gap: 12,
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
        </HTMLContainer>
      )
    }

    // ── Photo / doodle → polaroid frame ─────────────────────────────────────────
    if (hasImage) {
      return (
        <HTMLContainer>
          <div style={{
            width: w, height: h,
            display: 'flex', flexDirection: 'column',
            background: color && color !== 'transparent' && !color.startsWith('rgba(255,255,255') ? color : '#fffdfa',
            borderRadius: ov.borderRadius ?? 6,
            padding: 8,
            paddingBottom: shownTitle ? 30 : 8,
            boxShadow: ov.boxShadow ?? '0 10px 24px rgba(53,39,66,0.18), inset 0 0 0 1px rgba(53,39,66,0.05)',
            opacity: ov.opacity,
            userSelect: 'none', pointerEvents: 'none', overflow: 'hidden',
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
        </HTMLContainer>
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
        <HTMLContainer>
          <div style={{
            width: w, height: h, borderRadius: ov.borderRadius ?? 20,
            border: ov.border ?? '1px solid rgba(255,255,255,0.6)',
            background: paper, padding: 18, overflow: 'hidden',
            boxShadow: ov.boxShadow ?? '0 10px 28px rgba(53,39,66,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
            opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none',
          }}>
            {labelRow}
            {bodyText}
          </div>
        </HTMLContainer>
      )
    }

    // Plain minimal card
    if (texture === 'plain') {
      return (
        <HTMLContainer>
          <div style={{
            width: w, height: h, borderRadius: ov.borderRadius ?? 12,
            border: ov.border ?? '1px solid rgba(53,39,66,0.10)',
            background: color && color !== 'transparent' ? color : 'rgba(255,255,255,0.9)',
            padding: 14, overflow: 'hidden',
            boxShadow: ov.boxShadow ?? 'none',
            opacity: ov.opacity, userSelect: 'none', pointerEvents: 'none',
          }}>
            {labelRow}
            {bodyText}
          </div>
        </HTMLContainer>
      )
    }

    // Default: paper sticky note
    return (
      <HTMLContainer>
        <div style={{
          width: w, height: h, position: 'relative',
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
      </HTMLContainer>
    )
  }
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

function parseStyleJson(json: string): SpaceItemStyle {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as SpaceItemStyle) : {}
  } catch {
    return {}
  }
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

const SHAPE_UTILS = [SpaceItemUtil]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function itemToShapeInit(item: SpaceItem) {
  return {
    id: createShapeId(item.id),
    type: 'space-item' as const,
    x: item.x,
    y: item.y,
    rotation: (item.rotation ?? 0) * (Math.PI / 180),
    props: {
      w: item.width ?? 200,
      h: item.height ?? 160,
      itemId: item.id,
      itemType: item.type,
      title: item.title ?? '',
      content: item.content ?? '',
      color: item.color ?? '#ffe08a',
      imageUrl: item.imageUrl ?? '',
      styleJson: item.style ? JSON.stringify(item.style) : '',
    } satisfies SpaceItemProps,
  }
}

function itemToContentProps(item: SpaceItem): Partial<SpaceItemProps> {
  return {
    title: item.title ?? '',
    content: item.content ?? '',
    color: item.color ?? '#ffe08a',
    imageUrl: item.imageUrl ?? '',
    itemType: item.type,
    styleJson: item.style ? JSON.stringify(item.style) : '',
  }
}

// ─── Inner: syncs items ↔ tldraw shapes ───────────────────────────────────────

function ShapeSyncer({
  items,
  isOwner,
  onItemChange,
}: {
  items: SpaceItem[]
  isOwner: boolean
  onItemChange: (id: string, patch: Partial<SpaceItem>) => void
}) {
  const editor = useEditor()
  const initialized = useRef(false)
  const suppressRef = useRef(false)
  const onItemChangeRef = useRef(onItemChange)
  onItemChangeRef.current = onItemChange

  // Initialize shapes once on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    suppressRef.current = true
    editor.createShapes(items.map(itemToShapeInit))
    if (!isOwner) {
      const shapes = editor.getCurrentPageShapes()
      editor.updateShapes(shapes.map((s) => ({ id: s.id, type: s.type, isLocked: true })))
    }
    suppressRef.current = false

    editor.zoomToFit({ animation: { duration: 0 } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync additions, removals, and content changes (position is owned by tldraw)
  useEffect(() => {
    if (!initialized.current) return
    const existing = editor.getCurrentPageShapes().filter((s) => s.type === 'space-item')
    const existingIds = new Set(existing.map((s) => (s.props as SpaceItemProps).itemId))
    const currentIds = new Set(items.map((i) => i.id))

    suppressRef.current = true

    const toDelete = [...existingIds].filter((id) => !currentIds.has(id))
    if (toDelete.length) editor.deleteShapes(toDelete.map((id) => createShapeId(id)))

    const toAdd = items.filter((i) => !existingIds.has(i.id))
    if (toAdd.length) editor.createShapes(toAdd.map(itemToShapeInit))

    const toUpdate = items.filter((i) => existingIds.has(i.id))
    if (toUpdate.length) {
      editor.updateShapes(
        toUpdate.map((item) => ({ id: createShapeId(item.id), type: 'space-item' as const, props: itemToContentProps(item) }))
      )
    }

    suppressRef.current = false
  }, [editor, items]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist position/size/rotation 250 ms after the last user move
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    return editor.store.listen(
      ({ changes }) => {
        if (suppressRef.current) return
        // tldraw v5: changes.updated values are [from, to] tuples
        for (const tuple of Object.values(changes.updated)) {
          const to = (tuple as [TLRecord, TLRecord])[1]
          if (to.typeName !== 'shape' || (to as SpaceItemShape).type !== 'space-item') continue
          const shape = to as SpaceItemShape & { x: number; y: number; rotation: number }
          clearTimeout(timer)
          timer = setTimeout(() => {
            onItemChangeRef.current(shape.props.itemId, {
              x: Math.round(shape.x),
              y: Math.round(shape.y),
              width: Math.round(shape.props.w),
              height: Math.round(shape.props.h),
              rotation: Math.round(shape.rotation * (180 / Math.PI) * 10) / 10,
            })
          }, 250)
        }
      },
      { scope: 'document', source: 'user' }
    )
  }, [editor])

  return null
}

// ─── Inner: two-way selection sync ────────────────────────────────────────────

function SelectionMonitor({
  onSelectItem,
  selectedItemId,
}: {
  onSelectItem: (id: string | null) => void
  selectedItemId: string | null
}) {
  const editor = useEditor()
  const selectedShapes = useValue('selected-shapes', () => editor.getSelectedShapes(), [editor])

  // tldraw selection → parent
  useEffect(() => {
    if (selectedShapes.length === 1 && selectedShapes[0].type === 'space-item') {
      onSelectItem((selectedShapes[0].props as SpaceItemProps).itemId)
    } else if (selectedShapes.length === 0) {
      onSelectItem(null)
    }
  }, [selectedShapes, onSelectItem])

  // parent deselect (e.g. ItemSheet close button) → tldraw
  useEffect(() => {
    if (selectedItemId === null) editor.selectNone()
  }, [selectedItemId, editor])

  return null
}

// ─── Inner: floating "edit" button beside the selected item ────────────────────

function EditButtonOverlay({ onEdit, accent }: { onEdit: (id: string) => void; accent: string }) {
  const editor = useEditor()
  const pos = useValue(
    'edit-btn-pos',
    () => {
      const selected = editor.getSelectedShapes()
      if (selected.length !== 1 || selected[0].type !== 'space-item') return null
      const shape = selected[0]
      const bounds = editor.getShapePageBounds(shape.id)
      if (!bounds) return null
      const vsb = editor.getViewportScreenBounds()
      const corner = editor.pageToScreen({ x: bounds.maxX, y: bounds.minY })
      return { x: corner.x - vsb.x, y: corner.y - vsb.y, id: (shape.props as SpaceItemProps).itemId }
    },
    [editor],
  )

  if (!pos) return null
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-40%, -60%)', zIndex: 1000, pointerEvents: 'all' }}>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onEdit(pos.id) }}
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
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface SpaceBoardProps {
  items: SpaceItem[]
  isOwner: boolean
  accent: string
  onItemChange: (itemId: string, patch: Partial<SpaceItem>) => void
  onSelectItem: (itemId: string | null) => void
  onEditItem: (itemId: string) => void
  selectedItemId: string | null
}

export default function SpaceBoard({ items, isOwner, accent, onItemChange, onSelectItem, onEditItem, selectedItemId }: SpaceBoardProps) {
  return (
    <div
      className="absolute inset-0"
      style={{
        ['--color-background' as string]: 'transparent',
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Contain the edit-button overlay's z-index so it can't stack above the
        // floating toolbar / panels / item sheet that live outside this canvas.
        isolation: 'isolate',
      } as React.CSSProperties}
    >
      <Tldraw
        shapeUtils={SHAPE_UTILS}
        hideUi
        components={{ Background: () => null }}
        options={{
          // Lower friction = longer glide after finger lift (iOS-native feel)
          cameraSlideFriction: 0.05,
          // Don't debounce zoom — keep pinch-zoom responsive frame-by-frame
          debouncedZoom: false,
        }}
      >
        <ShapeSyncer items={items} isOwner={isOwner} onItemChange={onItemChange} />
        <SelectionMonitor onSelectItem={onSelectItem} selectedItemId={selectedItemId} />
        {isOwner && <EditButtonOverlay onEdit={onEditItem} accent={accent} />}
      </Tldraw>
    </div>
  )
}
