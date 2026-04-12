import {
  decodeExportPayload,
  decodeStorageDocument,
  encodeExportPayload,
  encodeStorageDocument,
  parseStorageJson,
} from './schema'
import {
  STORAGE_KEY,
  type CardRecord,
  type ExportPayloadV1,
  type MergeCardsSummary,
  type StorageError,
  type StorageLike,
  type StorageResult,
} from './types'

export interface CardRepository {
  load(): StorageResult<CardRecord[]>
  save(card: CardRecord): StorageResult<CardRecord[]>
  remove(id: string): StorageResult<CardRecord[]>
  merge(cards: CardRecord[]): StorageResult<MergeCardsSummary>
  importFromJson(json: string): StorageResult<MergeCardsSummary>
  exportCards(): StorageResult<ExportPayloadV1>
  clear(): StorageResult<void>
}

interface CreateCardRepositoryOptions {
  storage?: StorageLike
  storageKey?: string
  now?: () => string
}

export function createCardRepository(options: CreateCardRepositoryOptions = {}): CardRepository {
  const storageKey = options.storageKey ?? STORAGE_KEY
  const now = options.now ?? (() => new Date().toISOString())

  return {
    load() {
      const storageResult = resolveStorage(options.storage)

      if (!storageResult.ok) {
        return storageResult
      }

      let rawValue: string | null

      try {
        rawValue = storageResult.value.getItem(storageKey)
      } catch (error) {
        return {
          ok: false,
          error: createError('storage_read_failed', '读取 localStorage 失败', {
            cause: error instanceof Error ? error.message : String(error),
            storageKey,
          }),
        }
      }

      if (rawValue === null) {
        return {
          ok: true,
          value: [],
        }
      }

      const parsedResult = parseStorageJson(rawValue, 'storage')

      if (!parsedResult.ok) {
        return parsedResult
      }

      const decodedResult = decodeStorageDocument(parsedResult.value)

      if (!decodedResult.ok) {
        return decodedResult
      }

      return {
        ok: true,
        value: decodedResult.value.cards,
      }
    },

    save(card) {
      const loadedResult = this.load()

      if (!loadedResult.ok) {
        return loadedResult
      }

      const duplicate = loadedResult.value.find(
        (existingCard) =>
          existingCard.normalizedSecret === card.normalizedSecret && existingCard.id !== card.id,
      )

      if (duplicate) {
        return {
          ok: false,
          error: createError('duplicate_card', '已存在相同 normalizedSecret 的卡片', {
            normalizedSecret: card.normalizedSecret,
            existingId: duplicate.id,
            incomingId: card.id,
          }),
        }
      }

      const nextCards = upsertCard(loadedResult.value, card)
      const writeResult = persistCards(options.storage, storageKey, nextCards)

      if (!writeResult.ok) {
        return writeResult
      }

      return {
        ok: true,
        value: nextCards,
      }
    },

    remove(id) {
      const loadedResult = this.load()

      if (!loadedResult.ok) {
        return loadedResult
      }

      const nextCards = loadedResult.value.filter((card) => card.id !== id)
      const writeResult = persistCards(options.storage, storageKey, nextCards)

      if (!writeResult.ok) {
        return writeResult
      }

      return {
        ok: true,
        value: nextCards,
      }
    },

    merge(cards) {
      const loadedResult = this.load()

      if (!loadedResult.ok) {
        return loadedResult
      }

      const nextCards = [...loadedResult.value]
      const knownSecrets = new Set(loadedResult.value.map((card) => card.normalizedSecret))
      const duplicateSecrets: string[] = []
      let importedCount = 0

      for (const card of cards) {
        if (knownSecrets.has(card.normalizedSecret)) {
          duplicateSecrets.push(card.normalizedSecret)
          continue
        }

        knownSecrets.add(card.normalizedSecret)
        nextCards.push(card)
        importedCount += 1
      }

      const writeResult = persistCards(options.storage, storageKey, nextCards)

      if (!writeResult.ok) {
        return writeResult
      }

      return {
        ok: true,
        value: {
          cards: nextCards,
          importedCount,
          skippedDuplicates: duplicateSecrets.length,
          duplicateSecrets,
        },
      }
    },

    importFromJson(json) {
      const parsedResult = parseStorageJson(json, 'import')

      if (!parsedResult.ok) {
        return parsedResult
      }

      const decodedResult = decodeExportPayload(parsedResult.value)

      if (!decodedResult.ok) {
        return decodedResult
      }

      return this.merge(decodedResult.value.cards)
    },

    exportCards() {
      const loadedResult = this.load()

      if (!loadedResult.ok) {
        return loadedResult
      }

      return {
        ok: true,
        value: encodeExportPayload(loadedResult.value, now()),
      }
    },

    clear() {
      const storageResult = resolveStorage(options.storage)

      if (!storageResult.ok) {
        return storageResult
      }

      try {
        storageResult.value.removeItem(storageKey)
      } catch (error) {
        return {
          ok: false,
          error: createError('storage_write_failed', '清空 localStorage 失败', {
            cause: error instanceof Error ? error.message : String(error),
            storageKey,
          }),
        }
      }

      return {
        ok: true,
        value: undefined,
      }
    },
  }
}

function upsertCard(cards: CardRecord[], card: CardRecord): CardRecord[] {
  const cardIndex = cards.findIndex((existingCard) => existingCard.id === card.id)

  if (cardIndex === -1) {
    return [...cards, card]
  }

  const nextCards = [...cards]
  nextCards[cardIndex] = card
  return nextCards
}

function persistCards(
  storage: StorageLike | undefined,
  storageKey: string,
  cards: CardRecord[],
): StorageResult<void> {
  const storageResult = resolveStorage(storage)

  if (!storageResult.ok) {
    return storageResult
  }

  try {
    storageResult.value.setItem(storageKey, JSON.stringify(encodeStorageDocument(cards)))
  } catch (error) {
    return {
      ok: false,
      error: createError('storage_write_failed', '写入 localStorage 失败', {
        cause: error instanceof Error ? error.message : String(error),
        storageKey,
      }),
    }
  }

  return {
    ok: true,
    value: undefined,
  }
}

function resolveStorage(storage: StorageLike | undefined): StorageResult<StorageLike> {
  if (storage) {
    return {
      ok: true,
      value: storage,
    }
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        ok: false,
        error: createError('storage_unavailable', '当前环境不支持 localStorage'),
      }
    }

    return {
      ok: true,
      value: window.localStorage,
    }
  } catch (error) {
    return {
      ok: false,
      error: createError('storage_unavailable', '当前环境无法访问 localStorage', {
        cause: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}

function createError(code: StorageError['code'], message: string, details?: Record<string, unknown>): StorageError {
  return {
    code,
    message,
    details,
  }
}
