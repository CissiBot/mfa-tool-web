import { createPortal } from 'react-dom'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { CardPreview } from '../features/cards'
import type { CardRecord, StorageError } from '../lib/storage'
import type { CardRepository } from '../lib/storage/repository'
import type { TotpTimeWindow } from '../lib/totp'
import type { WorkspaceFocusField } from './app-workspace-contract'

interface AppCardListSectionProps {
  hydrated: boolean
  error: StorageError | null
  cards: CardRecord[]
  orderedCards: CardRecord[]
  showSecrets: boolean
  repository: CardRepository
  timeWindow: TotpTimeWindow
  draggedCardId: string | null
  onResetDragState: () => void
  onPreviewReorder: (targetIndex: number) => void
  onDragStart: (cardId: string) => void
  onDropReorder: () => void
  onOpenEditWorkspace: (card: CardRecord, focusField: WorkspaceFocusField) => void
  onRequestRemove: (card: CardRecord) => void
}

interface ActivePointerDrag {
  cardId: string
  pointerId: number
  pointerOffsetY: number
  overlayX: number
  overlayY: number
  width: number
  height: number
}

function hashCardId(cardId: string): number {
  let hash = 0

  for (const character of cardId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360
  const normalizedSaturation = saturation / 100
  const normalizedLightness = lightness / 100
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
  const hueSegment = normalizedHue / 60
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1))

  let red = 0
  let green = 0
  let blue = 0

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma
    green = secondary
  } else if (hueSegment < 2) {
    red = secondary
    green = chroma
  } else if (hueSegment < 3) {
    green = chroma
    blue = secondary
  } else if (hueSegment < 4) {
    green = secondary
    blue = chroma
  } else if (hueSegment < 5) {
    red = secondary
    blue = chroma
  } else {
    red = chroma
    blue = secondary
  }

  const lightnessMatch = normalizedLightness - chroma / 2
  const toHex = (channel: number) =>
    Math.round((channel + lightnessMatch) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function createFrameAccent(cardId: string, attempt: number): string {
  const baseHue = hashCardId(cardId) % 360
  const hue = (baseHue + attempt * 47) % 360
  const lightness = 72 - ((attempt % 3) * 4)

  return hslToHex(hue, 82, lightness)
}

function getLayoutViewportTop(element: HTMLElement): number {
  const offsetParent = element.offsetParent instanceof HTMLElement ? element.offsetParent : element.parentElement

  if (!(offsetParent instanceof HTMLElement)) {
    return element.getBoundingClientRect().top
  }

  return offsetParent.getBoundingClientRect().top + element.offsetTop
}

function getLayoutHeight(element: HTMLElement): number {
  return element.offsetHeight || element.getBoundingClientRect().height
}

function getLayoutViewportMidpointY(element: HTMLElement): number {
  return getLayoutViewportTop(element) + getLayoutHeight(element) / 2
}

export function AppCardListSection({
  hydrated,
  error,
  cards,
  orderedCards,
  showSecrets,
  repository,
  timeWindow,
  draggedCardId,
  onResetDragState,
  onPreviewReorder,
  onDragStart,
  onDropReorder,
  onOpenEditWorkspace,
  onRequestRemove,
}: AppCardListSectionProps) {
  const frameAccentByCardId = useMemo(() => {
    const usedAccents = new Set<string>()
    const accentMap = new Map<string, string>()

    orderedCards.forEach((card) => {
      let attempt = 0
      let candidate = createFrameAccent(card.id, attempt)

      while (usedAccents.has(candidate)) {
        attempt += 1
        candidate = createFrameAccent(card.id, attempt)
      }

      accentMap.set(card.id, candidate)
      usedAccents.add(candidate)
    })

    return accentMap
  }, [orderedCards])
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const dragHandleRefs = useRef(new Map<string, HTMLButtonElement>())
  const flipAnimationsRef = useRef(new Map<string, Animation>())
  const previousTopByIdRef = useRef<Map<string, number>>(new Map())
  const activeDragRef = useRef<ActivePointerDrag | null>(null)
  const keyboardDragCardIdRef = useRef<string | null>(null)
  const pointerPreviewIndexRef = useRef<number | null>(null)
  const resolveInsertIndexRef = useRef<(pointerCenterY: number, currentDraggedCardId: string) => number>(() => 0)
  const finishDragRef = useRef<(shouldCommit: boolean) => void>(() => {})
  const [activeDrag, setActiveDrag] = useState<ActivePointerDrag | null>(null)
  const [keyboardDragCardId, setKeyboardDragCardId] = useState<string | null>(null)
  const draggedCard = useMemo(
    () => (draggedCardId ? orderedCards.find((card) => card.id === draggedCardId) ?? null : null),
    [draggedCardId, orderedCards],
  )

  const setItemRef = (cardId: string, node: HTMLDivElement | null) => {
    if (node) {
      itemRefs.current.set(cardId, node)
      return
    }

    itemRefs.current.delete(cardId)
  }

  const setDragHandleRef = (cardId: string, node: HTMLButtonElement | null) => {
    if (node) {
      dragHandleRefs.current.set(cardId, node)
      return
    }

    dragHandleRefs.current.delete(cardId)
  }

  const syncKeyboardDragCardId = (cardId: string | null) => {
    keyboardDragCardIdRef.current = cardId
    setKeyboardDragCardId(cardId)
  }

  const syncActiveDrag = (nextDrag: ActivePointerDrag | null) => {
    activeDragRef.current = nextDrag
    setActiveDrag(nextDrag)
  }

  useEffect(() => {
    resolveInsertIndexRef.current = (pointerCenterY: number, currentDraggedCardId: string) => {
      const remainingCards = orderedCards.filter((card) => card.id !== currentDraggedCardId)

      for (const [index, card] of remainingCards.entries()) {
        const item = itemRefs.current.get(card.id)

        if (!item) {
          continue
        }

        const thresholdY = getLayoutViewportMidpointY(item)

        if (pointerCenterY < thresholdY) {
          return index
        }
      }

      return remainingCards.length
    }
  }, [orderedCards])

  const cleanupDragHandleCapture = (drag: ActivePointerDrag | null) => {
    if (!drag) {
      return
    }

    const handle = dragHandleRefs.current.get(drag.cardId)

    if (handle && typeof handle.hasPointerCapture === 'function' && handle.hasPointerCapture(drag.pointerId)) {
      handle.releasePointerCapture(drag.pointerId)
    }
  }

  useEffect(() => {
    finishDragRef.current = (shouldCommit: boolean) => {
      cleanupDragHandleCapture(activeDragRef.current)
      pointerPreviewIndexRef.current = null
      syncActiveDrag(null)

      if (keyboardDragCardIdRef.current) {
        syncKeyboardDragCardId(null)
      }

      if (shouldCommit) {
        onDropReorder()
        return
      }

      onResetDragState()
    }
  }, [onDropReorder, onResetDragState])

  const beginKeyboardDrag = (cardId: string) => {
    if (activeDragRef.current) {
      return
    }

    onDragStart(cardId)
    syncKeyboardDragCardId(cardId)
  }

  const moveKeyboardDrag = (cardId: string, direction: -1 | 1) => {
    const currentIndex = orderedCards.findIndex((card) => card.id === cardId)

    if (currentIndex === -1) {
      return
    }

    const targetIndex = Math.max(0, Math.min(currentIndex + direction, orderedCards.length - 1))

    if (targetIndex === currentIndex) {
      return
    }

    onPreviewReorder(targetIndex)
  }

  useLayoutEffect(() => {
    if (flipAnimationsRef.current.size > 0) {
      flipAnimationsRef.current.forEach((animation) => {
        animation.cancel()
      })
      flipAnimationsRef.current.clear()
    }

    const nextTopById = new Map<string, number>()

    orderedCards.forEach((card) => {
      const item = itemRefs.current.get(card.id)

      if (item) {
        nextTopById.set(card.id, getLayoutViewportTop(item))
      }
    })

    const previousTopById = previousTopByIdRef.current

    if (previousTopById.size > 0) {
      nextTopById.forEach((nextTop, cardId) => {
        if (cardId === draggedCardId) {
          return
        }

        const previousTop = previousTopById.get(cardId)
        const item = itemRefs.current.get(cardId)

        if (previousTop === undefined || !item) {
          return
        }

        const deltaY = previousTop - nextTop

        if (Math.abs(deltaY) < 1 || typeof item.animate !== 'function') {
          return
        }

        const animation = item.animate([{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }], {
          duration: 200,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })

        flipAnimationsRef.current.set(cardId, animation)

        animation.onfinish = () => {
          if (flipAnimationsRef.current.get(cardId) === animation) {
            flipAnimationsRef.current.delete(cardId)
          }
        }

        animation.oncancel = () => {
          if (flipAnimationsRef.current.get(cardId) === animation) {
            flipAnimationsRef.current.delete(cardId)
          }
        }
      })
    }

    previousTopByIdRef.current = nextTopById
  }, [draggedCardId, orderedCards])

  useEffect(() => {
    const flipAnimations = flipAnimationsRef.current

    return () => {
      flipAnimations.forEach((animation) => {
        animation.cancel()
      })

      flipAnimations.clear()
    }
  }, [])

  useEffect(() => {
    if (!draggedCardId) {
      return
    }

    const updateDragPosition = (clientY: number) => {
      const currentDrag = activeDragRef.current

      if (!currentDrag) {
        return
      }

      const nextDrag = {
        ...currentDrag,
        overlayX: currentDrag.overlayX,
        overlayY: clientY - currentDrag.pointerOffsetY,
      }

      syncActiveDrag(nextDrag)

      const pointerCenterY = clientY - currentDrag.pointerOffsetY + currentDrag.height / 2
      const nextPreviewIndex = resolveInsertIndexRef.current(pointerCenterY, currentDrag.cardId)

      if (pointerPreviewIndexRef.current === nextPreviewIndex) {
        return
      }

      pointerPreviewIndexRef.current = nextPreviewIndex
      onPreviewReorder(nextPreviewIndex)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const currentDrag = activeDragRef.current

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return
      }

      event.preventDefault()
      updateDragPosition(event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const currentDrag = activeDragRef.current

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return
      }

      finishDragRef.current(true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const currentDrag = activeDragRef.current

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return
      }

      finishDragRef.current(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finishDragRef.current(false)
      }
    }

    const handleWindowBlur = () => {
      finishDragRef.current(false)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        finishDragRef.current(false)
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [draggedCardId, onPreviewReorder])

  const handleDragHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => {
    if (event.button !== 0 || activeDragRef.current || keyboardDragCardIdRef.current) {
      return
    }

    const item = itemRefs.current.get(cardId)

    if (!item) {
      return
    }

    const rect = item.getBoundingClientRect()
    const nextDrag: ActivePointerDrag = {
      cardId,
      pointerId: event.pointerId,
      pointerOffsetY: event.clientY - rect.top,
      overlayX: rect.left,
      overlayY: rect.top,
      width: rect.width,
      height: rect.height,
    }

    pointerPreviewIndexRef.current = orderedCards.findIndex((card) => card.id === cardId)
    onDragStart(cardId)
    syncActiveDrag(nextDrag)

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    event.preventDefault()
  }

  const handleDragHandleLostPointerCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const currentDrag = activeDragRef.current

    if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
      return
    }

    finishDragRef.current(false)
  }

  const handleDragHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, cardId: string) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()

      if (keyboardDragCardIdRef.current === cardId) {
        finishDragRef.current(true)
        return
      }

      if (!draggedCardId) {
        beginKeyboardDrag(cardId)
      }

      return
    }

    if (keyboardDragCardIdRef.current !== cardId) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      finishDragRef.current(false)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveKeyboardDrag(cardId, -1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveKeyboardDrag(cardId, 1)
    }
  }

  const keyboardDragStatus = keyboardDragCardId
    ? '键盘排序已启动，使用上下方向键移动卡片，按 Enter 确认，按 Escape 取消。'
    : ''

  const overlay =
    activeDrag && draggedCard
      ? createPortal(
          <div
            aria-hidden="true"
            className="card-list__drag-overlay"
            style={{
              left: `${activeDrag.overlayX}px`,
              top: `${activeDrag.overlayY}px`,
              width: `${activeDrag.width}px`,
            }}
          >
            <div inert className="card-list__drag-overlay-inner">
              <CardPreview
                card={draggedCard}
                frameAccent={frameAccentByCardId.get(draggedCard.id)}
                repository={repository}
                timeWindow={timeWindow}
                isDragging
                pauseProgressAnimation
              />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div
        className="card-list"
        data-drag-active={draggedCardId ? 'true' : 'false'}
        data-testid="card-list"
      >
        <span className="sr-only" aria-live="polite">
          {keyboardDragStatus}
        </span>
        {!hydrated ? (
          <div className="status-card status-card--loading">正在同步本地卡片…</div>
        ) : error ? (
          <div className="status-card status-card--warning">无法读取本地数据：{error.message}</div>
        ) : cards.length === 0 ? (
          <div className="empty-state" data-testid="empty-state">
            <span className="empty-state__badge">暂无卡片</span>
            <p>点击“添加卡片”开始使用。</p>
          </div>
        ) : (
          <>
            <div className="card-list__table-head" data-testid="card-table-head" aria-hidden="true">
              <span>备注 / 密钥</span>
              <span>验证码</span>
              <span>操作</span>
            </div>

            {orderedCards.map((card) => {
              const isPlaceholder = activeDrag?.cardId === card.id
              const placeholderStyle =
                isPlaceholder && activeDrag
                  ? ({
                      '--card-frame-accent': frameAccentByCardId.get(card.id) ?? 'var(--color-accent-cyan)',
                      height: `${activeDrag.height}px`,
                    }) as CSSProperties
                  : undefined

              return (
                <div
                  key={card.id}
                  ref={(node) => {
                    setItemRef(card.id, node)
                  }}
                  className="card-list__item"
                  data-drag-placeholder={isPlaceholder ? 'true' : 'false'}
                >
                  {isPlaceholder ? (
                    <div aria-hidden="true" className="card-list__placeholder" style={placeholderStyle} />
                  ) : (
                    <CardPreview
                      card={card}
                      showSecret={showSecrets}
                      frameAccent={frameAccentByCardId.get(card.id)}
                      repository={repository}
                      timeWindow={timeWindow}
                      pauseProgressAnimation={draggedCardId !== null}
                      onDragHandlePointerDown={(event) => {
                        handleDragHandlePointerDown(event, card.id)
                      }}
                      onDragHandleKeyDown={(event) => {
                        handleDragHandleKeyDown(event, card.id)
                      }}
                      onDragHandleLostPointerCapture={handleDragHandleLostPointerCapture}
                      dragHandleRef={(node) => {
                        setDragHandleRef(card.id, node)
                      }}
                      isKeyboardDragging={keyboardDragCardId === card.id}
                      onEditNote={() => {
                        onOpenEditWorkspace(card, 'note')
                      }}
                      onEditSecret={() => {
                        onOpenEditWorkspace(card, 'secret')
                      }}
                      onRequestRemove={() => {
                        onRequestRemove(card)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {overlay}
    </>
  )
}
