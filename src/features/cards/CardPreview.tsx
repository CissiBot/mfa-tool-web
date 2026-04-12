import type { CSSProperties } from 'react'

import type { CardRecord } from '../../lib/storage'
import { COLOR_COPY } from './color-copy'

interface CardPreviewProps {
  card: CardRecord
  progressRatio: number
  remainingSeconds: number
}

export function CardPreview({ card, progressRatio, remainingSeconds }: CardPreviewProps) {
  const progressStyle = {
    '--otp-progress-ratio': String(progressRatio),
  } as CSSProperties

  return (
    <article className="otp-card" data-color={card.color}>
      <div className="otp-card__rail" aria-hidden="true" />
      <header className="otp-card__header">
        <div>
          <span className="otp-card__eyebrow">{COLOR_COPY[card.color].label}</span>
          <h3>{card.note.trim() === '' ? '未命名卡片' : card.note}</h3>
        </div>
        <span className="otp-card__countdown">{remainingSeconds}s</span>
      </header>

      <p className="otp-card__secret">{card.rawSecret}</p>
      <p className="otp-card__hint">验证码和显隐逻辑将在任务 6 接入；当前先真实展示卡片密钥、备注与颜色。</p>

      <div className="otp-card__code" data-testid="otp-code">
        ------
      </div>

      <div className="otp-card__progress-track">
        <span className="otp-card__progress-bar" data-testid="otp-progress" style={progressStyle} />
      </div>
    </article>
  )
}
