import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { CardRecord } from '../../lib/storage'
import { generateTotpCode, getTotpTimeWindow } from '../../lib/totp'
import { getCardNoteLabel, maskSecret } from './display'
import { OtpCard } from './OtpCard'

describe('OtpCard', () => {
  it('在固定时间窗内展示稳定验证码，并在跨过 30 秒边界后刷新验证码与进度', async () => {
    const initialTime = Date.parse('2026-04-12T12:00:19.000Z')
    const initialTimeWindow = getTotpTimeWindow(initialTime)
    const nextBoundaryTime = Date.parse('2026-04-12T12:00:30.000Z')
    const nextTimeWindow = getTotpTimeWindow(nextBoundaryTime)
    const { rerender } = render(<OtpCard card={createCard()} timeWindow={initialTimeWindow} />)
    const initialCode = await generateTotpCode('JBSWY3DPEHPK3PXP', initialTimeWindow.startedAt)
    const nextCode = await generateTotpCode('JBSWY3DPEHPK3PXP', nextTimeWindow.startedAt)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(initialCode)
    })
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('11s')
    expect(screen.getByTestId('otp-progress')).toHaveAttribute('aria-valuenow', '19')

    rerender(<OtpCard card={createCard()} timeWindow={nextTimeWindow} />)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(nextCode)
    })
    expect(screen.getByTestId('otp-code')).not.toHaveTextContent(initialCode)
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('30s')
    expect(screen.getByTestId('otp-progress')).toHaveAttribute('aria-valuenow', '0')
  })

  it('时间快照回跳时会直接回到对应时间窗，而不是依赖累计 tick', async () => {
    const laterTimeWindow = getTotpTimeWindow(Date.parse('2026-04-12T12:01:05.000Z'))
    const earlierTimeWindow = getTotpTimeWindow(Date.parse('2026-04-12T12:00:59.000Z'))
    const { rerender } = render(<OtpCard card={createCard()} timeWindow={laterTimeWindow} />)
    const earlierCode = await generateTotpCode('JBSWY3DPEHPK3PXP', earlierTimeWindow.startedAt)

    rerender(<OtpCard card={createCard()} timeWindow={earlierTimeWindow} />)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(earlierCode)
    })
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('1s')
    expect(screen.getByTestId('otp-progress')).toHaveAttribute('aria-valuenow', '29')
  })

  it('密钥默认遮挡，切换 reveal 后显示原文，再次挂载后恢复遮挡', () => {
    const card = createCard({ rawSecret: 'JBSW Y3DP EH PK3PXP' })
    const view = render(<OtpCard card={card} timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))} />)

    expect(screen.getByTestId('otp-secret')).toHaveTextContent(maskSecret(card.rawSecret))
    expect(screen.queryByText(card.rawSecret)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-secret-button'))

    expect(screen.getByTestId('otp-secret')).toHaveTextContent(card.rawSecret)
    expect(screen.getByTestId('toggle-secret-button')).toHaveAttribute('aria-pressed', 'true')

    view.unmount()
    render(<OtpCard card={card} timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))} />)

    expect(screen.getByTestId('otp-secret')).toHaveTextContent(maskSecret(card.rawSecret))
    expect(screen.getByTestId('toggle-secret-button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('备注为空时显示稳定占位，不影响标题区域', () => {
    render(<OtpCard card={createCard({ note: '   ' })} timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))} />)

    expect(screen.getByRole('heading', { name: getCardNoteLabel('   ') })).toBeInTheDocument()
  })
})

function createCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card-github',
    rawSecret: 'JBSW Y3DP EH PK3PXP',
    normalizedSecret: 'JBSWY3DPEHPK3PXP',
    note: 'GitHub',
    color: 'blue',
    createdAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
    ...overrides,
  }
}
