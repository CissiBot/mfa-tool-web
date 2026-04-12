import { useMemo } from 'react'

import { CardComposer, CardPreview, appCardRepository } from '../features/cards'
import type { CardRepository } from '../lib/storage/repository'
import { getTotpTimeWindow, TOTP_PERIOD_SECONDS } from '../lib/totp'
import { appCardCollectionStore, type CardCollectionStore, useCardCollection } from './card-store'
import { appTimeStore, type TimeStore, useTimeSnapshot } from './time-store'
import './app.css'

interface AppProps {
  cardStore?: CardCollectionStore
  timeStore?: TimeStore
  cardRepository?: CardRepository
}

function App({
  cardStore = appCardCollectionStore,
  timeStore = appTimeStore,
  cardRepository = appCardRepository,
}: AppProps) {
  const collection = useCardCollection(cardStore)
  const now = useTimeSnapshot(timeStore)
  const timeWindow = useMemo(() => getTotpTimeWindow(now), [now])

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
              所有计算都会留在当前浏览器里完成，但 <strong>localStorage 不是安全存储</strong>
              ；后续导出文件同样会包含明文密钥，请只在受信任设备中使用。
            </p>
          </aside>
        </header>

        <section className="top-grid" aria-label="应用骨架布局">
          <section className="shell-panel composer-panel" aria-labelledby="composer-title">
            <div className="section-heading">
              <span className="section-tag section-tag--muted">添加卡片</span>
              <h2 id="composer-title">规范化密钥后写入本地卡片仓储</h2>
              <p>录入区现在会直接校验 Base32、保存到 localStorage，并在成功后刷新下方卡片列表。</p>
            </div>

            <CardComposer repository={cardRepository} onSaved={() => cardStore.refresh()} />
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
               <h2 id="card-list-title">保存成功后立即切换到真实 OTP 卡片</h2>
               <p>所有卡片继续复用同一时间心跳：备注、遮挡密钥、六位验证码与刷新进度会一起随时间窗稳定更新。</p>
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
                <p>录入区已经可以直接保存卡片；成功写入后，这里会立刻从空状态切换到真实列表。</p>
              </div>
            ) : (
              collection.cards.map((card) => (
                <CardPreview key={card.id} card={card} timeWindow={timeWindow} />
              ))
            )}
          </div>
        </section>
      </main>
    </>
  )
}

export default App
