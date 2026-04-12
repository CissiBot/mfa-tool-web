export const STORAGE_KEY = 'mfa-web/cards:v1'
export const STORAGE_SCHEMA_VERSION = 1 as const

export const CARD_COLORS = ['slate', 'blue', 'green', 'amber', 'rose', 'violet'] as const

export type CardColor = (typeof CARD_COLORS)[number]

export interface CardRecord {
  id: string
  rawSecret: string
  normalizedSecret: string
  note: string
  color: CardColor
  createdAt: string
  updatedAt: string
}

export interface StorageDocumentV1 {
  version: typeof STORAGE_SCHEMA_VERSION
  cards: CardRecord[]
}

export interface ExportPayloadV1 extends StorageDocumentV1 {
  exportedAt: string
}

export type StorageErrorCode =
  | 'storage_unavailable'
  | 'storage_read_failed'
  | 'storage_write_failed'
  | 'invalid_json'
  | 'invalid_version'
  | 'invalid_entry'
  | 'duplicate_card'

export interface StorageError {
  code: StorageErrorCode
  message: string
  details?: Record<string, unknown>
}

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: StorageError }

export interface MergeCardsSummary {
  cards: CardRecord[]
  importedCount: number
  skippedDuplicates: number
  duplicateSecrets: string[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
