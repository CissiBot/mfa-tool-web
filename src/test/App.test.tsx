import { render, screen } from '@testing-library/react'
import App from '../app/App'

describe('App', () => {
  it('渲染初始化说明与安全边界文案', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'MFA 本地验证码网站' })).toBeInTheDocument()
    expect(screen.getByText(/localStorage 仅用于便捷持久化/)).toBeInTheDocument()
  })
})
