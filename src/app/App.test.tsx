import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { maskSecret } from '../features/cards'
import { createCardRepository, type CardRecord, type StorageError, type StorageLike } from '../lib/storage'
import { generateTotpCode, getTotpTimeWindow } from '../lib/totp'
import App from './App'
import { createCardCollectionStore, type CardCollectionSnapshot, type CardCollectionStore } from './card-store'
import type { TimeStore } from './time-store'

describe('App', () => {
  it('首屏包含完整的信息架构与稳定定位点', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    expect(screen.getByRole('heading', { name: 'MFA 本地验证码网站' })).toBeInTheDocument()
    expect(screen.getByTestId('risk-note')).toBeInTheDocument()
    expect(screen.getByTestId('secret-input')).toBeInTheDocument()
    expect(screen.getByTestId('note-input')).toBeInTheDocument()
    expect(screen.getByTestId('color-option-blue')).toBeInTheDocument()
    expect(screen.getByTestId('import-export-section')).toBeInTheDocument()
    expect(screen.getByTestId('card-list')).toBeInTheDocument()
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('空仓储 hydrated 后显示空状态', () => {
    render(<App cardStore={createMockCardStore(createSnapshot())} timeStore={createMockTimeStore()} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('你的验证码面板还是空的')).toBeInTheDocument()
    expect(screen.queryByTestId('otp-code')).not.toBeInTheDocument()
  })

  it('成功新增后会从空状态切换到真实卡片列表', async () => {
    const storage = createMemoryStorage()
    const repository = createCardRepository({ storage })
    const cardStore = createCardCollectionStore({ repository, targetWindow: undefined })
    const currentTime = Date.parse('2026-04-12T12:00:19.000Z')

    render(<App cardStore={cardStore} cardRepository={repository} timeStore={createMockTimeStore(currentTime)} />)

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'JBSW Y3DP EH PK3PXP' } })
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'GitHub' } })
    fireEvent.click(screen.getByTestId('save-card-button'))

    const expectedCode = await createExpectedCode('JBSWY3DPEHPK3PXP', currentTime)

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText(maskSecret('JBSW Y3DP EH PK3PXP'))).toBeInTheDocument()
    expect(screen.queryByText('JBSW Y3DP EH PK3PXP')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('card-list')).getByText('控制台蓝')).toBeInTheDocument()
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

    fireEvent.change(screen.getByTestId('secret-input'), { target: { value: 'GEZD GNBV GY3T QOJQ' } })
    fireEvent.change(screen.getByTestId('note-input'), { target: { value: 'AWS' } })
    fireEvent.click(screen.getByTestId('color-option-rose'))
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
    expect(screen.getByText(maskSecret('GEZD GNBV GY3T QOJQ'))).toBeInTheDocument()
    expect(screen.queryByText('GEZD GNBV GY3T QOJQ')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('card-list')).getByText('警示玫瑰')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })
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

  it('共享时间源跨过 30 秒边界后会同步刷新卡片验证码与心跳文案', async () => {
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
    expect(screen.getByTestId('time-heartbeat')).toHaveTextContent('1s')

    timeStore.setNow(Date.parse('2026-04-12T12:00:30.000Z'))

    await waitFor(() => {
      expect(screen.getAllByTestId('otp-code')[0]).toHaveTextContent(nextGithubCode)
      expect(screen.getAllByTestId('otp-code')[1]).toHaveTextContent(nextAwsCode)
    })

    expect(screen.getAllByTestId('otp-code')[0]).not.toHaveTextContent(previousGithubCode)
    expect(screen.getByTestId('time-heartbeat')).toHaveTextContent('30s')
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
