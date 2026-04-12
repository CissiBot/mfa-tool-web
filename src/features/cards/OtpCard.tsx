import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Copy, GripVertical, KeyRound, PenLine } from 'lucide-react'

import type { CardRecord } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { generateTotpCode, type TotpTimeWindow } from '../../lib/totp'
import { appCardRepository } from './defaults'
import { getCardNoteLabel } from './display'

export interface OtpCardProps {
  card: CardRecord
  timeWindow: TotpTimeWindow
  repository?: CardRepository
  onRemoved?: () => void
  copyCode?: (code: string) => Promise<void>
  onEditNote?: () => void
  onEditSecret?: () => void
  draggable?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
  onDragStart?: () => void
  onDragOver?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}

const OTP_CODE_PLACEHOLDER = '------'

export function OtpCard({
  card,
  timeWindow,
  repository = appCardRepository,
  onRemoved,
  copyCode = copyOtpCode,
  onEditNote,
  onEditSecret,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: OtpCardProps) {
  void repository
  void onRemoved
  const [otpCode, setOtpCode] = useState(OTP_CODE_PLACEHOLDER)
  const [copyState, setCopyState] = useState<{ status: 'idle' | 'success' | 'error'; value: string | null }>({
    status: 'idle',
    value: null,
  })
  const progressRatio = timeWindow.elapsedSeconds / timeWindow.periodSeconds
  const progressStyle = useMemo(
    () =>
      ({
        '--otp-progress-ratio': String(progressRatio),
      }) as CSSProperties,
    [progressRatio],
  )
  const noteLabel = getCardNoteLabel(card.note)

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
      data-drop-target={isDropTarget ? 'true' : 'false'}
      data-testid={`card-${card.id}`}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver?.()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop?.()
      }}
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
          <span
            className="otp-card__drag-handle"
            data-testid="drag-handle"
            draggable={draggable}
            title={`拖动排序：${noteLabel}`}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
          >
            <GripVertical size={15} strokeWidth={2} />
          </span>

          <button
            className="otp-card__action-button"
            data-testid="edit-note-button"
            type="button"
            aria-label={`修改备注：${noteLabel}`}
            title="修改备注"
            onClick={onEditNote}
          >
            <PenLine aria-hidden="true" size={15} strokeWidth={2} />
          </button>

          <button
            className="otp-card__action-button"
            data-testid="edit-secret-button"
            type="button"
            aria-label={`修改密钥：${noteLabel}`}
            title="修改密钥"
            onClick={onEditSecret}
          >
            <KeyRound aria-hidden="true" size={15} strokeWidth={2} />
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
            <Copy aria-hidden="true" size={15} strokeWidth={2} />
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
        <span className="otp-card__progress-bar" style={progressStyle} />
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
