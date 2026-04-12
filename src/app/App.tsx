import { useMemo, useState, type CSSProperties } from 'react'

import { getTotpTimeWindow, TOTP_PERIOD_SECONDS } from '../lib/totp'
import { CARD_COLORS, type CardColor, type CardRecord } from '../lib/storage'
import { appCardCollectionStore, type CardCollectionStore, useCardCollection } from './card-store'
import { appTimeStore, type TimeStore, useTimeSnapshot } from './time-store'
import './app.css'

interface AppProps {
  cardStore?: CardCollectionStore
  timeStore?: TimeStore
}

const COLOR_COPY: Record<CardColor, { label: string; hint: string }> = {
  slate: { label: '石墨灰', hint: '低干扰、适合通用账号' },
  blue: { label: '控制台蓝', hint: '默认强调、适合高频账号' },
  green: { label: '完成绿', hint: '偏成功感、适合协作工具' },
  amber: { label: '提醒琥珀', hint: '适合高风险与支付场景' },
  rose: { label: '警示玫瑰', hint: '适合需要额外留意的账号' },
  violet: { label: '夜色紫', hint: '适合个人与创作类服务' },
}

function App({ cardStore = appCardCollectionStore, timeStore = appTimeStore }: AppProps) {
  const [secretDraft, setSecretDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [selectedColor, setSelectedColor] = useState<CardColor>('blue')
  const collection = useCardCollection(cardStore)
  const now = useTimeSnapshot(timeStore)
  const timeWindow = useMemo(() => getTotpTimeWindow(now), [now])
  const progressRatio = timeWindow.elapsedSeconds / timeWindow.periodSeconds

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <main className="app-shell" id="main-content">
      <header className="shell-hero shell-panel">
        <div className="shell-hero__copy">
          <span className="section-tag">本地 MFA 工具站</span>
          <h1>MFA 本地验证码网站</h1>
          <p className="shell-hero__summary">
            把常用验证码入口压缩进一页深色控制台：上方聚焦风险说明与录入路径，下方保留导入导出和未来卡片网格的稳定位置。
          </p>
        </div>

        <aside className="risk-panel" data-testid="risk-note" aria-label="风险说明">
          <span className="risk-panel__label">风险说明</span>
          <p>
            所有计算都会留在当前浏览器里完成，但 <strong>localStorage 不是安全存储</strong>；后续导出文件同样会包含明文密钥，请只在受信任设备中使用。
          </p>
        </aside>
      </header>

      <section className="top-grid" aria-label="应用骨架布局">
        <section className="shell-panel composer-panel" aria-labelledby="composer-title">
          <div className="section-heading">
            <span className="section-tag section-tag--muted">添加卡片</span>
            <h2 id="composer-title">先锁定录入区与测试定位点</h2>
            <p>当前阶段只提供最终信息架构与字段布局，真正的校验、保存和错误反馈将在任务 5 接入。</p>
          </div>

          <form
            className="composer-form"
            onSubmit={(event) => {
              event.preventDefault()
            }}
          >
            <label className="field-block" htmlFor="secret-input">
              <span className="field-block__label">MFA 密钥</span>
              <input
                id="secret-input"
                data-testid="secret-input"
                name="secret"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="例如 ASJ4 DJA2 PATI KJCF…"
                value={secretDraft}
                onChange={(event) => {
                  setSecretDraft(event.target.value)
                }}
              />
            </label>

            <label className="field-block" htmlFor="note-input">
              <span className="field-block__label">备注</span>
              <input
                id="note-input"
                data-testid="note-input"
                name="note"
                type="text"
                autoComplete="off"
                placeholder="例如 GitHub / AWS / 支付平台…"
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value)
                }}
              />
            </label>

            <fieldset className="color-fieldset">
              <legend className="field-block__label">卡片颜色</legend>

              <div className="color-options" role="radiogroup" aria-label="卡片颜色">
                {CARD_COLORS.map((color) => {
                  const isActive = selectedColor === color

                  return (
                    <label
                      key={color}
                      className="color-option"
                      data-active={isActive}
                      data-color={color}
                      data-testid={`color-option-${color}`}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={color}
                        checked={isActive}
                        onChange={() => {
                          setSelectedColor(color)
                        }}
                      />
                      <span className="color-option__swatch" aria-hidden="true" />
                      <span className="color-option__copy">
                        <strong>{COLOR_COPY[color].label}</strong>
                        <small>{COLOR_COPY[color].hint}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="composer-actions">
              <button data-testid="save-card-button" type="button" disabled>
                保存流程将在任务 5 接入
              </button>
              <p>字段和 `data-testid` 已固定，可直接供后续表单校验、E2E 和持久化逻辑复用。</p>
            </div>
          </form>
        </section>

        <div className="side-stack">
          <section
            className="shell-panel io-panel"
            aria-labelledby="import-export-title"
            data-testid="import-export-section"
          >
            <div className="section-heading section-heading--compact">
              <span className="section-tag section-tag--muted">导入 / 导出</span>
              <h2 id="import-export-title">先预留动作槽位，再接入明文确认流</h2>
              <p>任务 7 会把文件读取、下载与风险确认接到这里；当前先固定区域层级与按钮定位。</p>
            </div>

            <div className="io-actions">
              <button data-testid="import-button" type="button" disabled>
                导入 JSON
              </button>
              <button data-testid="export-button" type="button" disabled>
                导出 JSON
              </button>
            </div>
          </section>

          <section className="shell-panel pulse-panel" aria-labelledby="pulse-title">
            <div className="section-heading section-heading--compact">
              <span className="section-tag section-tag--muted">共享时间源</span>
              <h2 id="pulse-title">所有未来卡片共用同一秒级心跳</h2>
            </div>

            <div className="pulse-panel__meter">
              <div>
                <span>当前窗口还剩</span>
                <strong>{timeWindow.remainingSeconds} 秒</strong>
              </div>
              <div>
                <span>统一刷新周期</span>
                <strong>{TOTP_PERIOD_SECONDS} 秒</strong>
              </div>
            </div>
            <p>页面此时只消费统一时间快照，不在单卡上各自创建 `setInterval`。</p>
          </section>
        </div>
      </section>

      <section className="shell-panel card-section" aria-labelledby="card-list-title">
        <div className="section-heading section-heading--split">
          <div>
            <span className="section-tag section-tag--muted">卡片列表</span>
            <h2 id="card-list-title">卡片网格与空状态已就位</h2>
            <p>仓储订阅层会在 hydrate 后切换为空状态或已加载列表，当前先保持列表容器和稳定测试定位点。</p>
          </div>

          <div className="sync-chip" data-testid="time-heartbeat">
            <span>共享心跳</span>
            <strong>{timeWindow.remainingSeconds}s</strong>
          </div>
        </div>

        <div className="card-list" data-testid="card-list" aria-live="polite">
          {!collection.hydrated ? (
            <div className="status-card status-card--loading">正在同步本地卡片仓储…</div>
          ) : collection.error ? (
            <div className="status-card status-card--warning">
              无法读取本地数据：{collection.error.message}
            </div>
          ) : collection.cards.length === 0 ? (
            <div className="empty-state" data-testid="empty-state">
              <span className="empty-state__badge">暂无卡片</span>
              <h3>你的验证码面板还是空的</h3>
              <p>添加区、导入导出区和卡片网格已经准备好；一旦后续任务接入保存逻辑，这里会立刻切换为真实卡片列表。</p>
            </div>
          ) : (
            collection.cards.map((card) => (
              <CardPreview
                key={card.id}
                card={card}
                progressRatio={progressRatio}
                remainingSeconds={timeWindow.remainingSeconds}
              />
            ))
          )}
        </div>
      </section>
      </main>
    </>
  )
}

interface CardPreviewProps {
  card: CardRecord
  progressRatio: number
  remainingSeconds: number
}

function CardPreview({ card, progressRatio, remainingSeconds }: CardPreviewProps) {
  const progressStyle = {
    '--otp-progress-ratio': String(progressRatio),
  } as CSSProperties

  return (
    <article className="otp-card" data-color={card.color}>
      <div className="otp-card__rail" aria-hidden="true" />
      <header className="otp-card__header">
        <div>
          <span className="otp-card__eyebrow">{COLOR_COPY[card.color].label}</span>
          <h3>{card.note.trim() === '' ? '未命名卡片' : card.note}</h3>
        </div>
        <span className="otp-card__countdown">{remainingSeconds}s</span>
      </header>

      <p className="otp-card__secret">{maskSecret(card.rawSecret)}</p>
      <p className="otp-card__hint">验证码和显隐逻辑将在任务 6 接入；当前先固定卡片信息密度和测试钩子。</p>

      <div className="otp-card__code" data-testid="otp-code">
        ------
      </div>

      <div className="otp-card__progress-track">
        <span className="otp-card__progress-bar" data-testid="otp-progress" style={progressStyle} />
      </div>
    </article>
  )
}

function maskSecret(rawSecret: string): string {
  const trimmed = rawSecret.trim()

  if (trimmed.length <= 8) {
    return '•••• ••••'
  }

  return `${trimmed.slice(0, 4)} •••• •••• ${trimmed.slice(-4)}`
}

export default App
