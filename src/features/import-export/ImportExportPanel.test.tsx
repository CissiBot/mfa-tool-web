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

  it('导出确认弹窗支持按 Escape 关闭', () => {
    const repository = createCardRepository({ storage: createMemoryStorage() })
    const card = createCard()

    repository.save(card)

    render(<ImportExportPanel cards={[card]} repository={repository} />)

    fireEvent.click(screen.getByTestId('export-button'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

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
          color: 'slate',
        }),
      ],
    })
  })

  it('导入卡片时会基于现有最后颜色自动轮换新颜色', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save(createCard({ id: 'card-existing', color: 'blue' }))

    render(
      <ImportExportPanel
        cards={[createCard({ id: 'card-existing', color: 'blue' })]}
        readSelectedFile={vi.fn().mockResolvedValue(`{
  "version": 1,
  "exportedAt": "2026-04-12T00:00:00.000Z",
  "cards": [
    {
      "id": "card-valid-2",
      "rawSecret": "GEZD GNBV GY3T QOJQ",
      "normalizedSecret": "GEZDGNBVGY3TQOJQ",
      "note": "AWS",
      "color": "rose",
      "createdAt": "2026-04-12T00:00:00.000Z",
      "updatedAt": "2026-04-12T00:00:00.000Z"
    }
  ]
}`)}
        repository={repository}
      />,
    )

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: {
        files: [new File(['ignored'], 'import-rotate.json', { type: 'application/json' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('import-added-count')).toHaveTextContent('1')
    })

    expect(repository.load()).toEqual({
      ok: true,
      value: [
        expect.objectContaining({ id: 'card-existing', color: 'blue' }),
        expect.objectContaining({ id: 'card-valid-2', color: 'green' }),
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

  it('工具栏模式只显示导入导出按钮，不显示清空入口', () => {
    const card = createCard()

    render(<ImportExportPanel cards={[card]} compact toolbar showClearButton={false} />)

    expect(screen.getByTestId('import-button')).toBeInTheDocument()
    expect(screen.getByTestId('export-button')).toBeInTheDocument()
    expect(screen.queryByTestId('clear-cards-button')).not.toBeInTheDocument()
  })

  it('工具栏模式下导出完成反馈会以浮层形式渲染', () => {
    const repository = createCardRepository({ storage: createMemoryStorage(), now: () => '2026-04-12T12:00:00.000Z' })
    const card = createCard()
    const downloadFile = vi.fn()

    repository.save(card)

    const view = render(
      <ImportExportPanel cards={[card]} compact downloadFile={downloadFile} repository={repository} toolbar />,
    )

    fireEvent.click(screen.getByTestId('export-button'))
    fireEvent.click(screen.getByTestId('confirm-export-button'))

    const feedback = screen.getByTestId('import-feedback')

    expect(feedback).toHaveAttribute('data-layout', 'floating')
    expect(feedback).toHaveTextContent('导出完成')
    expect(view.container.querySelector('[data-testid="import-feedback"]')).toBeNull()
  })

  it('工具栏模式下导入结果 summary 也会以浮层形式渲染', async () => {
    const repository = createCardRepository({ storage: createMemoryStorage() })
    const view = render(
      <ImportExportPanel
        cards={[]}
        compact
        toolbar
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
    }
  ]
}`)}
        repository={repository}
      />, 
    )

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: {
        files: [new File(['ignored'], 'toolbar-import.json', { type: 'application/json' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('import-feedback')).toHaveAttribute('data-layout', 'floating')
    })

    expect(screen.getByTestId('import-feedback')).toHaveTextContent('已处理文件：toolbar-import.json')
    expect(view.container.querySelector('[data-testid="import-feedback"]')).toBeNull()
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
