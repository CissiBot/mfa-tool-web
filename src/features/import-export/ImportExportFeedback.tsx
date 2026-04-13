import { createPortal } from 'react-dom'

import type { ImportCardsSummary } from './io'

export type ImportExportFeedback =
  | {
      kind: 'summary'
      tone: 'success' | 'warning' | 'danger'
      title: string
      description: string
      summary: ImportCardsSummary
    }
  | {
      kind: 'message'
      tone: 'success' | 'danger'
      title: string
      description: string
    }

interface ImportExportFeedbackPanelProps {
  feedback: ImportExportFeedback
  floating?: boolean
}

export function ImportExportFeedbackPanel({
  feedback,
  floating = false,
}: ImportExportFeedbackPanelProps) {
  const panel = (
    <section
      aria-live="polite"
      className={`io-feedback${floating ? ' io-feedback--floating' : ''}`}
      data-layout={floating ? 'floating' : 'inline'}
      data-testid="import-feedback"
      data-tone={feedback.tone}
    >
      <div className="io-feedback__header">
        <strong>{feedback.title}</strong>
        <p>{feedback.description}</p>
      </div>

      {feedback.kind === 'summary' ? (
        <>
          <div className="io-feedback__metrics">
            <div>
              <span>新增</span>
              <strong data-testid="import-added-count">{feedback.summary.importedCount}</strong>
            </div>
            <div>
              <span>跳过重复</span>
              <strong data-testid="import-skipped-count">{feedback.summary.skippedDuplicates}</strong>
            </div>
            <div>
              <span>失败</span>
              <strong data-testid="import-failed-count">{feedback.summary.failedCount}</strong>
            </div>
          </div>

          {feedback.summary.failedReasons.length > 0 ? (
            <ul className="io-feedback__issues">
              {feedback.summary.failedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  )

  if (!floating || typeof document === 'undefined') {
    return panel
  }

  return createPortal(panel, document.body)
}
