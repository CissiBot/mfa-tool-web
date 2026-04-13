# AGENTS.md

## 先看这些文件

- 先信可执行事实：`package.json`、`vite.config.ts`、`playwright.config.ts`、`eslint.config.js`、`tsconfig*.json`、`.github/workflows/deploy-pages.yml`。
- 再看产品边界：`README.md`。README 和配置冲突时，以脚本、配置、当前源码为准。
- 真正入口链路是：`index.html` → `src/main.tsx` → `src/app/App.tsx`。

## 仓库事实

- 这是单包 `pnpm` 项目：`Vite + React + TypeScript`，部署到 `GitHub Pages`。
- 产品是本地 TOTP 工具，没有后端、账号系统、团队协作或云同步。
- 当前首页壳层由 `src/app/App.tsx` 装配：工具栏（导入 / 导出 / 添加卡片）+ 卡片列表 + 按需打开的工作区弹层；不要按旧文案假设首页直接内嵌录入表单。

## 常用命令

- 安装依赖：`pnpm install`
- 本地开发：`pnpm dev`
- lint：`pnpm lint`
- 单测总跑：`pnpm test`
- 构建（含类型检查）：`pnpm build`
- 单独类型检查：`pnpm exec tsc -b`
- E2E smoke：`pnpm exec playwright test e2e/app.smoke.spec.ts --config=playwright.config.ts`

## 验证顺序

- 默认最小闭环：`pnpm lint` → `pnpm test` → `pnpm build`。
- `pnpm build` 实际是 `tsc -b && vite build`；仓库没有单独的 `typecheck` script。
- `tsconfig.app.json` 只覆盖 `src`；`tsconfig.node.json` 只覆盖 `vite.config.ts` 和 `playwright.config.ts`。改配置文件时别只盯前端类型检查。
- Vitest 配置写在 `vite.config.ts`，运行环境是 `jsdom`，并且显式排除了 `e2e/**`。
- Playwright 不走 `pnpm dev`，而是固定复用 `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort`。

## 聚焦测试时别猜

- TOTP：`pnpm vitest run src/lib/totp/**/*.test.ts`
- storage：`pnpm vitest run src/lib/storage/**/*.test.ts`
- App：`pnpm vitest run src/app/App.test.tsx`
- cards：`pnpm vitest run src/features/cards/OtpCard.test.tsx`
- import/export：`pnpm vitest run src/features/import-export/**/*.test.tsx`
- `src/**/tests/*.test.ts(x)` 是一行 `import '../*.test'` 的转发包装文件，不是真实断言实现；搜测试或做 focused run 时不要误判。
- `e2e/app.smoke.spec.ts` 依赖 WSL 调 Windows Edge CDP（硬编码了 `msedge.exe`、PowerShell、`cmd.exe` 路径）。当前环境若没有这条链路，应先说明限制。
- 这个 smoke spec 的断言已经和当前 UI 有漂移；改 E2E 前先对照 `src/app/App.tsx`、`src/app/AppWorkspace.tsx`、`src/app/AppCardListSection.tsx` 与组件测试，不要默认 smoke 仍然可信。

## 目录边界

- `src/app/`：应用壳层、页面装配、工作区状态、排序、时间/卡片 store。涉及页面行为时先看这里。
- `src/features/cards/`：卡片创建、编辑、展示、复制、拖拽排序；`CardPreview.tsx` 只是 `OtpCard` 的别名层。
- `src/features/import-export/`：导入导出入口、确认弹层、文件读写、结果反馈。
- `src/lib/storage/`：schema、编解码、`localStorage` repository、导入合并、导出与清空。
- `src/lib/totp/`：Base32 规范化 / 解码与 TOTP 计算。
- `e2e/`：当前只有一个 smoke 用例和辅助文件，不是完整 E2E 套件体系。

## 业务与部署不变量

- `localStorage` key 固定为 `mfa-web/cards:v1`；storage schema version 固定为 `1`。
- TOTP 固定为 `SHA-1 + 6 位 + 30 秒`；不要扩成 HOTP、其他哈希、其他位数或自定义周期。
- 导出 JSON 是明文，且保留原始 `rawSecret`；不要在代码或文档里暗示这是安全存储。
- README 已明确说明：`localStorage` 不是安全能力，自定义域名也不是安全能力；不要反向改写这个边界。
- GitHub Pages workflow 在 `main` 分支 push 或手动触发时运行，构建产物固定是 `dist`。
- 如果仓库根目录存在 `CNAME`，workflow 会复制到 `dist/CNAME`；这是当前仓库约定，不要随手删掉。
- `vite.config.ts` 会根据 `CNAME` 和 GitHub Actions 环境动态决定 `base`；不要把 `base` 改成固定仓库子路径。
