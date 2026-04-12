import { normalizeBase32Secret } from '../totp'
import {
  CARD_COLORS,
  STORAGE_SCHEMA_VERSION,
  type CardRecord,
  type ExportPayloadV1,
  type StorageDocumentV1,
  type StorageError,
  type StorageResult,
} from './types'

const CARD_COLOR_SET = new Set<string>(CARD_COLORS)

export function encodeStorageDocument(cards: CardRecord[]): StorageDocumentV1 {
  return {
    version: STORAGE_SCHEMA_VERSION,
    cards: [...cards],
  }
}

export function encodeExportPayload(cards: CardRecord[], exportedAt: string): ExportPayloadV1 {
  return {
    ...encodeStorageDocument(cards),
    exportedAt,
  }
}

export function parseStorageJson(json: string, source: 'storage' | 'import'): StorageResult<unknown> {
  try {
    return {
      ok: true,
      value: JSON.parse(json) as unknown,
    }
  } catch (error) {
    return {
      ok: false,
      error: createError('invalid_json', `${getSourceLabel(source)}数据不是合法的 JSON`, {
        source,
        cause: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}

export function decodeStorageDocument(input: unknown): StorageResult<StorageDocumentV1> {
  const documentResult = decodeDocumentBase(input, 'storage')

  if (!documentResult.ok) {
    return documentResult
  }

  return {
    ok: true,
    value: {
      version: STORAGE_SCHEMA_VERSION,
      cards: documentResult.value.cards,
    },
  }
}

export function decodeExportPayload(input: unknown): StorageResult<ExportPayloadV1> {
  const documentResult = decodeDocumentBase(input, 'import')

  if (!documentResult.ok) {
    return documentResult
  }

  const exportedAtResult = readIsoDate(input, 'exportedAt', 'import')

  if (!exportedAtResult.ok) {
    return exportedAtResult
  }

  return {
    ok: true,
    value: {
      version: STORAGE_SCHEMA_VERSION,
      cards: documentResult.value.cards,
      exportedAt: exportedAtResult.value,
    },
  }
}

function decodeDocumentBase(
  input: unknown,
  source: 'storage' | 'import',
): StorageResult<{ cards: CardRecord[] }> {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}数据必须是对象`, { source }),
    }
  }

  if (input.version !== STORAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: createError('invalid_version', `${getSourceLabel(source)}数据 version 非法或暂不支持`, {
        source,
        receivedVersion: input.version,
        expectedVersion: STORAGE_SCHEMA_VERSION,
      }),
    }
  }

  if (!Array.isArray(input.cards)) {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}数据缺少 cards 数组`, { source }),
    }
  }

  const cards: CardRecord[] = []

  for (const [index, candidate] of input.cards.entries()) {
    const cardResult = decodeCardRecord(candidate, index, source)

    if (!cardResult.ok) {
      return cardResult
    }

    cards.push(cardResult.value)
  }

  return {
    ok: true,
    value: { cards },
  }
}

function decodeCardRecord(
  candidate: unknown,
  index: number,
  source: 'storage' | 'import',
): StorageResult<CardRecord> {
  if (!isRecord(candidate)) {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}第 ${index + 1} 条卡片必须是对象`, {
        source,
        index,
      }),
    }
  }

  const idResult = readString(candidate, 'id', index, source)

  if (!idResult.ok) {
    return idResult
  }

  const rawSecretResult = readString(candidate, 'rawSecret', index, source)

  if (!rawSecretResult.ok) {
    return rawSecretResult
  }

  const normalizedSecretResult = readNormalizedSecret(candidate, index, source)

  if (!normalizedSecretResult.ok) {
    return normalizedSecretResult
  }

  const noteResult = readString(candidate, 'note', index, source)

  if (!noteResult.ok) {
    return noteResult
  }

  const colorResult = readColor(candidate, index, source)

  if (!colorResult.ok) {
    return colorResult
  }

  const createdAtResult = readIsoDate(candidate, 'createdAt', source, index)

  if (!createdAtResult.ok) {
    return createdAtResult
  }

  const updatedAtResult = readIsoDate(candidate, 'updatedAt', source, index)

  if (!updatedAtResult.ok) {
    return updatedAtResult
  }

  return {
    ok: true,
    value: {
      id: idResult.value,
      rawSecret: rawSecretResult.value,
      normalizedSecret: normalizedSecretResult.value,
      note: noteResult.value,
      color: colorResult.value,
      createdAt: createdAtResult.value,
      updatedAt: updatedAtResult.value,
    },
  }
}

function readString(
  value: Record<string, unknown>,
  key: string,
  index: number,
  source: 'storage' | 'import',
): StorageResult<string> {
  const field = value[key]

  if (typeof field !== 'string') {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}第 ${index + 1} 条卡片的 ${key} 必须是字符串`, {
        source,
        index,
        field: key,
      }),
    }
  }

  return {
    ok: true,
    value: field,
  }
}

function readNormalizedSecret(
  value: Record<string, unknown>,
  index: number,
  source: 'storage' | 'import',
): StorageResult<string> {
  const secretResult = readString(value, 'normalizedSecret', index, source)

  if (!secretResult.ok) {
    return secretResult
  }

  try {
    return {
      ok: true,
      value: normalizeBase32Secret(secretResult.value),
    }
  } catch (error) {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}第 ${index + 1} 条卡片的 normalizedSecret 非法`, {
        source,
        index,
        field: 'normalizedSecret',
        cause: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}

function readColor(
  value: Record<string, unknown>,
  index: number,
  source: 'storage' | 'import',
): StorageResult<CardRecord['color']> {
  const colorResult = readString(value, 'color', index, source)

  if (!colorResult.ok) {
    return colorResult
  }

  if (!CARD_COLOR_SET.has(colorResult.value)) {
    return {
      ok: false,
      error: createError('invalid_entry', `${getSourceLabel(source)}第 ${index + 1} 条卡片的 color 非法`, {
        source,
        index,
        field: 'color',
        received: colorResult.value,
      }),
    }
  }

  return {
    ok: true,
    value: colorResult.value as CardRecord['color'],
  }
}

function readIsoDate(
  value: unknown,
  key: string,
  source: 'storage' | 'import',
  index?: number,
): StorageResult<string> {
  if (!isRecord(value) || typeof value[key] !== 'string') {
    return {
      ok: false,
      error: createError(
        'invalid_entry',
        index === undefined
          ? `${getSourceLabel(source)}数据缺少合法的 ${key}`
          : `${getSourceLabel(source)}第 ${index + 1} 条卡片的 ${key} 必须是 ISO 时间字符串`,
        {
          source,
          index,
          field: key,
        },
      ),
    }
  }

  const timestamp = Date.parse(value[key])

  if (!Number.isFinite(timestamp)) {
    return {
      ok: false,
      error: createError(
        'invalid_entry',
        index === undefined
          ? `${getSourceLabel(source)}数据的 ${key} 不是合法时间`
          : `${getSourceLabel(source)}第 ${index + 1} 条卡片的 ${key} 不是合法时间`,
        {
          source,
          index,
          field: key,
          received: value[key],
        },
      ),
    }
  }

  return {
    ok: true,
    value: value[key],
  }
}

function createError(code: StorageError['code'], message: string, details?: Record<string, unknown>): StorageError {
  return {
    code,
    message,
    details,
  }
}

function getSourceLabel(source: 'storage' | 'import'): string {
  return source === 'storage' ? '本地存储' : '导入'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
