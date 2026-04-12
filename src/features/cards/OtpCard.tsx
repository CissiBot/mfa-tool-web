import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import type { CardRecord } from '../../lib/storage'
import { generateTotpCode, type TotpTimeWindow } from '../../lib/totp'
import { COLOR_COPY } from './color-copy'
import { getCardNoteLabel, maskSecret } from './display'

export interface OtpCardProps {
  card: CardRecord
  timeWindow: TotpTimeWindow
}

const OTP_CODE_PLACEHOLDER = '------'

export function OtpCard({ card, timeWindow }: OtpCardProps) {
  const [isSecretVisible, setIsSecretVisible] = useState(false)
  const [otpCode, setOtpCode] = useState(OTP_CODE_PLACEHOLDER)
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
    <article className="otp-card" data-color={card.color} data-revealed={isSecretVisible}>
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
    </article>
  )
}
