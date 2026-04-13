import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { createCardRepository, type CardRecord, type StorageError, type StorageLike } from '../lib/storage'
import { generateTotpCode, getTotpTimeWindow } from '../lib/totp'
import App from './App'
import { createCardCollectionStore, type CardCollectionSnapshot, type CardCollectionStore } from './card-store'
import type { TimeStore } from './time-store'

describe('App', () => {
  it('首页默认只显示卡片区与添加入口，操作面板按需打开', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    expect(screen.getByRole('heading', { name: 'MFA 卡片面板' })).toBeInTheDocument()
    expect(screen.getByTestId('open-composer-button')).toBeInTheDocument()
    expect(screen.getByTestId('import-button')).toBeInTheDocument()
    expect(screen.getByTestId('export-button')).toBeDisabled()
    expect(screen.getByTestId('card-list')).toBeInTheDocument()
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('secret-input')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toggle-utility-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('clear-cards-button')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('open-composer-button'))

    expect(screen.getByTestId('workspace-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('secret-input')).toBeInTheDocument()
    expect(screen.getByTestId('note-input')).toBeInTheDocument()
    expect(screen.queryByTestId('color-option-blue')).not.toBeInTheDocument()
    expect(screen.getByTestId('import-button')).toBeInTheDocument()
    expect(screen.getByTestId('import-file-input')).toBeInTheDocument()
    expect(screen.getByTestId('export-button')).toBeDisabled()
  })

  it('打开操作面板后会聚焦到密钥输入框', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    fireEvent.click(screen.getByTestId('open-composer-button'))

    expect(screen.getByTestId('secret-input')).toHaveFocus()
    expect(screen.getByRole('button', { name: '关闭工作区' })).toBeInTheDocument()
  })

  it('空仓储 hydrated 后显示空状态', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('点击“添加卡片”开始使用。')).toBeInTheDocument()
    expect(screen.queryByTestId('otp-code')).not.toBeInTheDocument()
  })

  it('成功新增后会从空状态切换到真实卡片列表', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })
    const currentTime = Date.parse('2026-04-12T12:00:19.000Z')

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore(currentTime)} />)

    fireEvent.click(screen.getByTestId('open-composer-button'))
    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'JBSW Y3DP EH PK3PXP' } })
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'GitHub' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    const expectedCode = await createExpectedCode('JBSWY3DPEHPK3PXP', currentTime)

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('JBSW Y3DP EH PK3PXP')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })
  })

  it('重新挂载后仍能从同一份 localStorage 数据恢复卡片', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })
    const currentTime = Date.parse('2026-04-12T12:00:19.000Z')
    const timeStore = createMockTimeStore(currentTime)
    const view = render(<App cardStore={cardStore} cardRepository={repository} timeStore={timeStore} />)

    fireEvent.click(screen.getByTestId('open-composer-button'))
    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'AWS' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    expect(screen.getByText('AWS')).toBeInTheDocument()
    view.unmount()

    render(
      <App
        cardStore={createCardCollectionStore({
          repository: createCardRepository({ storage }),
          targetWindow: undefined,
        })}
        cardRepository={createCardRepository({ storage })}
        timeStore={timeStore}
      />,
    )

    const expectedCode = await createExpectedCode('GEZDGNBVGY3TQOJQ', currentTime)

    expect(screen.getByText('AWS')).toBeInTheDocument()
    expect(screen.getByText('GEZD GNBV GY3T QOJQ')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })
  })

  it('点击修改备注后可在编辑工作区更新备注', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore()} />)

    fireEvent.click(screen.getByTestId('edit-note-button'))

    expect(screen.getByTestId('note-input')).toHaveFocus()
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'GitHub Team' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    await waitFor(() => {
      expect(screen.getByText('GitHub Team')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument()
  })

  it('点击修改密钥后会更新密钥文本与验证码', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })
    const currentTime = Date.parse('2026-04-12T12:00:19.000Z')

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore(currentTime)} />)

    fireEvent.click(screen.getByTestId('edit-secret-button'))

    expect(screen.getByTestId('secret-input')).toHaveFocus()
    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    const expectedCode = await createExpectedCode('GEZDGNBVGY3TQOJQ', currentTime)

    await waitFor(() => {
      expect(screen.getByText('GEZD GNBV GY3T QOJQ')).toBeInTheDocument()
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })
  })

  it('删除卡片前需要确认，取消后卡片保持不变', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore()} />)

    fireEvent.click(screen.getByTestId('delete-card-button'))

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('cancel-confirm-button'))

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('确认删除后会移除卡片并在删掉最后一张时回到空状态', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore()} />)

    fireEvent.click(screen.getByTestId('delete-card-button'))
    fireEvent.click(screen.getByTestId('confirm-delete-card-button'))

    await waitFor(() => {
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('拖动卡片后会更新列表顺序并持久化', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })
    repository.save({
      id: 'card-aws',
      rawSecret: 'GEZD GNBV GY3T QOJQ',
      normalizedSecret: 'GEZDGNBVGY3TQOJQ',
      note: 'AWS',
      color: 'green',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })
    const view = render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore()} />)

    expect(readCardOrder()).toEqual(['GitHub', 'AWS'])

    fireEvent.dragStart(within(screen.getByTestId('card-card-github')).getByTestId('drag-handle'))
    fireEvent.dragOver(screen.getByTestId('card-card-aws'))

    expect(readCardOrder()).toEqual(['AWS', 'GitHub'])

    fireEvent.drop(screen.getByTestId('card-card-aws'))

    await waitFor(() => {
      expect(readCardOrder()).toEqual(['AWS', 'GitHub'])
    })

    view.unmount()

    render(
      <App
        cardStore={createCardCollectionStore({
          repository: createCardRepository({ storage }),
          targetWindow: undefined,
        })}
        cardRepository={createCardRepository({ storage })}
        timeStore={createMockTimeStore()}
      />,
    )

    expect(readCardOrder()).toEqual(['AWS', 'GitHub'])
  })

  it('无效拖拽结束后会保持原顺序', () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    repository.save({
      id: 'card-github',
      rawSecret: 'JBSW Y3DP EH PK3PXP',
      normalizedSecret: 'JBSWY3DPEHPK3PXP',
      note: 'GitHub',
      color: 'blue',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })
    repository.save({
      id: 'card-aws',
      rawSecret: 'GEZD GNBV GY3T QOJQ',
      normalizedSecret: 'GEZDGNBVGY3TQOJQ',
      note: 'AWS',
      color: 'green',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    })

    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore()} />)

    fireEvent.dragStart(within(screen.getByTestId('card-card-github')).getByTestId('drag-handle'))
    fireEvent.dragEnd(within(screen.getByTestId('card-card-github')).getByTestId('drag-handle'))

    expect(readCardOrder()).toEqual(['GitHub', 'AWS'])
  })

  it('hydrated state 会渲染卡片列表而不是空状态', async () => {
    const cardStore = createMockCardStore({
      hydrated: false,
      cards: [],
      error: null,
    })

    cardStore.hydrate = () => {
      cardStore.setSnapshot(
        createSnapshot([
          {
            id: 'card-github',
            rawSecret: 'ASJ4DJA2PATIKJCFGULCABVETNDGVJUD',
            normalizedSecret: 'ASJ4DJA2PATIKJCFGULCABVETNDGVJUD',
            note: 'GitHub',
            color: 'blue',
            createdAt: '2026-04-12T00:00:00.000Z',
            updatedAt: '2026-04-12T00:00:00.000Z',
          },
        ]),
      )
    }

    render(<App cardStore={cardStore} timeStore={createMockTimeStore()} />)

    const expectedCode = await createExpectedCode(
      'ASJ4DJA2PATIKJCFGULCABVETNDGVJUD',
      Date.parse('2026-04-12T12:00:19.000Z'),
    )

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
  })

  it('共享时间源跨过 30 秒边界后会同步刷新卡片验证码与计时条', async () => {
    const timeStore = createMockTimeStore(Date.parse('2026-04-12T12:00:29.000Z'))

    render(
      <App
        cardStore={
          createMockCardStore(
            createSnapshot([
              {
                id: 'card-github',
                rawSecret: 'JBSW Y3DP EH PK3PXP',
                normalizedSecret: 'JBSWY3DPEHPK3PXP',
                note: 'GitHub',
                color: 'blue',
                createdAt: '2026-04-12T00:00:00.000Z',
                updatedAt: '2026-04-12T00:00:00.000Z',
              },
              {
                id: 'card-aws',
                rawSecret: 'GEZD GNBV GY3T QOJQ',
                normalizedSecret: 'GEZDGNBVGY3TQOJQ',
                note: 'AWS',
                color: 'green',
                createdAt: '2026-04-12T00:00:00.000Z',
                updatedAt: '2026-04-12T00:00:00.000Z',
              },
            ]),
          )
        }
        timeStore={timeStore}
      />,
    )

    const previousGithubCode = await createExpectedCode('JBSWY3DPEHPK3PXP', Date.parse('2026-04-12T12:00:29.000Z'))
    const nextGithubCode = await createExpectedCode('JBSWY3DPEHPK3PXP', Date.parse('2026-04-12T12:00:30.000Z'))
    const nextAwsCode = await createExpectedCode('GEZDGNBVGY3TQOJQ', Date.parse('2026-04-12T12:00:30.000Z'))

    await waitFor(() => {
      expect(screen.getAllByTestId('otp-code')[0]).toHaveTextContent(previousGithubCode)
    })
    expect(screen.getAllByTestId('otp-progress')[0]).toHaveAttribute('aria-valuenow', '29')

    timeStore.setNow(Date.parse('2026-04-12T12:00:30.000Z'))

    await waitFor(() => {
      expect(screen.getAllByTestId('otp-code')[0]).toHaveTextContent(nextGithubCode)
      expect(screen.getAllByTestId('otp-code')[1]).toHaveTextContent(nextAwsCode)
    })

    expect(screen.getAllByTestId('otp-code')[0]).not.toHaveTextContent(previousGithubCode)
    expect(screen.getAllByTestId('otp-progress')[0]).toHaveAttribute('aria-valuenow', '0')
  })

  it('页面右上角默认显示导入导出按钮，且不再展示数据操作折叠入口', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    expect(screen.getByTestId('import-button')).toBeInTheDocument()
    expect(screen.getByTestId('export-button')).toBeDisabled()
    expect(screen.queryByTestId('toggle-utility-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('clear-cards-button')).not.toBeInTheDocument()
  })

  it('存在卡片时会显示表格式表头', () => {
    render(
      <App
        cardStore={
          createMockCardStore(
            createSnapshot([
              {
                id: 'card-github',
                rawSecret: 'JBSW Y3DP EH PK3PXP',
                normalizedSecret: 'JBSWY3DPEHPK3PXP',
                note: 'GitHub',
                color: 'blue',
                createdAt: '2026-04-12T00:00:00.000Z',
                updatedAt: '2026-04-12T00:00:00.000Z',
              },
            ]),
          )
        }
        timeStore={createMockTimeStore()}
      />,
    )

    const tableHead = screen.getByTestId('card-table-head')

    expect(within(tableHead).getByText('备注 / 密钥')).toBeInTheDocument()
    expect(within(tableHead).getByText('验证码')).toBeInTheDocument()
    expect(within(tableHead).getByText('操作')).toBeInTheDocument()
  })
})

