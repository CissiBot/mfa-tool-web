import {
  CARD_COLORS,
  decodeExportPayload,
  parseStorageJson,
  type CardColor,
  type CardRecord,
  type ExportPayloadV1,
  type StorageError,
  type StorageResult,
} from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'

export interface TextDownloadOptions {
  content: string
  fileName: string
  mimeType: string
}

export interface ImportCardsSummary {
  importedCount: number
  skippedDuplicates: number
  failedCount: number
  failedReasons: string[]
}

export type ImportCardsResult =
  | { ok: true; value: ImportCardsSummary }
  | { ok: false; error: StorageError }

interface ImportEnvelope {
  version: 1
  exportedAt: string
  cards: unknown[]
}

export function stringifyExportPayload(payload: ExportPayloadV1): string {
  return JSON.stringify(payload, null, 2)
}

export function createExportFileName(exportedAt: string): string {
  const safeTimestamp = exportedAt.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z')
  return `mfa-web-export-v1-${safeTimestamp}.json`
}

export function downloadTextFile({ content, fileName, mimeType }: TextDownloadOptions): void {
  const blob = new Blob([content], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = fileName
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export function readFileText(file: File): Promise<string> {
  return file.text()
}

export function importCardsFromJson(json: string, repository: CardRepository): ImportCardsResult {
  const parsedResult = parseStorageJson(json, 'import')

  if (!parsedResult.ok) {
    return parsedResult
  }

  const envelopeResult = decodeImportEnvelope(parsedResult.value)

  if (!envelopeResult.ok) {
    return envelopeResult
  }

  const validCards = [] as ExportPayloadV1['cards']
  const failedReasons: string[] = []

  envelopeResult.value.cards.forEach((candidate, index) => {
    const cardResult = decodeExportPayload({
      version: envelopeResult.value.version,
      exportedAt: envelopeResult.value.exportedAt,
      cards: [candidate],
    })

    if (!cardResult.ok) {
      failedReasons.push(`第 ${index + 1} 条：${cardResult.error.message}`)
      return
    }

    validCards.push(cardResult.value.cards[0])
  })

  if (validCards.length === 0) {
    return {
      ok: true,
      value: {
        importedCount: 0,
        skippedDuplicates: 0,
        failedCount: failedReasons.length,
        failedReasons,
      },
    }
  }

  const loadedResult = repository.load()

  if (!loadedResult.ok) {
    return loadedResult
  }

  const recoloredCards = assignSequentialColors(validCards, loadedResult.value)

  const mergeResult = repository.merge(recoloredCards)

  if (!mergeResult.ok) {
    return mergeResult
  }

  return {
    ok: true,
    value: {
      importedCount: mergeResult.value.importedCount,
      skippedDuplicates: mergeResult.value.skippedDuplicates,
      failedCount: failedReasons.length,
      failedReasons,
    },
  }
}

function assignSequentialColors(cards: ExportPayloadV1['cards'], existingCards: readonly CardRecord[]): ExportPayloadV1['cards'] {
  const assignedCards = [...existingCards]

  return cards.map((card) => {
    const nextColor = getNextSequentialColor(assignedCards)
    const nextCard = {
      ...card,
      color: nextColor,
    }

    assignedCards.push(nextCard)

    return nextCard
  })
}

function getNextSequentialColor(cards: readonly Pick<CardRecord, 'color'>[]): CardColor {
  const lastColor = cards.at(-1)?.color

  if (!lastColor) {
    return CARD_COLORS[0]
  }

  const lastColorIndex = CARD_COLORS.indexOf(lastColor)

  if (lastColorIndex === -1) {
    return CARD_COLORS[0]
  }

  return CARD_COLORS[(lastColorIndex + 1) % CARD_COLORS.length]
}

function decodeImportEnvelope(input: unknown): StorageResult<ImportEnvelope> {
  if (!isRecord(input) || !Array.isArray(input.cards)) {
    const fallbackResult = decodeExportPayload(input)

    if (!fallbackResult.ok) {
      return fallbackResult
    }

    return {
      ok: true,
      value: {
        version: fallbackResult.value.version,
        exportedAt: fallbackResult.value.exportedAt,
        cards: fallbackResult.value.cards,
      },
    }
  }

  const envelopeResult = decodeExportPayload({
    ...input,
    cards: [],
  })

  if (!envelopeResult.ok) {
    return envelopeResult
  }

  return {
    ok: true,
    value: {
      version: envelopeResult.value.version,
      exportedAt: envelopeResult.value.exportedAt,
      cards: input.cards,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
