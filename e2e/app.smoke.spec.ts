import { expect, test } from '@playwright/test'

import { clearCardStorage } from './helpers/storage'

test.beforeEach(async ({ page }) => {
  await clearCardStorage(page)
  await page.goto('/')
})

test('首页可加载、可添加卡片，并暴露导入导出关键入口', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'MFA 本地验证码网站' })).toBeVisible()
  await expect(page.getByTestId('risk-note')).toContainText('localStorage')
  await expect(page.getByTestId('empty-state')).toBeVisible()

  await page.getByTestId('secret-input').fill('JBSW Y3DP EH PK3PXP')
  await page.getByTestId('note-input').fill('Smoke 卡片')
  await page.getByTestId('save-card-button').click()

  await expect(page.getByTestId('empty-state')).toHaveCount(0)

  const card = page.locator('[data-testid^="card-"]').first()

  await expect(card).toContainText('Smoke 卡片')
  await expect(card.getByTestId('otp-code')).toHaveText(/\d{6}/)
  await expect(card.getByTestId('delete-card-button')).toBeVisible()

  await expect(page.getByTestId('import-button')).toBeVisible()

  const exportButton = page.getByTestId('export-button')
  await expect(exportButton).toBeEnabled()

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-export-button').click()

  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mfa-web-export-v1-.*\.json$/)
})
