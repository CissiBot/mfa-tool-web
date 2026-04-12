import './app.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="hero-panel__eyebrow">任务 1：工程基线</span>
        <h1>MFA 本地验证码网站</h1>
        <p className="hero-panel__summary">
          当前仓库已完成纯前端静态站骨架初始化，后续任务会在这里继续补齐
          TOTP、卡片管理、导入导出与部署细节。
        </p>
      </section>

      <section className="grid-panels" aria-label="项目基线状态">
        <article className="info-card">
          <h2>技术基线</h2>
          <ul>
            <li>Vite + React + TypeScript</li>
            <li>Vitest + Testing Library</li>
            <li>Playwright + GitHub Pages</li>
          </ul>
        </article>

        <article className="info-card">
          <h2>安全边界</h2>
          <ul>
            <li>本项目是纯前端，本地完成计算与渲染。</li>
            <li>localStorage 仅用于便捷持久化，不属于安全存储。</li>
            <li>自定义域名可提升信任感与迁移性，但不改变本地存储风险。</li>
          </ul>
        </article>

        <article className="info-card info-card--muted">
          <h2>后续目录预留</h2>
          <p>`src/features`、`src/lib`、`src/test`、`e2e` 已准备好供后续任务直接复用。</p>
        </article>
      </section>
    </main>
  )
}

export default App
