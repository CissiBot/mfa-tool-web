import { decodeBase32Secret } from './normalize'

export const TOTP_ALGORITHM = 'SHA-1'
export const TOTP_DIGITS = 6
export const TOTP_PERIOD_SECONDS = 30

export interface TotpTimeWindow {
  counter: number
  elapsedSeconds: number
  remainingSeconds: number
  periodSeconds: typeof TOTP_PERIOD_SECONDS
  startedAt: number
  expiresAt: number
}

export interface TotpResult {
  code: string
  timeWindow: TotpTimeWindow
}

export function getTotpTimeWindow(timestamp: number | Date = Date.now()): TotpTimeWindow {
  const timestampMs = normalizeTimestamp(timestamp)
  const currentSecond = Math.floor(timestampMs / 1000)
  const counter = Math.floor(currentSecond / TOTP_PERIOD_SECONDS)
  const elapsedSeconds = currentSecond % TOTP_PERIOD_SECONDS
  const remainingSeconds = elapsedSeconds === 0 ? TOTP_PERIOD_SECONDS : TOTP_PERIOD_SECONDS - elapsedSeconds
  const startedAt = counter * TOTP_PERIOD_SECONDS * 1000

  return {
    counter,
    elapsedSeconds,
    remainingSeconds,
    periodSeconds: TOTP_PERIOD_SECONDS,
    startedAt,
    expiresAt: startedAt + TOTP_PERIOD_SECONDS * 1000,
  }
}

export async function generateTotp(secret: string, timestamp: number | Date = Date.now()): Promise<TotpResult> {
  const timeWindow = getTotpTimeWindow(timestamp)
  const keyBytes = decodeBase32Secret(secret)
  const counterBytes = createCounterBytes(timeWindow.counter)
  const signature = await signCounter(keyBytes, counterBytes)

  return {
    code: truncateToCode(signature),
    timeWindow,
  }
}

export async function generateTotpCode(secret: string, timestamp: number | Date = Date.now()): Promise<string> {
  const { code } = await generateTotp(secret, timestamp)

  return code
}

function normalizeTimestamp(timestamp: number | Date): number {
  const value = timestamp instanceof Date ? timestamp.getTime() : timestamp

  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError('时间戳必须是大于等于 0 的有限数字')
  }

  return value
}

function createCounterBytes(counter: number): Uint8Array {
  const counterBytes = new Uint8Array(8)
  const view = new DataView(counterBytes.buffer)
  const high = Math.floor(counter / 0x100000000)
  const low = counter >>> 0

  view.setUint32(0, high)
  view.setUint32(4, low)

  return counterBytes
}

async function signCounter(keyBytes: Uint8Array, counterBytes: Uint8Array): Promise<Uint8Array> {
  const normalizedKeyBytes = Uint8Array.from(keyBytes)
  const normalizedCounterBytes = Uint8Array.from(counterBytes)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    normalizedKeyBytes,
    { name: 'HMAC', hash: TOTP_ALGORITHM },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, normalizedCounterBytes)

  return new Uint8Array(signature)
}

function truncateToCode(signature: Uint8Array): string {
  const offset = signature[signature.length - 1] & 0x0f
  const binaryCode =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff)

  return String(binaryCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}
