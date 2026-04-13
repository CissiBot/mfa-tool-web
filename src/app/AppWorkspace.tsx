import { useEffect, useRef, type ComponentProps } from 'react'
import { X } from 'lucide-react'

import { CardComposer } from '../features/cards'
import type { CardRecord } from '../lib/storage'
import type { CardRepository } from '../lib/storage/repository'

export type WorkspaceFocusField = 'secret' | 'note'

export type WorkspaceState =
  | { mode: 'create'; focusField: WorkspaceFocusField }
  | { mode: 'edit'; focusField: WorkspaceFocusField; card: CardRecord }

interface AppWorkspaceProps {
  workspaceState: WorkspaceState
  repository: CardRepository
  returnFocusTarget: HTMLElement | null
  onClose: () => void
  onSaved: (card: CardRecord) => void
}

type InputRef = ComponentProps<'input'>['ref']

export function AppWorkspace({
  workspaceState,
  repository,
  returnFocusTarget,
  onClose,
  onSaved,
}: AppWorkspaceProps) {
  const workspacePanelRef = useRef<HTMLElement | null>(null)
  const secretInputRef = useRef<HTMLInputElement | null>(null)
  const noteInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const focusTarget = workspaceState.focusField === 'note' ? noteInputRef.current : secretInputRef.current

    focusTarget?.focus()

    return () => {
      returnFocusTarget?.focus()
    }
  }, [returnFocusTarget, workspaceState.focusField])

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const panel = workspacePanelRef.current

    if (!panel) {
      return
    }

    const focusableElements = getFocusableElements(panel)

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

  return (
    <div
      className="workspace-overlay"
      data-testid="workspace-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="workspace-title"
        aria-modal="true"
        className="workspace-panel shell-panel"
        role="dialog"
        ref={workspacePanelRef}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="workspace-panel__header">
          <div>
            <h2 id="workspace-title">{workspaceState.mode === 'edit' ? '编辑卡片' : '添加卡片'}</h2>
          </div>

          <button
            className="workspace-panel__close"
            data-testid="close-composer-button"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} strokeWidth={2.2} />
            <span className="sr-only">关闭工作区</span>
          </button>
        </div>

        <CardComposer
          key={getWorkspaceComposerKey(workspaceState)}
          card={workspaceState.mode === 'edit' ? workspaceState.card : undefined}
          compact
          mode={workspaceState.mode}
          noteInputRef={noteInputRef as InputRef}
          repository={repository}
          secretInputRef={secretInputRef as InputRef}
          onSaved={onSaved}
        />
      </section>
    </div>
  )
}

function getWorkspaceComposerKey(workspaceState: WorkspaceState): string {
  if (workspaceState.mode === 'edit') {
    return `${workspaceState.card.id}-${workspaceState.focusField}`
  }

  return `create-${workspaceState.focusField}`
}

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[href]',
    '[tabindex]:not([tabindex="-1"])',
  ]

  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors.join(', '))).filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  )
}
