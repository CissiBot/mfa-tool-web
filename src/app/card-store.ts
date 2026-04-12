import { useEffect, useSyncExternalStore } from 'react'

import { STORAGE_KEY, createCardRepository, type CardRecord, type StorageError } from '../lib/storage'

export interface CardCollectionSnapshot {
  hydrated: boolean
  cards: CardRecord[]
  error: StorageError | null
}

export interface CardCollectionStore {
  getSnapshot(): CardCollectionSnapshot
  subscribe(listener: () => void): () => void
  hydrate(): void
  refresh(): void
}

interface CreateCardCollectionStoreOptions {
  repository?: ReturnType<typeof createCardRepository>
  targetWindow?: Window | undefined
}

const INITIAL_SNAPSHOT: CardCollectionSnapshot = {
  hydrated: false,
  cards: [],
  error: null,
}

export function createCardCollectionStore(
  options: CreateCardCollectionStoreOptions = {},
): CardCollectionStore {
  const repository = options.repository ?? createCardRepository()
  const targetWindow = options.targetWindow ?? (typeof window === 'undefined' ? undefined : window)
  const listeners = new Set<() => void>()
  let snapshot = INITIAL_SNAPSHOT
  let detachStorageListener: (() => void) | null = null

  const notify = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  const applySnapshot = (nextSnapshot: CardCollectionSnapshot) => {
    snapshot = nextSnapshot
    notify()
  }

  const readSnapshot = (): CardCollectionSnapshot => {
    const result = repository.load()

    if (!result.ok) {
      return {
        hydrated: true,
        cards: [],
        error: result.error,
      }
    }

    return {
      hydrated: true,
      cards: result.value,
      error: null,
    }
  }

  const attachStorageListener = () => {
    if (!targetWindow || detachStorageListener) {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) {
        return
      }

      applySnapshot(readSnapshot())
    }

    targetWindow.addEventListener('storage', handleStorage)
    detachStorageListener = () => {
      targetWindow.removeEventListener('storage', handleStorage)
      detachStorageListener = null
    }
  }

  return {
    getSnapshot() {
      return snapshot
    },

    subscribe(listener) {
      listeners.add(listener)
      attachStorageListener()

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
          detachStorageListener?.()
        }
      }
    },

    hydrate() {
      applySnapshot(readSnapshot())
    },

    refresh() {
      applySnapshot(readSnapshot())
    },
  }
}

export const appCardCollectionStore = createCardCollectionStore()

export function useCardCollection(store: CardCollectionStore = appCardCollectionStore): CardCollectionSnapshot {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  useEffect(() => {
    store.hydrate()
  }, [store])

  return snapshot
}
