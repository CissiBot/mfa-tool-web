import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { createCardRepository, type CardRecord, type StorageLike } from '../../lib/storage'
import { ImportExportPanel } from './ImportExportPanel'

describe('ImportExportPanel', () => {
  it('导出前必须确认，确认后下载 schema v1 JSON 且保留 rawSecret', () => {
    const repository = createCardRepository({ storage: createMemoryStorage(), now: () => '2026-04-12T12:00:00.000Z' })
    const card = createCard()
    const downloadFile = vi.fn()

    repository.save(card)

    render(<ImportExportPanel cards={[card]} downloadFile={downloadFile} repository={repository} />)

    fireEvent.click(screen.getByTestId('export-button'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(downloadFile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('confirm-export-button'))

    expect(downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(/^mfa-web-export-v1-.*\.json$/),
        mimeType: 'application/json',
        content: expect.stringContaining('"version": 1'),
      }),
    )
    expect(downloadFile.mock.calls[0]?.[0].content).toContain('"rawSecret": "JBSW Y3DP EH PK3PXP"')
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('导入混合文件时会区分新增、跳过重复和失败原因', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const onCollectionChanged = vi.fn()

    render(
      <ImportExportPanel
        cards={[]}
        onCollectionChanged={onCollectionChanged}
        readSelectedFile={vi.fn().mockResolvedValue(`{
  "version": 1,
  "exportedAt": "2026-04-12T00:00:00.000Z",
  "cards": [
    {
      "id": "card-valid-1",
      "rawSecret": "JBSW Y3DP EH PK3PXP",
      "normalizedSecret": "JBSWY3DPEHPK3PXP",
      "note": "有效示例",
      "color": "blue",
      "createdAt": "2026-04-12T00:00:00.000Z",
      "updatedAt": "2026-04-12T00:00:00.000Z"
    },
    {
      "id": "card-duplicate-1",
      "rawSecret": "JBSWY3DPEHPK3PXP",
      "normalizedSecret": "JBSWY3DPEHPK3PXP",
      "note": "重复示例",
      "color": "green",
      "createdAt": "2026-04-12T00:05:00.000Z",
      "updatedAt": "2026-04-12T00:05:00.000Z"
    },
    {
      "id": "card-invalid-1",
      "rawSecret": "ABC*123",
      "normalizedSecret": "ABC*123",
      "note": "非法示例",
      "color": "rose",
      "createdAt": "2026-04-12T00:10:00.000Z",
      "updatedAt": "2026-04-12T00:10:00.000Z"
    }
  ]
}`)}
        repository={repository}
      />,
    )

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: {
        files: [new File(['ignored'], 'import-mixed.json', { type: 'application/json' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('import-added-count')).toHaveTextContent('1')
    })

    expect(screen.getByTestId('import-skipped-count')).toHaveTextContent('1')
    expect(screen.getByTestId('import-failed-count')).toHaveTextContent('1')
    expect(screen.getByTestId('import-feedback')).toHaveTextContent('第 3 条：导入第 1 条卡片的 normalizedSecret 非法')
    expect(onCollectionChanged).toHaveBeenCalledTimes(1)
    expect(repository.load()).toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          id: 'card-valid-1',
          note: '有效示例',
          rawSecret: 'JBSW Y3DP EH PK3PXP',
        }),
      ],
    })
  })

  it('清空全部前需要确认，取消后数据保持不变', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const onCollectionChanged = vi.fn()
    const card = createCard()

    repository.save(card)

    render(<ImportExportPanel cards={[card]} onCollectionChanged={onCollectionChanged} repository={repository} />)

    fireEvent.click(screen.getByTestId('clear-cards-button'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('cancel-confirm-button'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(onCollectionChanged).not.toHaveBeenCalled()
    expect(repository.load()).toEqual({ ok: true, value: [card] })

    fireEvent.click(screen.getByTestId('clear-cards-button'))
    fireEvent.click(screen.getByTestId('confirm-clear-button'))

    expect(onCollectionChanged).toHaveBeenCalledTimes(1)
    expect(repository.load()).toEqual({ ok: true, value: [] })
  })
})

function createCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card-export-1',
    rawSecret: 'JBSW Y3DP EH PK3PXP',
    normalizedSecret: 'JBSWY3DPEHPK3PXP',
    note: 'GitHub',
    color: 'blue',
    createdAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
    ...overrides,
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
