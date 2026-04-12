const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_CHAR_SET = new Set(BASE32_ALPHABET)
const BASE32_CHAR_MAP = new Map(
  [...BASE32_ALPHABET].map((char, index) => [char, index] as const),
)

export class Base32SecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Base32SecretError'
  }
}

export function normalizeBase32Secret(rawSecret: string): string {
  const normalizedSecret = rawSecret.trim().replaceAll(' ', '').toUpperCase()

  if (normalizedSecret.length === 0) {
    throw new Base32SecretError('Base32 密钥不能为空')
  }

  const invalidChars = [...new Set([...normalizedSecret].filter((char) => !BASE32_CHAR_SET.has(char)))]

  if (invalidChars.length > 0) {
    throw new Base32SecretError(`Base32 密钥包含非法字符: ${invalidChars.join(', ')}`)
  }

  return normalizedSecret
}

export function decodeBase32Secret(secret: string): Uint8Array {
  const normalizedSecret = normalizeBase32Secret(secret)
  const bytes: number[] = []
  let buffer = 0
  let bitsInBuffer = 0

  for (const char of normalizedSecret) {
    const value = BASE32_CHAR_MAP.get(char)

    if (value === undefined) {
      throw new Base32SecretError(`Base32 密钥包含非法字符: ${char}`)
    }

    buffer = (buffer << 5) | value
    bitsInBuffer += 5

    while (bitsInBuffer >= 8) {
      bitsInBuffer -= 8
      bytes.push((buffer >> bitsInBuffer) & 0xff)
    }
  }

  return Uint8Array.from(bytes)
}
