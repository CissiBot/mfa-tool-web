import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Copy, GripVertical, KeyRound, PenLine, Trash2 } from 'lucide-react'

import type { CardRecord } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { generateTotpCode, type TotpTimeWindow } from '../../lib/totp'
import { appCardRepository } from './defaults'
import { getCardNoteLabel } from './display'

export interface OtpCardProps {
  card: CardRecord
  timeWindow: TotpTimeWindow
  frameAccent?: string
  repository?: CardRepository
  onRequestRemove?: () => void
  copyCode?: (code: string) => Promise<void>
  onEditNote?: () => void
  onEditSecret?: () => void
  isDragging?: boolean
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onDragHandleKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onDragHandleLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  dragHandleRef?: (node: HTMLButtonElement | null) => void
  isKeyboardDragging?: boolean
}

const OTP_CODE_PLACEHOLDER = '------'

export function OtpCard({
  card,
  timeWindow,
  frameAccent,
  repository = appCardRepository,
  onRequestRemove,
  copyCode = copyOtpCode,
  onEditNote,
  onEditSecret,
  isDragging = false,
  onDragHandlePointerDown,
  onDragHandleKeyDown,
  onDragHandleLostPointerCapture,
  dragHandleRef,
  isKeyboardDragging = false,
}: OtpCardProps) {
  void repository
  const [otpCode, setOtpCode] = useState(OTP_CODE_PLACEHOLDER)
  const [copyState, setCopyState] = useState<{ status: 'idle' | 'success' | 'error'; value: string | null }>({
    status: 'idle',
    value: null,
  })
  const progressBarRef = useRef<HTMLSpanElement | null>(null)
  const progressRatio = timeWindow.elapsedSeconds / timeWindow.periodSeconds
  const progressDurationMs = timeWindow.periodSeconds * 1000
  const progressStyle = useMemo(
    () =>
      ({
        '--card-frame-accent': frameAccent ?? 'var(--card-accent)',
        '--otp-progress-ratio': String(progressRatio),
      }) as CSSProperties,
    [frameAccent, progressRatio],
  )
  const noteLabel = getCardNoteLabel(card.note)

  useEffect(() => {
    const progressBar = progressBarRef.current

    if (!progressBar) {
      return
    }

    const updateProgressRatio = () => {
      const elapsedMs = ((Date.now() - timeWindow.startedAt) % progressDurationMs + progressDurationMs) % progressDurationMs
      progressBar.style.setProperty('--otp-progress-ratio-live', String(elapsedMs / progressDurationMs))
    }

    updateProgressRatio()

    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return () => {
        progressBar.style.removeProperty('--otp-progress-ratio-live')
      }
    }

    let frameId = 0

    const animate = () => {
      updateProgressRatio()
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
      progressBar.style.removeProperty('--otp-progress-ratio-live')
    }
  }, [progressDurationMs, timeWindow.counter, timeWindow.startedAt])

  useEffect(() => {
    let cancelled = false

    void generateTotpCode(card.normalizedSecret, timeWindow.startedAt)
      .then((nextCode) => {
        if (!cancelled) {
          setOtpCode(nextCode)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOtpCode(OTP_CODE_PLACEHOLDER)
        }
      })

    return () => {
      cancelled = true
    }
  }, [card.normalizedSecret, timeWindow.counter, timeWindow.startedAt])

  const handleCopy = async () => {
    if (otpCode === OTP_CODE_PLACEHOLDER) {
      return
    }

    try {
      await copyCode(otpCode)
      setCopyState({ status: 'success', value: otpCode })
    } catch {
      setCopyState({ status: 'error', value: otpCode })
    }
  }

  const isCopyStateCurrent = copyState.value === otpCode
  const copyButtonLabel = isCopyStateCurrent
    ? copyState.status === 'success'
      ? '已复制'
      : copyState.status === 'error'
        ? '复制失败'
        : '复制'
    : '复制'

  return (
    <article
      className="otp-card"
      data-color={card.color}
      data-dragging={isDragging ? 'true' : 'false'}
      data-testid={`card-${card.id}`}
      style={progressStyle}
    >
      <div className="otp-card__row">
        <div className="otp-card__details">
          <section className="otp-card__cell otp-card__cell--note" aria-label="备注">
            <span className="otp-card__meta-label">备注</span>
            <h3 title={noteLabel}>{noteLabel}</h3>
          </section>

          <section className="otp-card__cell otp-card__cell--secret" aria-label="密钥">
            <span className="otp-card__meta-label">密钥</span>
            <p className="otp-card__secret" data-testid="otp-secret" title={card.rawSecret}>
              {card.rawSecret}
            </p>
          </section>
        </div>

        <section className="otp-card__cell otp-card__cell--code" aria-label="当前验证码">
          <span className="otp-card__meta-label">验证码</span>
          <div className="otp-card__code" data-testid="otp-code">
            {otpCode}
          </div>
        </section>

        <div className="otp-card__actions" aria-label="卡片操作">
          <button
            className="otp-card__drag-handle"
            data-testid="drag-handle"
            ref={dragHandleRef}
            aria-label={`拖动排序：${noteLabel}`}
            aria-pressed={isKeyboardDragging}
            title={`拖动排序：${noteLabel}`}
            type="button"
            onPointerDown={onDragHandlePointerDown}
            onKeyDown={onDragHandleKeyDown}
            onLostPointerCapture={onDragHandleLostPointerCapture}
          >
            <span className="otp-card__drag-icon" aria-hidden="true">
              <GripVertical size={15} strokeWidth={2} />
            </span>
            <span className="otp-card__drag-accent" aria-hidden="true" />
            <span className="otp-card__drag-tooltip" aria-hidden="true">
              拖动排序
            </span>
          </button>

          <button
            className="otp-card__action-button"
            data-testid="edit-note-button"
            type="button"
            aria-label={`修改备注：${noteLabel}`}
            title="修改备注"
            onClick={onEditNote}
          >
            <span className="otp-card__action-label">备注</span>
            <span className="otp-card__action-icon" aria-hidden="true">
              <PenLine size={15} strokeWidth={2} />
            </span>
          </button>

          <button
            className="otp-card__action-button"
            data-testid="edit-secret-button"
            type="button"
            aria-label={`修改密钥：${noteLabel}`}
            title="修改密钥"
            onClick={onEditSecret}
          >
            <span className="otp-card__action-label">密钥</span>
            <span className="otp-card__action-icon" aria-hidden="true">
              <KeyRound size={15} strokeWidth={2} />
            </span>
          </button>

          <button
            className="otp-card__action-button otp-card__action-button--copy"
            data-testid="copy-code-button"
            disabled={otpCode === OTP_CODE_PLACEHOLDER}
            type="button"
            aria-label={`${copyButtonLabel}验证码：${noteLabel}`}
            title={copyButtonLabel}
            onClick={() => {
              void handleCopy()
            }}
          >
            <span className="otp-card__action-label">{copyButtonLabel}</span>
            <span className="otp-card__action-icon" aria-hidden="true">
              <Copy size={15} strokeWidth={2} />
            </span>
          </button>

          <button
            className="otp-card__action-button otp-card__action-button--danger otp-card__action-button--icon-only"
            data-testid="delete-card-button"
            type="button"
            aria-label={`删除卡片：${noteLabel}`}
            title="删除卡片"
            onClick={onRequestRemove}
          >
            <span className="otp-card__action-icon" aria-hidden="true">
              <Trash2 size={15} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>

      <div
        className="otp-card__progress-track"
        role="progressbar"
        aria-label="验证码刷新进度"
        aria-valuemin={0}
        aria-valuemax={timeWindow.periodSeconds}
        aria-valuenow={timeWindow.elapsedSeconds}
        data-testid="otp-progress"
      >
        <span ref={progressBarRef} className="otp-card__progress-bar" />
      </div>

      <span aria-live="polite" className="sr-only" data-testid="copy-status">
        {isCopyStateCurrent
          ? copyState.status === 'success'
            ? '验证码已复制'
            : copyState.status === 'error'
              ? '验证码复制失败'
              : ''
          : ''}
      </span>
    </article>
  )
}

async function copyOtpCode(code: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable')
  }

  await navigator.clipboard.writeText(code)
}
