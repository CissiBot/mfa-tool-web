import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export interface ConfirmationDialogProps {
  title: string
  description: string
  confirmLabel: string
  confirmTestId: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  confirmTestId,
  cancelLabel = '取消',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  const dialog = (
    <div className="confirm-overlay" data-testid="confirm-dialog-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirm-dialog"
        data-testid="confirm-dialog"
        role="dialog"
      >
        <div className="confirm-dialog__copy">
          <span className="section-tag section-tag--muted">风险确认</span>
          <h3 id={titleId}>{title}</h3>
          <p id={descriptionId}>{description}</p>
        </div>

        <div className="confirm-dialog__actions">
          <button data-testid="cancel-confirm-button" type="button" onClick={onCancel}>
            <span>{cancelLabel}</span>
          </button>
          <button
            className="confirm-dialog__confirm"
            data-testid={confirmTestId}
            data-tone={tone}
            type="button"
            onClick={onConfirm}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return dialog
  }

  return createPortal(dialog, document.body)
}
