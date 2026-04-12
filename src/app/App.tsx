import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileDown, FileUp, Plus, X } from 'lucide-react'

import { CardComposer, CardPreview, appCardRepository } from '../features/cards'
import type { CardRecord } from '../lib/storage'
import { ImportExportPanel } from '../features/import-export'
import type { CardRepository } from '../lib/storage/repository'
import { getTotpTimeWindow } from '../lib/totp'
import { appCardCollectionStore, type CardCollectionStore, useCardCollection } from './card-store'
import { appTimeStore, type TimeStore, useTimeSnapshot } from './time-store'
import './app.css'

interface AppProps {
  cardStore?: CardCollectionStore
  timeStore?: TimeStore
  cardRepository?: CardRepository
}

type WorkspaceState =
  | { mode: 'create'; focusField: 'secret' | 'note' }
  | { mode: 'edit'; focusField: 'secret' | 'note'; card: CardRecord }

function App({
  cardStore = appCardCollectionStore,
  timeStore = appTimeStore,
  cardRepository = appCardRepository,
}: AppProps) {
  const collection = useCardCollection(cardStore)
  const now = useTimeSnapshot(timeStore)
  const timeWindow = useMemo(() => getTotpTimeWindow(now), [now])
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null)
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null)
  const workspacePanelRef = useRef<HTMLElement | null>(null)
  const secretInputRef = useRef<HTMLInputElement | null>(null)
  const noteInputRef = useRef<HTMLInputElement | null>(null)
  const isWorkspaceOpen = workspaceState !== null
  const orderedCards = useMemo(
    () => sortCardsByIds(collection.cards, previewOrderIds),
    [collection.cards, previewOrderIds],
  )

  const closeWorkspace = useCallback(() => {
    setWorkspaceState(null)
  }, [])

  useEffect(() => {
    if (!isWorkspaceOpen) {
      return undefined
    }

    const focusTarget = workspaceState?.focusField === 'note' ? noteInputRef.current : secretInputRef.current

    focusTarget?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeWorkspace()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const panel = workspacePanelRef.current

      if (!panel) {
        return
      }

      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[href]',
        '[tabindex]:not([tabindex="-1"])',
      ]
      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelectors.join(', ')),
      ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

      if (focusableElements.length === 0) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeWorkspace, isWorkspaceOpen, workspaceState?.focusField])

  const openCreateWorkspace = (focusField: 'secret' | 'note' = 'secret') => {
    setWorkspaceState({ mode: 'create', focusField })
  }

  const openEditWorkspace = (card: CardRecord, focusField: 'secret' | 'note') => {
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

        <div className="card-list" data-testid="card-list" aria-live="polite">
          {!collection.hydrated ? (
            <div className="status-card status-card--loading">正在同步本地卡片…</div>
          ) : collection.error ? (
            <div className="status-card status-card--warning">无法读取本地数据：{collection.error.message}</div>
          ) : collection.cards.length === 0 ? (
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
                  repository={cardRepository}
                  timeWindow={timeWindow}
                  draggable
                  isDragging={draggedCardId === card.id}
                  isDropTarget={dropTargetCardId === card.id && draggedCardId !== card.id}
                  onDragEnd={() => {
                    resetDragState()
                  }}
                  onDragOver={() => {
                    handlePreviewReorder(card.id)
                  }}
                  onDragStart={() => {
                    handleDragStart(card.id)
                  }}
                  onDrop={() => {
                    handleDropReorder(card.id)
                  }}
                  onEditNote={() => {
                    openEditWorkspace(card, 'note')
                  }}
                  onEditSecret={() => {
                    openEditWorkspace(card, 'secret')
                  }}
                />
              ))}
            </>
          )}
        </div>
      </main>

      {isWorkspaceOpen ? (
        <div
          className="workspace-overlay"
          data-testid="workspace-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeWorkspace()
            }
          }}
        >
          <section
            aria-labelledby="workspace-title"
            aria-modal="true"
            className="workspace-panel shell-panel"
            role="dialog"
            ref={workspacePanelRef}
          >
            <div className="workspace-panel__header">
              <div>
                <h2 id="workspace-title">{workspaceState?.mode === 'edit' ? '编辑卡片' : '添加卡片'}</h2>
              </div>

              <button
                className="workspace-panel__close"
                data-testid="close-composer-button"
                type="button"
                onClick={closeWorkspace}
              >
                <X aria-hidden="true" size={16} strokeWidth={2.2} />
                <span className="sr-only">关闭工作区</span>
              </button>
            </div>

            <CardComposer
              key={workspaceState?.mode === 'edit' ? `${workspaceState.card.id}-${workspaceState.focusField}` : `create-${workspaceState?.focusField ?? 'secret'}`}
              card={workspaceState?.mode === 'edit' ? workspaceState.card : undefined}
              compact
              mode={workspaceState?.mode ?? 'create'}
              noteInputRef={noteInputRef}
              repository={cardRepository}
              secretInputRef={secretInputRef}
              onSaved={() => {
                cardStore.refresh()
                closeWorkspace()
              }}
            />
          </section>
        </div>
      ) : null}
    </>
  )
}

export default App

function moveCard(ids: string[], draggedId: string, targetId: string): string[] {
  const draggedIndex = ids.indexOf(draggedId)
  const targetIndex = ids.indexOf(targetId)

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return ids
  }

  const nextIds = [...ids]
  const [dragged] = nextIds.splice(draggedIndex, 1)
  nextIds.splice(targetIndex, 0, dragged)
  return nextIds
}

function sortCardsByIds(cards: CardRecord[], orderIds: string[] | null): CardRecord[] {
  if (!orderIds) {
    return cards
  }

  const cardMap = new Map(cards.map((card) => [card.id, card]))
  const orderedCards: CardRecord[] = []

  for (const id of orderIds) {
    const card = cardMap.get(id)

    if (!card) {
      return cards
    }

    orderedCards.push(card)
    cardMap.delete(id)
  }

  if (cardMap.size > 0) {
    return cards
  }

  return orderedCards
}
