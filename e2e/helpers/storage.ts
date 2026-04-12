import type { Page } from '@playwright/test'

export const STORAGE_KEY = 'mfa-web/cards:v1'

export type StoredCard = {
  id: string
  rawSecret: string
  normalizedSecret: string
  note: string
  color: 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'violet'
  createdAt: string
  updatedAt: string
}

type StorageEnvelope = {
  version: 1
  cards: StoredCard[]
}

export async function presetCardStorage(page: Page, cards: StoredCard[]): Promise<void> {
  const payload: StorageEnvelope = {
    version: 1,
    cards,
  }

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: STORAGE_KEY, value: payload },
  )

  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: STORAGE_KEY, value: payload },
  )
}

export async function clearCardStorage(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key)
  }, STORAGE_KEY)

  await page.evaluate((key) => {
    window.localStorage.removeItem(key)
  }, STORAGE_KEY)
}
