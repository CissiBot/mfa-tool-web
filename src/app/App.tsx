import { useCallback, useMemo, useState } from 'react'
import { FileDown, FileUp, Plus } from 'lucide-react'

import { appCardRepository } from '../features/cards'
import type { CardRecord } from '../lib/storage'
import { ImportExportPanel } from '../features/import-export'
import type { CardRepository } from '../lib/storage/repository'
import { getTotpTimeWindow } from '../lib/totp'
import { AppCardListSection } from './AppCardListSection'
import { AppWorkspace, type WorkspaceFocusField, type WorkspaceState } from './AppWorkspace'
import { moveCard, sortCardsByIds } from './app-card-order'
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
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null)
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null)
  const orderedCards = useMemo(
    () => sortCardsByIds(collection.cards, previewOrderIds),
    [collection.cards, previewOrderIds],
  )

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
    setDropTargetCardId(null)
    setPreviewOrderIds(null)
  }, [])

  const handleDragStart = useCallback(
    (cardId: string) => {
      setDraggedCardId(cardId)
      setDropTargetCardId(cardId)
      setPreviewOrderIds(collection.cards.map((card) => card.id))
    },
    [collection.cards],
  )

  const handlePreviewReorder = useCallback(
    (targetCardId: string) => {
      if (!draggedCardId || draggedCardId === targetCardId) {
        return
      }

      setDropTargetCardId(targetCardId)
      setPreviewOrderIds((current) => {
        const baseIds = current ?? collection.cards.map((card) => card.id)
        return moveCard(baseIds, draggedCardId, targetCardId)
      })
    },
    [collection.cards, draggedCardId],
  )

  const handleDropReorder = (targetCardId: string) => {
    if (!draggedCardId) {
      resetDragState()
      return
    }

    const currentIds = collection.cards.map((card) => card.id)
    const orderedIds = previewOrderIds ?? moveCard(currentIds, draggedCardId, targetCardId)

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

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <main className="app-shell app-shell--minimal" id="main-content">
        <h1 className="sr-only">MFA 卡片面板</h1>

        <div className="app-toolbar">
          <div className="app-toolbar__actions">
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
              <Plus aria-hidden="true" size={16} strokeWidth={2.2} />
              <span>添加卡片</span>
            </button>
          </div>
        </div>

        <AppCardListSection
          hydrated={collection.hydrated}
          error={collection.error}
          cards={collection.cards}
          orderedCards={orderedCards}
          repository={cardRepository}
          timeWindow={timeWindow}
          draggedCardId={draggedCardId}
          dropTargetCardId={dropTargetCardId}
          onResetDragState={resetDragState}
          onPreviewReorder={handlePreviewReorder}
          onDragStart={handleDragStart}
          onDropReorder={handleDropReorder}
          onOpenEditWorkspace={openEditWorkspace}
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
    </>
  )
}

export default App
