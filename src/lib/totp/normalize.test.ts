import { Base32SecretError, decodeBase32Secret, normalizeBase32Secret } from './normalize'

describe('normalizeBase32Secret', () => {
  it('会 trim、移除空格并转为大写', () => {
    expect(normalizeBase32Secret('  asj4 dja2 patikjcf  ')).toBe('ASJ4DJA2PATIKJCF')
  })

  it('会拒绝空白密钥', () => {
    expect(() => normalizeBase32Secret('   ')).toThrow(new Base32SecretError('Base32 密钥不能为空'))
  })

  it.each(['*', '0', '1'])('invalid: 遇到非法字符 %s 时立即报错', (invalidChar) => {
    expect(() => normalizeBase32Secret(`ASJ4${invalidChar}DJA2`)).toThrow(
      new Base32SecretError(`Base32 密钥包含非法字符: ${invalidChar}`),
    )
  })
})

describe('decodeBase32Secret', () => {
  it('能解码 RFC 6238 使用的共享密钥', () => {
    const bytes = decodeBase32Secret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')

    expect(new TextDecoder().decode(bytes)).toBe('12345678901234567890')
  })
})
