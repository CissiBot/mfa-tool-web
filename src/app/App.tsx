import { useCallback, useMemo, useState } from 'react'
import { Eye, EyeOff, FileDown, FileUp, Plus } from 'lucide-react'

import { appCardRepository } from '../features/cards'
import type { CardRecord } from '../lib/storage'
import { ConfirmationDialog, ImportExportPanel } from '../features/import-export'
import type { CardRepository } from '../lib/storage/repository'
import { getTotpTimeWindow } from '../lib/totp'
import { AppCardListSection } from './AppCardListSection'
import { AppWorkspace } from './AppWorkspace'
import { moveCardToIndex, sortCardsByIds } from './app-card-order'
import type { WorkspaceFocusField, WorkspaceState } from './app-workspace-contract'
import { appCardCollectionStore, type CardCollectionStore, useCardCollection } from './card-store'
import { appTimeStore, type TimeStore, useTimeSnapshot } from './time-store'
import './app.css'

interface AppProps {
  cardStore?: CardCollectionStore
  timeStore?: TimeStore
  cardRepository?: CardRepository
}

function App({
  cardStore = appCardCollectionStore,
  timeStore = appTimeStore,
  cardRepository = appCardRepository,
}: AppProps) {
  const collection = useCardCollection(cardStore)
  const now = useTimeSnapshot(timeStore)
  const timeWindow = useMemo(() => getTotpTimeWindow(now), [now])
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null)
  const [workspaceReturnFocusTarget, setWorkspaceReturnFocusTarget] = useState<HTMLElement | null>(null)
  const [cardPendingRemoval, setCardPendingRemoval] = useState<CardRecord | null>(null)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const orderedCards = useMemo(
    () => sortCardsByIds(collection.cards, previewOrderIds),
    [collection.cards, previewOrderIds],
  )
  const toggleSecretsLabel = showSecrets ? '隐藏密钥' : '显示密钥'
  const ToggleSecretsIcon = showSecrets ? EyeOff : Eye

  const closeWorkspace = useCallback(() => {
    setWorkspaceState(null)
  }, [])

  const openCreateWorkspace = (focusField: WorkspaceFocusField = 'secret') => {
    setWorkspaceReturnFocusTarget(document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setWorkspaceState({ mode: 'create', focusField })
  }

  const openEditWorkspace = (card: CardRecord, focusField: WorkspaceFocusField) => {
    setWorkspaceReturnFocusTarget(document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setWorkspaceState({ mode: 'edit', card, focusField })
  }

  const resetDragState = useCallback(() => {
    setDraggedCardId(null)
    setPreviewOrderIds(null)
  }, [])

  const handleDragStart = useCallback(
    (cardId: string) => {
      setDraggedCardId(cardId)
      setPreviewOrderIds(collection.cards.map((card) => card.id))
    },
    [collection.cards],
  )

  const handlePreviewReorder = useCallback(
    (targetIndex: number) => {
      if (!draggedCardId) {
        return
      }

      setPreviewOrderIds((current) => {
        const baseIds = current ?? collection.cards.map((card) => card.id)
        return moveCardToIndex(baseIds, draggedCardId, targetIndex)
      })
    },
    [collection.cards, draggedCardId],
  )

  const handleDropReorder = () => {
    if (!draggedCardId) {
      resetDragState()
      return
    }

    const currentIds = collection.cards.map((card) => card.id)
    const orderedIds = previewOrderIds ?? currentIds

    resetDragState()

    if (orderedIds.every((id, index) => id === currentIds[index])) {
      return
    }

    const reorderResult = cardRepository.reorder(orderedIds)

    if (!reorderResult.ok) {
      return
    }

    cardStore.refresh()
  }

  const handleConfirmRemoveCard = useCallback(() => {
    if (!cardPendingRemoval) {
      return
    }

    const removeResult = cardRepository.remove(cardPendingRemoval.id)
    setCardPendingRemoval(null)

    if (!removeResult.ok) {
      return
    }

    if (workspaceState?.mode === 'edit' && workspaceState.card.id === cardPendingRemoval.id) {
      closeWorkspace()
    }

    cardStore.refresh()
  }, [cardPendingRemoval, cardRepository, cardStore, closeWorkspace, workspaceState])

  return (
    <>
      <div aria-hidden="true" className="app-background">
        <div className="app-background__stars app-background__stars--near" />
        <div className="app-background__stars app-background__stars--mid" />
        <div className="app-background__stars app-background__stars--far" />
      </div>

      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <main
        className="app-shell app-shell--minimal"
        data-drag-active={draggedCardId ? 'true' : 'false'}
        id="main-content"
      >
        <h1 className="sr-only">MFA 卡片面板</h1>

        <div className="app-toolbar">
          <div className="app-toolbar__actions">
            <button
              aria-pressed={showSecrets}
              className="app-toolbar__toggle-secrets"
              data-testid="toggle-secret-visibility-button"
              type="button"
              onClick={() => {
                setShowSecrets((current) => !current)
              }}
            >
              <span className="app-toolbar__button-circle" aria-hidden="true" />
              <span className="app-toolbar__button-icon app-toolbar__button-icon--lead" aria-hidden="true">
                <ToggleSecretsIcon size={16} strokeWidth={2.2} />
              </span>
              <span className="app-toolbar__button-label">{toggleSecretsLabel}</span>
              <span className="app-toolbar__button-icon app-toolbar__button-icon--trail" aria-hidden="true">
                <ToggleSecretsIcon size={16} strokeWidth={2.2} />
              </span>
            </button>

            <div className="app-toolbar__io">
              <ImportExportPanel
                compact
                toolbar
                cards={collection.cards}
                importIcon={FileUp}
                exportIcon={FileDown}
                repository={cardRepository}
                showClearButton={false}
                onCollectionChanged={() => cardStore.refresh()}
              />
            </div>

            <button
              className="app-toolbar__add"
              data-testid="open-composer-button"
              type="button"
              onClick={() => {
                openCreateWorkspace('secret')
              }}
            >
              <span className="app-toolbar__button-circle" aria-hidden="true" />
              <span className="app-toolbar__button-icon app-toolbar__button-icon--lead" aria-hidden="true">
                <Plus size={16} strokeWidth={2.2} />
              </span>
              <span className="app-toolbar__button-label">添加卡片</span>
              <span className="app-toolbar__button-icon app-toolbar__button-icon--trail" aria-hidden="true">
                <Plus size={16} strokeWidth={2.2} />
              </span>
            </button>
          </div>
        </div>

        <AppCardListSection
          hydrated={collection.hydrated}
          error={collection.error}
          cards={collection.cards}
          orderedCards={orderedCards}
          showSecrets={showSecrets}
          repository={cardRepository}
          timeWindow={timeWindow}
          draggedCardId={draggedCardId}
          onResetDragState={resetDragState}
          onPreviewReorder={handlePreviewReorder}
          onDragStart={handleDragStart}
          onDropReorder={handleDropReorder}
          onOpenEditWorkspace={openEditWorkspace}
          onRequestRemove={(card) => {
            setCardPendingRemoval(card)
          }}
        />
      </main>

      {workspaceState ? (
        <AppWorkspace
          workspaceState={workspaceState}
          repository={cardRepository}
          returnFocusTarget={workspaceReturnFocusTarget}
          onClose={closeWorkspace}
          onSaved={() => {
            cardStore.refresh()
            closeWorkspace()
          }}
        />
      ) : null}

      {cardPendingRemoval ? (
        <ConfirmationDialog
          confirmLabel="确认删除这张卡片"
          confirmTestId="confirm-delete-card-button"
          description={`将删除“${cardPendingRemoval.note || '未命名卡片'}”这张本地卡片，取消前数据不会变化。`}
          title="确认删除这张卡片？"
          onCancel={() => {
            setCardPendingRemoval(null)
          }}
          onConfirm={handleConfirmRemoveCard}
        />
      ) : null}
    </>
  )
}

export default App
