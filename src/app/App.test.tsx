import { act, render, screen } from '@testing-library/react'

import type { CardRecord, StorageError } from '../lib/storage'
import App from './App'
import type { CardCollectionSnapshot, CardCollectionStore } from './card-store'
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

  it('hydrated state 会渲染卡片列表而不是空状态', () => {
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

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByTestId('otp-code')).toHaveTextContent('------')
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
  })
})

function createSnapshot(cards: CardRecord[] = [], error: StorageError | null = null): CardCollectionSnapshot {
  return {
    hydrated: true,
    cards,
    error,
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

function createMockTimeStore(now = Date.parse('2026-04-12T12:00:19.000Z')): TimeStore {
  return {
    getSnapshot() {
      return now
    },
    subscribe() {
      return () => {}
    },
  }
}