async function createExpectedCode(secret: string, now: number): Promise<string> {
  return generateTotpCode(secret, getTotpTimeWindow(now).startedAt)
}

function createSnapshot(cards: CardRecord[] = [], error: StorageError | null = null): CardCollectionSnapshot {
  return {
    hydrated: true,
    cards,
    error,
  }
}

function readCardOrder(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '')
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

function createMockCardStore(initialSnapshot: CardCollectionSnapshot): CardCollectionStore & {
  setSnapshot(snapshot: CardCollectionSnapshot): void
} {
  const listeners = new Set<() => void>()
  let snapshot = initialSnapshot

  return {
    getSnapshot() {
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    hydrate() {
      snapshot = {
        ...snapshot,
        hydrated: true,
      }
    },
    refresh() {
      snapshot = {
        ...snapshot,
        hydrated: true,
      }
    },
    setSnapshot(nextSnapshot) {
      act(() => {
        snapshot = nextSnapshot
        listeners.forEach((listener) => {
          listener()
        })
      })
    },
  }
}

function createMockTimeStore(initialNow = Date.parse('2026-04-12T12:00:19.000Z')): TimeStore & {
  setNow(nextNow: number): void
} {
  const listeners = new Set<() => void>()
  let now = initialNow

  return {
    getSnapshot() {
      return now
    },

    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    setNow(nextNow) {
      act(() => {
        now = nextNow
        listeners.forEach((listener) => {
          listener()
        })
      })
    },
  }
}
