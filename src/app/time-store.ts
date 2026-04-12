import { useSyncExternalStore } from 'react'

export interface TimeStore {
  getSnapshot(): number
  subscribe(listener: () => void): () => void
}

interface TimerLike {
  setInterval(handler: () => void, timeout: number): ReturnType<typeof globalThis.setInterval>
  clearInterval(handle: ReturnType<typeof globalThis.setInterval>): void
}

interface CreateTimeStoreOptions {
  now?: () => number
  intervalMs?: number
  timer?: TimerLike
}

export function createTimeStore(options: CreateTimeStoreOptions = {}): TimeStore {
  const now = options.now ?? (() => Date.now())
  const intervalMs = options.intervalMs ?? 1000
  const timer = options.timer ?? globalThis
  const listeners = new Set<() => void>()
  let snapshot = now()
  let intervalHandle: ReturnType<typeof globalThis.setInterval> | null = null

  const tick = () => {
    const nextValue = now()

    if (nextValue === snapshot) {
      return
    }

    snapshot = nextValue
    listeners.forEach((listener) => {
      listener()
    })
  }

  const start = () => {
    if (intervalHandle !== null) {
      return
    }

    intervalHandle = timer.setInterval(tick, intervalMs)
  }

  const stop = () => {
    if (intervalHandle === null) {
      return
    }

    timer.clearInterval(intervalHandle)
    intervalHandle = null
  }

  return {
    getSnapshot() {
      return snapshot
    },

    subscribe(listener) {
      listeners.add(listener)
      start()

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
          stop()
        }
      }
    },
  }
}

export const appTimeStore = createTimeStore()

export function useTimeSnapshot(store: TimeStore = appTimeStore): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
