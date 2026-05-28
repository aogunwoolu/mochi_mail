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
import { SpaceItem } from '@/types'

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
  }

  getDefaultProps(): SpaceItemProps {
    return { w: 200, h: 160, itemId: '', itemType: 'note', title: '', content: '', color: '#ffe08a', imageUrl: '' }
  }

  getGeometry(shape: SpaceItemShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  getIndicatorPath(shape: SpaceItemShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: SpaceItemShape) {
    const { w, h, color, itemType, title, content, imageUrl } = shape.props
    const stickerMode = color === 'sticker'
    const visitorMode = color === 'visitor'
    const pinned = title.startsWith('📌 ')
    const shownTitle = pinned ? title.slice(3) : title

    if (stickerMode) {
      return (
        <HTMLContainer>
          <div style={{
            width: w, height: h,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.min(w, h) * 0.72,
            userSelect: 'none', pointerEvents: 'none',
          }}>
            {content}
          </div>
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer>
        <div style={{
          width: w, height: h,
          borderRadius: 24,
          border: `1px solid ${visitorMode ? '#e6d20088' : 'rgba(53,39,66,0.08)'}`,
          background: visitorMode ? '#fff8c4' : (color || '#ffe08a'),
          padding: 12, overflow: 'hidden',
          boxShadow: '0 6px 20px rgba(53,39,66,0.09)',
          userSelect: 'none', pointerEvents: 'none',
        }}>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            {pinned && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 2l3 7h5l-4 3 1.5 7L12 15l-5.5 4L8 12 4 9h5z" stroke="rgba(53,39,66,0.55)" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(53,39,66,0.15)" />
              </svg>
            )}
            {visitorMode && (
              <span style={{
                borderRadius: 9999, padding: '2px 6px', fontSize: 8,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                background: '#fde68a', color: '#78350f',
              }}>visitor</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: 'rgba(53,39,66,0.55)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {shownTitle}
            </span>
          </div>
          <div style={{ overflow: 'hidden', height: 'calc(100% - 1.4rem)' }}>
            {(itemType === 'image' || itemType === 'drawing') && imageUrl ? (
              <img
                src={imageUrl} alt={shownTitle}
                style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'cover' }}
              />
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'rgba(53,39,66,0.8)', margin: 0 }}>
                {content}
              </p>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
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

// ─── Public component ─────────────────────────────────────────────────────────

interface SpaceBoardProps {
  items: SpaceItem[]
  isOwner: boolean
  onItemChange: (itemId: string, patch: Partial<SpaceItem>) => void
  onSelectItem: (itemId: string | null) => void
  selectedItemId: string | null
}

export default function SpaceBoard({ items, isOwner, onItemChange, onSelectItem, selectedItemId }: SpaceBoardProps) {
  return (
    <div
      className="absolute inset-0"
      style={{
        ['--color-background' as string]: 'transparent',
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
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
      </Tldraw>
    </div>
  )
}
