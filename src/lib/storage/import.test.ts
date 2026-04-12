import { createCardRepository } from './repository'
import { STORAGE_KEY, type CardRecord, type StorageLike } from './types'

describe('repository.importFromJson', () => {
  it('能合并导入并跳过重复项，不覆盖已有条目', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage, now: () => '2026-04-12T12:00:00.000Z' })
    const existingCard = createCard('card-existing', '旧 raw secret', 'JBSWY3DPEHPK3PXP', '已存在', 'blue')

    repository.save(existingCard)

    const importResult = repository.importFromJson(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-04-12T12:00:00.000Z',
        cards: [
          existingCard,
          createCard('card-new', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', '新条目', 'green'),
          createCard('card-duplicate', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', '同批重复', 'amber'),
        ],
      }),
    )

    expect(importResult).toEqual({
      ok: true,
      value: {
        cards: [
          existingCard,
          createCard('card-new', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', '新条目', 'green'),
        ],
        importedCount: 1,
        skippedDuplicates: 2,
        duplicateSecrets: ['JBSWY3DPEHPK3PXP', 'GEZDGNBVGY3TQOJQ'],
      },
    })
    expect(repository.load()).toEqual({
      ok: true,
      value: [
        existingCard,
        createCard('card-new', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', '新条目', 'green'),
      ],
    })
  })

  it('对损坏 JSON 安全失败且不写入有效存储', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })

    expect(repository.importFromJson('{oops')).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'invalid_json',
        message: '导入数据不是合法的 JSON',
      }),
    })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('对未知 version 返回明确错误且不写入有效存储', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })

    expect(
      repository.importFromJson(
        JSON.stringify({
          version: 2,
          exportedAt: '2026-04-12T12:00:00.000Z',
          cards: [],
        }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_version',
        message: '导入数据 version 非法或暂不支持',
        details: {
          source: 'import',
          receivedVersion: 2,
          expectedVersion: 1,
        },
      },
    })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('对部分无效条目返回明确错误且不写入有效存储', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })

    expect(
      repository.importFromJson(
        JSON.stringify({
          version: 1,
          exportedAt: '2026-04-12T12:00:00.000Z',
          cards: [
            createCard('card-valid', 'JBSW Y3DP EH PK3PXP', 'JBSWY3DPEHPK3PXP', '有效', 'blue'),
            {
              id: 'card-invalid',
              rawSecret: 'ABC*123',
              normalizedSecret: 'ABC*123',
              note: '非法',
              color: 'rose',
              createdAt: '2026-04-12T00:00:00.000Z',
              updatedAt: '2026-04-12T00:00:00.000Z',
            },
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_entry',
        message: '导入第 2 条卡片的 normalizedSecret 非法',
        details: {
          source: 'import',
          index: 1,
          field: 'normalizedSecret',
          cause: 'Base32 密钥包含非法字符: *, 1',
        },
      },
    })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })
})

function createCard(
  id: string,
  rawSecret: string,
  normalizedSecret: string,
  note: string,
  color: CardRecord['color'],
): CardRecord {
  return {
    id,
    rawSecret,
    normalizedSecret,
    note,
    color,
    createdAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
  }
}

function createMemoryStorage(initialState: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initialState))

  return {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}
