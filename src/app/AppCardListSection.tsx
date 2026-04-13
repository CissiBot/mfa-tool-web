import { useMemo } from 'react'

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
  repository: CardRepository
  timeWindow: TotpTimeWindow
  draggedCardId: string | null
  dropTargetCardId: string | null
  onResetDragState: () => void
  onPreviewReorder: (targetCardId: string) => void
  onDragStart: (cardId: string) => void
  onDropReorder: (targetCardId: string) => void
  onOpenEditWorkspace: (card: CardRecord, focusField: WorkspaceFocusField) => void
  onRequestRemove: (card: CardRecord) => void
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

export function AppCardListSection({
  hydrated,
  error,
  cards,
  orderedCards,
  repository,
  timeWindow,
  draggedCardId,
  dropTargetCardId,
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

  return (
    <div
      className="card-list"
      data-drag-active={draggedCardId ? 'true' : 'false'}
      data-testid="card-list"
    >
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

          {orderedCards.map((card) => (
            <CardPreview
              key={card.id}
              card={card}
              frameAccent={frameAccentByCardId.get(card.id)}
              repository={repository}
              timeWindow={timeWindow}
              draggable
              isDragging={draggedCardId === card.id}
              isDropTarget={dropTargetCardId === card.id && draggedCardId !== card.id}
              onDragEnd={onResetDragState}
              onDragOver={() => {
                onPreviewReorder(card.id)
              }}
              onDragStart={() => {
                onDragStart(card.id)
              }}
              onDrop={() => {
                onDropReorder(card.id)
              }}
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
          ))}
        </>
      )}
    </div>
  )
}
