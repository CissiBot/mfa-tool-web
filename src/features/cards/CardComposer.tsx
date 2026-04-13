import { useState, type ComponentProps } from 'react'

import type { CardColor, CardRecord } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { Base32SecretError, normalizeBase32Secret } from '../../lib/totp'
import { appCardRepository, DEFAULT_CARD_COLOR, getNextCardColor } from './defaults'

export interface CardComposerProps {
  repository?: CardRepository
  card?: CardRecord
  mode?: 'create' | 'edit'
  onSaved?: (card: CardRecord) => void
  createId?: () => string
  now?: () => string
  compact?: boolean
  secretInputRef?: ComponentProps<'input'>['ref']
  noteInputRef?: ComponentProps<'input'>['ref']
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

export function CardComposer({
  repository = appCardRepository,
  card,
  mode = 'create',
  onSaved,
  createId = createCardId,
  now = createTimestamp,
  compact = false,
  secretInputRef,
  noteInputRef,
}: CardComposerProps) {
  const [secretDraft, setSecretDraft] = useState(card?.rawSecret ?? '')
  const [noteDraft, setNoteDraft] = useState(card?.note ?? '')
  const [selectedColor, setSelectedColor] = useState<CardColor>(() => card?.color ?? resolveCreateModeColor(repository))
  const [feedback, setFeedback] = useState<string | null>(null)
  const isEditing = mode === 'edit' && Boolean(card)

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
    const nextCard: CardRecord = {
      id: card?.id ?? createId(),
      rawSecret: secretDraft,
      normalizedSecret,
      note: noteDraft,
      color: selectedColor,
      createdAt: card?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    const saveResult = repository.save(nextCard)

    if (!saveResult.ok) {
      setFeedback(formatRepositoryError(saveResult.error))
      return
    }

    if (!isEditing) {
      setSecretDraft('')
      setNoteDraft('')
      setSelectedColor(getNextCardColor(saveResult.value))
    }

    setFeedback(null)
    onSaved?.(nextCard)
  }

  return (
    <form className="composer-form" onSubmit={handleSubmit}>
      <label className="field-block" htmlFor="secret-input">
        <span className="field-block__label">MFA 密钥</span>
        <input
          ref={secretInputRef}
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
          ref={noteInputRef}
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

      <div className="composer-actions">
        <button data-testid="save-card-button" type="submit">
          <span>{isEditing ? '更新卡片' : '保存卡片'}</span>
        </button>
        {!compact ? (
          <p>
            {isEditing
              ? '更新时会保留原卡片 ID 与创建时间，只刷新备注、密钥、颜色和更新时间。'
              : '保存时会先规范化 Base32 密钥，再写入本地仓储；成功后立即刷新列表并保留当前页面布局。'}
          </p>
        ) : null}
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

function resolveCreateModeColor(repository: CardRepository): CardColor {
  const loadedResult = repository.load()

  if (!loadedResult.ok) {
    return DEFAULT_CARD_COLOR
  }

  return getNextCardColor(loadedResult.value)
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
