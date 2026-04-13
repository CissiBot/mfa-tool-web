import { CardPreview } from '../features/cards'
import type { CardRecord, StorageError } from '../lib/storage'
import type { CardRepository } from '../lib/storage/repository'
import type { TotpTimeWindow } from '../lib/totp'
import type { WorkspaceFocusField } from './AppWorkspace'

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
}: AppCardListSectionProps) {
  return (
    <div className="card-list" data-testid="card-list" aria-live="polite">
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
            />
          ))}
        </>
      )}
    </div>
  )
}
