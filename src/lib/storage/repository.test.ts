import { createCardRepository } from './repository'
import { STORAGE_KEY, type CardRecord, type StorageLike } from './types'

describe('createCardRepository', () => {
  it('能持久化、重载、删除并清空卡片', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage, now: () => '2026-04-12T12:00:00.000Z' })
    const firstCard = createCard('card-1', 'JBSW Y3DP EH PK3PXP', 'JBSWY3DPEHPK3PXP', 'GitHub', 'blue')
    const secondCard = createCard('card-2', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', '', 'green')

    expect(repository.save(firstCard)).toEqual({
      ok: true,
      value: [firstCard],
    })
    expect(repository.save(secondCard)).toEqual({
      ok: true,
      value: [firstCard, secondCard],
    })

    const reloadedRepository = createCardRepository({ storage, now: () => '2026-04-12T12:05:00.000Z' })
    expect(reloadedRepository.load()).toEqual({
      ok: true,
      value: [firstCard, secondCard],
    })

    expect(reloadedRepository.remove(firstCard.id)).toEqual({
      ok: true,
      value: [secondCard],
    })
    expect(reloadedRepository.clear()).toEqual({
      ok: true,
      value: undefined,
    })
    expect(reloadedRepository.load()).toEqual({
      ok: true,
      value: [],
    })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('导出时保留 rawSecret 且附带 schema v1 元数据', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage, now: () => '2026-04-12T12:00:00.000Z' })
    const card = createCard('card-1', 'JBSW Y3DP EH PK3PXP', 'JBSWY3DPEHPK3PXP', '导出', 'violet')

    repository.save(card)

    expect(repository.exportCards()).toEqual({
      ok: true,
      value: {
        version: 1,
        exportedAt: '2026-04-12T12:00:00.000Z',
        cards: [card],
      },
    })
  })

  it('遇到重复 normalizedSecret 时不会覆盖已有卡片', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const existingCard = createCard('card-1', '旧密钥', 'JBSWY3DPEHPK3PXP', '原始条目', 'blue')
    const duplicateCard = createCard('card-2', '新密钥', 'JBSWY3DPEHPK3PXP', '重复条目', 'rose')

    repository.save(existingCard)

    expect(repository.save(duplicateCard)).toEqual({
      ok: false,
      error: {
        code: 'duplicate_card',
        message: '已存在相同 normalizedSecret 的卡片',
        details: {
          normalizedSecret: 'JBSWY3DPEHPK3PXP',
          existingId: 'card-1',
          incomingId: 'card-2',
        },
      },
    })
    expect(repository.load()).toEqual({
      ok: true,
      value: [existingCard],
    })
  })

  it('能按给定 id 顺序重排并在重载后保持顺序', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const firstCard = createCard('card-1', 'JBSW Y3DP EH PK3PXP', 'JBSWY3DPEHPK3PXP', 'GitHub', 'blue')
    const secondCard = createCard('card-2', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', 'AWS', 'green')
    const thirdCard = createCard('card-3', 'MFRG GZDF MZTW Q2LK', 'MFRGGZDFMZTWQ2LK', 'Notion', 'violet')

    repository.save(firstCard)
    repository.save(secondCard)
    repository.save(thirdCard)

    expect(repository.reorder(['card-3', 'card-1', 'card-2'])).toEqual({
      ok: true,
      value: [thirdCard, firstCard, secondCard],
    })

    expect(createCardRepository({ storage }).load()).toEqual({
      ok: true,
      value: [thirdCard, firstCard, secondCard],
    })
  })

  it('重排时若顺序缺少现有卡片会返回结构化错误', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const firstCard = createCard('card-1', 'JBSW Y3DP EH PK3PXP', 'JBSWY3DPEHPK3PXP', 'GitHub', 'blue')
    const secondCard = createCard('card-2', 'GEZD GNBV GY3T QOJQ', 'GEZDGNBVGY3TQOJQ', 'AWS', 'green')

    repository.save(firstCard)
    repository.save(secondCard)

    expect(repository.reorder(['card-2'])).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'invalid_entry',
        message: '重排后的卡片数量与现有卡片数量不一致',
      }),
    })
  })

  it('当 localStorage 内容损坏时安全失败并返回结构化错误', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: '{bad json',
    })
    const repository = createCardRepository({ storage })

    expect(repository.load()).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'invalid_json',
        message: '本地存储数据不是合法的 JSON',
      }),
    })
  })

  it('当 localStorage 不可用时返回明确错误', () => {
    const repository = createCardRepository()
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(repository.load()).toEqual({
        ok: false,
        error: {
          code: 'storage_unavailable',
          message: '当前环境不支持 localStorage',
        },
      })
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
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
