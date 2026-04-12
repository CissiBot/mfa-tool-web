import { generateTotp, generateTotpCode, getTotpTimeWindow } from './totp'

const RFC_SHARED_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('generateTotpCode', () => {
  it.each([
    { timestampSeconds: 59, expectedCode: '287082' },
    { timestampSeconds: 1111111109, expectedCode: '081804' },
    { timestampSeconds: 1111111111, expectedCode: '050471' },
    { timestampSeconds: 1234567890, expectedCode: '005924' },
    { timestampSeconds: 2000000000, expectedCode: '279037' },
    { timestampSeconds: 20000000000, expectedCode: '353130' },
  ])('能匹配 RFC 6238 SHA-1 向量（$timestampSeconds）', async ({ timestampSeconds, expectedCode }) => {
    await expect(generateTotpCode(RFC_SHARED_SECRET, timestampSeconds * 1000)).resolves.toBe(expectedCode)
  })

  it('会先规范化带空格的小写密钥再计算验证码', async () => {
    await expect(generateTotpCode('asj4 dja2 patikjcf', 59_000)).resolves.toBe(
      await generateTotpCode('ASJ4DJA2PATIKJCF', 59_000),
    )
  })
})

describe('generateTotp', () => {
  it('返回验证码以及当前周期信息', async () => {
    await expect(generateTotp(RFC_SHARED_SECRET, 59_000)).resolves.toEqual({
      code: '287082',
      timeWindow: {
        counter: 1,
        elapsedSeconds: 29,
        remainingSeconds: 1,
        periodSeconds: 30,
        startedAt: 30_000,
        expiresAt: 60_000,
      },
    })
  })
})

describe('getTotpTimeWindow', () => {
  it('在周期边界返回完整剩余秒数', () => {
    expect(getTotpTimeWindow(60_000)).toEqual({
      counter: 2,
      elapsedSeconds: 0,
      remainingSeconds: 30,
      periodSeconds: 30,
      startedAt: 60_000,
      expiresAt: 90_000,
    })
  })
})
