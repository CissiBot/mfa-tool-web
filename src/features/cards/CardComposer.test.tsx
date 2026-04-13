import { fireEvent, render, screen } from '@testing-library/react'

import { createCardRepository, STORAGE_KEY, type CardRecord, type StorageLike } from '../../lib/storage'
import { CardComposer } from './CardComposer'

describe('CardComposer', () => {
  it('首次创建默认使用蓝色，连续创建时会自动轮换到下一色', () => {
    const storage = createMemoryStorage()
    const onSaved = vi.fn()
    const createId = vi.fn().mockReturnValueOnce('card-blue').mockReturnValueOnce('card-green')

    render(
      <CardComposer
        repository={createTestRepository(storage)}
        onSaved={onSaved}
        createId={createId}
        now={() => '2026-04-12T12:00:00.000Z'}
      />,
    )

    const secretInput = screen.getByTestId('secret-input') as HTMLInputElement
    const noteInput = screen.getByTestId('note-input') as HTMLInputElement

    fireEvent.change(secretInput, { target: { value: 'jbsw y3dp ehpk 3pxp' } })
    fireEvent.change(noteInput, { target: { value: 'GitHub' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    fireEvent.change(secretInput, { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.change(noteInput, { target: { value: 'AWS' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(onSaved).toHaveBeenCalledTimes(2)
    expect(secretInput).toHaveValue('')
    expect(noteInput).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(readStoredCards(storage)).toEqual([
      {
        id: 'card-blue',
        rawSecret: 'jbsw y3dp ehpk 3pxp',
        normalizedSecret: 'JBSWY3DPEHPK3PXP',
        note: 'GitHub',
        color: 'blue',
        createdAt: '2026-04-12T12:00:00.000Z',
        updatedAt: '2026-04-12T12:00:00.000Z',
      },
      {
        id: 'card-green',
        rawSecret: 'GEZD GNBV GY3T QOJQ',
        normalizedSecret: 'GEZDGNBVGY3TQOJQ',
        note: 'AWS',
        color: 'green',
        createdAt: '2026-04-12T12:00:00.000Z',
        updatedAt: '2026-04-12T12:00:00.000Z',
      },
    ])
  })

  it('创建模式会根据现有最后一张卡片自动轮换默认颜色', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        cards: [
          createCard({ id: 'card-1', color: 'blue' }),
          createCard({ id: 'card-2', color: 'green', normalizedSecret: 'GEZDGNBVGY3TQOJQ', rawSecret: 'GEZD GNBV GY3T QOJQ' }),
        ],
      }),
    })

    render(
      <CardComposer
        repository={createTestRepository(storage)}
        createId={() => 'card-3'}
        now={() => '2026-04-12T12:00:00.000Z'}
      />,
    )

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'MFRG GZDF MZTW Q2LK' } })
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'Linear' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(readStoredCards(storage)).toEqual([
      createCard({ id: 'card-1', color: 'blue' }),
      createCard({ id: 'card-2', color: 'green', normalizedSecret: 'GEZDGNBVGY3TQOJQ', rawSecret: 'GEZD GNBV GY3T QOJQ' }),
      expect.objectContaining({
        id: 'card-3',
        note: 'Linear',
        color: 'amber',
      }),
    ])
  })

  it('对非法 Base32 密钥给出明确错误', () => {
    render(<CardComposer repository={createTestRepository(createMemoryStorage())} />)

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'abc$' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(screen.getByRole('alert')).toHaveTextContent('Base32 密钥包含非法字符: $')
  })

  it('对重复 normalizedSecret 给出明确错误', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        cards: [
          {
            id: 'card-existing',
            rawSecret: 'JBSW Y3DP EH PK3PXP',
            normalizedSecret: 'JBSWY3DPEHPK3PXP',
            note: '已存在',
            color: 'green',
            createdAt: '2026-04-12T11:00:00.000Z',
            updatedAt: '2026-04-12T11:00:00.000Z',
          },
        ],
      }),
    })

    render(<CardComposer repository={createTestRepository(storage)} createId={() => 'card-duplicate'} />)

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'jbsw y3dp ehpk 3pxp' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(screen.getByRole('alert')).toHaveTextContent('该 Base32 密钥已经存在，请勿重复保存。')
  })

  it('对 localStorage 写入异常给出明确错误', () => {
    render(<CardComposer repository={createTestRepository(createFailingStorage())} />)

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'JBSWY3DPEHPK3PXP' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(screen.getByRole('alert')).toHaveTextContent('写入 localStorage 失败')
  })

  it('编辑模式会保留原 id 与 createdAt，只更新字段与 updatedAt', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        cards: [createCard()],
      }),
    })
    const onSaved = vi.fn()

    render(
      <CardComposer
        card={createCard()}
        mode="edit"
        now={() => '2026-04-12T12:30:00.000Z'}
        onSaved={onSaved}
        repository={createTestRepository(storage)}
      />,
    )

    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'GitHub Team' } })
    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'card-existing',
        createdAt: '2026-04-12T10:00:00.000Z',
        updatedAt: '2026-04-12T12:30:00.000Z',
        note: 'GitHub Team',
        normalizedSecret: 'GEZDGNBVGY3TQOJQ',
      }),
    )
    expect(screen.getByTestId('secret-input')).toHaveValue('GEZD GNBV GY3T QOJQ')
    expect(screen.getByTestId('note-input')).toHaveValue('GitHub Team')
    expect(readStoredCards(storage)).toEqual([
      expect.objectContaining({
        id: 'card-existing',
        createdAt: '2026-04-12T10:00:00.000Z',
        updatedAt: '2026-04-12T12:30:00.000Z',
        note: 'GitHub Team',
        rawSecret: 'GEZD GNBV GY3T QOJQ',
      }),
    ])
  })

  it('编辑模式改成重复 normalizedSecret 时给出明确错误', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        cards: [
          createCard(),
          createCard({
            id: 'card-other',
            rawSecret: 'GEZD GNBV GY3T QOJQ',
            normalizedSecret: 'GEZDGNBVGY3TQOJQ',
            note: 'AWS',
            color: 'green',
          }),
        ],
      }),
    })

    render(<CardComposer card={createCard()} mode="edit" repository={createTestRepository(storage)} />)

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(screen.getByRole('alert')).toHaveTextContent('该 Base32 密钥已经存在，请勿重复保存。')
  })
})

function createCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card-existing',
    rawSecret: 'JBSW Y3DP EH PK3PXP',
    normalizedSecret: 'JBSWY3DPEHPK3PXP',
    note: 'GitHub',
    color: 'blue',
    createdAt: '2026-04-12T10:00:00.000Z',
    updatedAt: '2026-04-12T10:00:00.000Z',
    ...overrides,
  }
}

function createTestRepository(storage: StorageLike) {
  return createCardRepository({ storage })
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

function createFailingStorage(): StorageLike {
  return {
    getItem() {
      return null
    },
    setItem() {
      throw new Error('quota exceeded')
    },
    removeItem() {},
  }
}

function readStoredCards(storage: StorageLike) {
  const rawValue = storage.getItem(STORAGE_KEY)

  if (rawValue === null) {
    return []
  }

  return JSON.parse(rawValue).cards
}
