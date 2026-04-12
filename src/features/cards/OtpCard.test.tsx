import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { CardRecord } from '../../lib/storage'
import { generateTotpCode, getTotpTimeWindow } from '../../lib/totp'
import { getCardNoteLabel } from './display'
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
    expect(screen.getByTestId('otp-progress')).toHaveAttribute('aria-valuenow', '19')

    rerender(<OtpCard card={createCard()} timeWindow={nextTimeWindow} />)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(nextCode)
    })
    expect(screen.getByTestId('otp-code')).not.toHaveTextContent(initialCode)
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
    expect(screen.getByTestId('otp-progress')).toHaveAttribute('aria-valuenow', '29')
  })

  it('卡面直接显示原始密钥，不再提供显隐切换', () => {
    const card = createCard({ rawSecret: 'JBSW Y3DP EH PK3PXP' })
    render(<OtpCard card={card} timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))} />)

    expect(screen.getByTestId('otp-secret')).toHaveTextContent(card.rawSecret)
    expect(screen.queryByTestId('toggle-secret-button')).not.toBeInTheDocument()
  })

  it('点击复制按钮会复制当前验证码', async () => {
    const copyCode = vi.fn().mockResolvedValue(undefined)
    const timeWindow = getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))
    const expectedCode = await generateTotpCode('JBSWY3DPEHPK3PXP', timeWindow.startedAt)

    render(<OtpCard card={createCard()} copyCode={copyCode} timeWindow={timeWindow} />)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).toHaveTextContent(expectedCode)
    })

    fireEvent.click(screen.getByTestId('copy-code-button'))

    await waitFor(() => {
      expect(copyCode).toHaveBeenCalledWith(expectedCode)
    })
    expect(screen.getByTestId('copy-code-button')).toHaveAttribute('title', '已复制')
    expect(screen.getByTestId('copy-status')).toHaveTextContent('验证码已复制')
  })

  it('点击编辑按钮会触发对应回调', () => {
    const onEditNote = vi.fn()
    const onEditSecret = vi.fn()

    render(
      <OtpCard
        card={createCard()}
        timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))}
        onEditNote={onEditNote}
        onEditSecret={onEditSecret}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '修改备注：GitHub' }))
    fireEvent.click(screen.getByRole('button', { name: '修改密钥：GitHub' }))

    expect(onEditNote).toHaveBeenCalledTimes(1)
    expect(onEditSecret).toHaveBeenCalledTimes(1)
  })

  it('备注为空时显示稳定占位，不影响标题区域', () => {
    render(<OtpCard card={createCard({ note: '   ' })} timeWindow={getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))} />)

    expect(screen.getByRole('heading', { name: getCardNoteLabel('   ') })).toBeInTheDocument()
  })

  it('卡面保留备注、密钥、验证码、编辑按钮、复制按钮和计时条', async () => {
    const timeWindow = getTotpTimeWindow(Date.parse('2026-04-12T12:00:19.000Z'))

    render(<OtpCard card={createCard()} timeWindow={timeWindow} />)

    await waitFor(() => {
      expect(screen.getByTestId('otp-code')).not.toHaveTextContent('------')
    })

    expect(screen.getByLabelText('备注')).toBeInTheDocument()
    expect(screen.getByLabelText('密钥')).toBeInTheDocument()
    expect(screen.getByLabelText('当前验证码')).toBeInTheDocument()
    expect(screen.getByTestId('edit-note-button')).toBeInTheDocument()
    expect(screen.getByTestId('edit-secret-button')).toBeInTheDocument()
    expect(screen.getByTestId('copy-code-button')).toBeInTheDocument()
    expect(screen.getByTestId('otp-progress')).toBeInTheDocument()
    expect(screen.queryByTestId('toggle-secret-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-card-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('otp-countdown')).not.toBeInTheDocument()
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
