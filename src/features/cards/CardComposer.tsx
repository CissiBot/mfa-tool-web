import { useState, type ComponentProps } from 'react'

import { CARD_COLORS, type CardColor } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { Base32SecretError, normalizeBase32Secret } from '../../lib/totp'
import { COLOR_COPY } from './color-copy'
import { appCardRepository, DEFAULT_CARD_COLOR } from './defaults'

export interface CardComposerProps {
  repository?: CardRepository
  onSaved?: () => void
  createId?: () => string
  now?: () => string
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

export function CardComposer({
  repository = appCardRepository,
  onSaved,
  createId = createCardId,
  now = createTimestamp,
}: CardComposerProps) {
  const [secretDraft, setSecretDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [selectedColor, setSelectedColor] = useState<CardColor>(DEFAULT_CARD_COLOR)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSubmit = (event: FormSubmitEvent) => {
    event.preventDefault()

    let normalizedSecret: string

    try {
      normalizedSecret = normalizeBase32Secret(secretDraft)
    } catch (error) {
      if (error instanceof Base32SecretError) {
        setFeedback(error.message)
        return
      }

      throw error
    }

    const timestamp = now()
    const saveResult = repository.save({
      id: createId(),
      rawSecret: secretDraft,
      normalizedSecret,
      note: noteDraft,
      color: selectedColor,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    if (!saveResult.ok) {
      setFeedback(formatRepositoryError(saveResult.error))
      return
    }

    setSecretDraft('')
    setNoteDraft('')
    setSelectedColor(DEFAULT_CARD_COLOR)
    setFeedback(null)
    onSaved?.()
  }

  return (
    <form className="composer-form" onSubmit={handleSubmit}>
      <label className="field-block" htmlFor="secret-input">
        <span className="field-block__label">MFA 密钥</span>
        <input
          id="secret-input"
          data-testid="secret-input"
          name="secret"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="例如 ASJ4 DJA2 PATI KJCF…"
          value={secretDraft}
          aria-invalid={feedback ? 'true' : undefined}
          onChange={(event) => {
            setSecretDraft(event.target.value)
            setFeedback(null)
          }}
        />
      </label>

      <label className="field-block" htmlFor="note-input">
        <span className="field-block__label">备注</span>
        <input
          id="note-input"
          data-testid="note-input"
          name="note"
          type="text"
          autoComplete="off"
          placeholder="例如 GitHub / AWS / 支付平台…"
          value={noteDraft}
          onChange={(event) => {
            setNoteDraft(event.target.value)
            setFeedback(null)
          }}
        />
      </label>

      <fieldset className="color-fieldset">
        <legend className="field-block__label">卡片颜色</legend>

        <div className="color-options" role="radiogroup" aria-label="卡片颜色">
          {CARD_COLORS.map((color) => {
            const isActive = selectedColor === color

            return (
              <label
                key={color}
                className="color-option"
                data-active={isActive}
                data-color={color}
                data-testid={`color-option-${color}`}
              >
                <input
                  type="radio"
                  name="color"
                  value={color}
                  checked={isActive}
                  onChange={() => {
                    setSelectedColor(color)
                    setFeedback(null)
                  }}
                />
                <span className="color-option__swatch" aria-hidden="true" />
                <span className="color-option__copy">
                  <strong>{COLOR_COPY[color].label}</strong>
                  <small>{COLOR_COPY[color].hint}</small>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="composer-actions">
        <button data-testid="save-card-button" type="submit">
          保存卡片
        </button>
        <p>保存时会先规范化 Base32 密钥，再写入本地仓储；成功后立即刷新列表并保留当前页面布局。</p>
        {feedback ? (
          <div className="composer-feedback composer-feedback--error" role="alert">
            {feedback}
          </div>
        ) : null}
      </div>
    </form>
  )
}

function formatRepositoryError(error: { code: string; message: string }): string {
  if (error.code === 'duplicate_card') {
    return '该 Base32 密钥已经存在，请勿重复保存。'
  }

  return error.message
}

function createCardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `card-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`
}

function createTimestamp(): string {
  return new Date().toISOString()
}
