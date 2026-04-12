/// <reference types="node" />

import { execFileSync } from 'child_process'

import { chromium, expect, test, type Browser, type Page } from '@playwright/test'

import { STORAGE_KEY } from './helpers/storage'

const EDGE_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const POWERSHELL_EXECUTABLE_PATH =
  '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
const CMD_EXECUTABLE_PATH = '/mnt/c/Windows/System32/cmd.exe'
const BASE_URL = 'http://127.0.0.1:4173'
const EDGE_CDP_PORT = 49000 + Math.floor(Math.random() * 1000)

let browser: Browser
let page: Page
let edgeProcessId: number

test.beforeAll(async () => {
  edgeProcessId = launchWindowsEdge(EDGE_CDP_PORT)
  const endpoint = await waitForCdpEndpoint(EDGE_CDP_PORT)
  browser = await chromium.connectOverCDP(endpoint)
})

test.afterAll(async () => {
  await browser.close()
  stopWindowsEdge(edgeProcessId)
})

test.beforeEach(async () => {
  const context = browser.contexts()[0]

  page = context.pages()[0] ?? (await context.newPage())
  await page.goto(BASE_URL)
  await page.evaluate((key) => {
    window.localStorage.removeItem(key)
  }, STORAGE_KEY)
  await page.reload()
})

test.afterEach(async () => {
  await page.close()
})

test('首页可加载、可添加卡片，并暴露导入导出关键入口', async () => {
  await expect(page.getByRole('heading', { name: 'MFA 本地验证码网站' })).toBeVisible()
  await expect(page.getByTestId('risk-note')).toContainText('localStorage')
  await expect(page.getByTestId('empty-state')).toBeVisible()

  await page.getByTestId('secret-input').fill('JBSW Y3DP EH PK3PXP')
  await page.getByTestId('note-input').fill('Smoke 卡片')
  await page.getByTestId('save-card-button').click()

  await expect(page.getByTestId('empty-state')).toHaveCount(0)

  const card = page.locator('article[data-testid^="card-"]').first()

  await expect(card).toContainText('Smoke 卡片')
  await expect(card.getByTestId('otp-code')).toHaveText(/\d{6}/)
  await expect(card.getByTestId('delete-card-button')).toBeVisible()

  await page.reload()

  const persistedCard = page.locator('article[data-testid^="card-"]').first()

  await expect(page.getByTestId('empty-state')).toHaveCount(0)
  await expect(page.getByTestId('card-list')).toContainText('Smoke 卡片')
  await expect(persistedCard.getByTestId('otp-code')).toHaveText(/\d{6}/)

  await expect(page.getByTestId('import-button')).toBeVisible()

  await page.getByTestId('import-file-input').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  })

  await expect(page.getByTestId('import-feedback')).toBeVisible()
  await expect(page.getByTestId('import-feedback')).toContainText('导入失败')
  await expect(page.getByTestId('import-feedback')).toContainText('导入数据不是合法的 JSON')

  const exportButton = page.getByTestId('export-button')
  await expect(exportButton).toBeEnabled()

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByTestId('confirm-export-button').click()

  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mfa-web-export-v1-.*\.json$/)
})

function launchWindowsEdge(port: number): number {
  const command = [
    `$process = Start-Process -FilePath '${EDGE_EXECUTABLE_PATH}' -ArgumentList '--headless=new','--remote-debugging-port=${port}','--no-first-run','--no-default-browser-check','about:blank' -PassThru`,
    '$process.Id',
  ].join('; ')

  const output = execFileSync(POWERSHELL_EXECUTABLE_PATH, ['-Command', command], {
    encoding: 'utf8',
  }).trim()

  const processId = Number(output)

  if (!Number.isInteger(processId)) {
    throw new Error(`无法获取 Edge 进程 ID：${output}`)
  }

  return processId
}

async function waitForCdpEndpoint(port: number): Promise<string> {
  const endpointUrl = `http://127.0.0.1:${port}/json/version`

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(endpointUrl)

      if (response.ok) {
        const payload = (await response.json()) as { webSocketDebuggerUrl?: string }

        if (payload.webSocketDebuggerUrl) {
          return payload.webSocketDebuggerUrl
        }
      }
    } catch {
      // 等待 Edge 完成启动并开放 CDP 端口。
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`等待 Edge CDP 端点超时：${endpointUrl}`)
}

function stopWindowsEdge(processId: number): void {
  try {
    execFileSync(CMD_EXECUTABLE_PATH, ['/c', 'taskkill', '/PID', String(processId), '/T', '/F'], {
      encoding: 'utf8',
      stdio: 'ignore',
    })
  } catch {
    // 进程已退出时无需额外处理。
  }
}
