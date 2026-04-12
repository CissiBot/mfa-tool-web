import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import type { CardRecord } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { generateTotpCode, type TotpTimeWindow } from '../../lib/totp'
import { ConfirmationDialog } from '../import-export/ConfirmationDialog'
import { COLOR_COPY } from './color-copy'
import { appCardRepository } from './defaults'
import { getCardNoteLabel, maskSecret } from './display'

export interface OtpCardProps {
  card: CardRecord
  timeWindow: TotpTimeWindow
  repository?: CardRepository
  onRemoved?: () => void
}

const OTP_CODE_PLACEHOLDER = '------'

export function OtpCard({
  card,
  timeWindow,
  repository = appCardRepository,
  onRemoved,
}: OtpCardProps) {
  const [isSecretVisible, setIsSecretVisible] = useState(false)
  const [otpCode, setOtpCode] = useState(OTP_CODE_PLACEHOLDER)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const progressRatio = timeWindow.elapsedSeconds / timeWindow.periodSeconds
  const progressStyle = useMemo(
    () =>
      ({
        '--otp-progress-ratio': String(progressRatio),
      }) as CSSProperties,
    [progressRatio],
  )
  const noteLabel = getCardNoteLabel(card.note)
  const secretLabel = isSecretVisible ? card.rawSecret : maskSecret(card.rawSecret)

  const handleDelete = () => {
    const removeResult = repository.remove(card.id)

    setIsDeleteConfirmOpen(false)

    if (!removeResult.ok) {
      setFeedback(removeResult.error.message)
      return
    }

    setFeedback(null)
    onRemoved?.()
  }

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

  return (
    <article
      className="otp-card"
      data-color={card.color}
      data-revealed={isSecretVisible}
      data-testid={`card-${card.id}`}
    >
      <div className="otp-card__rail" aria-hidden="true" />

      <header className="otp-card__header">
        <div>
          <span className="otp-card__eyebrow">{COLOR_COPY[card.color].label}</span>
          <h3>{noteLabel}</h3>
        </div>

        <div className="otp-card__header-side">
          <span className="otp-card__countdown-label">本轮剩余</span>
          <strong className="otp-card__countdown" data-testid="otp-countdown">
            {timeWindow.remainingSeconds}s
          </strong>
        </div>
      </header>

      <section className="otp-card__secret-panel" aria-label="密钥显隐区">
        <div className="otp-card__secret-copy">
          <span className="otp-card__meta-label">原始密钥</span>
          <p className="otp-card__secret" data-testid="otp-secret">
            {secretLabel}
          </p>
        </div>

        <button
          className="otp-card__toggle"
          data-testid="toggle-secret-button"
          type="button"
          aria-pressed={isSecretVisible}
          onClick={() => {
            setIsSecretVisible((current) => !current)
          }}
        >
          {isSecretVisible ? '隐藏密钥' : '显示密钥'}
        </button>

        <button
          className="otp-card__delete"
          data-testid="delete-card-button"
          type="button"
          onClick={() => {
            setFeedback(null)
            setIsDeleteConfirmOpen(true)
          }}
        >
          删除卡片
        </button>
      </section>

      <section className="otp-card__code-panel" aria-label="当前验证码">
        <span className="otp-card__meta-label">当前验证码</span>
        <div className="otp-card__code" data-testid="otp-code">
          {otpCode}
        </div>
      </section>

      <div className="otp-card__progress-head">
        <span className="otp-card__meta-label">刷新进度</span>
        <span className="otp-card__progress-copy">{timeWindow.periodSeconds} 秒共享周期</span>
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

      {feedback ? (
        <div className="otp-card__feedback otp-card__feedback--error" role="alert">
          {feedback}
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <ConfirmationDialog
          confirmLabel="确认删除这张卡片"
          confirmTestId="confirm-delete-button"
          description="取消前数据不会变化；确认后只删除当前这张卡片，不会影响其他本地记录。"
          title={`确认删除“${noteLabel}”吗？`}
          onCancel={() => {
            setIsDeleteConfirmOpen(false)
          }}
          onConfirm={handleDelete}
        />
      ) : null}
    </article>
  )
}
