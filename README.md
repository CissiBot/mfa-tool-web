# MFA 本地验证码网站

这是一个基于 `Vite + React + TypeScript` 的纯前端静态站骨架，用于后续实现本地 MFA/TOTP 卡片工具。

## 当前范围

- 仅初始化前端工程、测试基线、Playwright 配置与 GitHub Pages 部署骨架。
- 当前页面只提供任务 1 的占位壳层，不包含 TOTP、仓储、导入导出等正式业务逻辑。

## 本地开发

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm test:ui
```

> `vite preview` 仅用于本地预览生产构建结果，不是正式生产服务。

## 技术基线

- 包管理器：`pnpm`
- 工程：`Vite + React + TypeScript`
- 单元与 DOM 测试：`Vitest + Testing Library`
- E2E：`Playwright`
- 部署：`GitHub Actions -> GitHub Pages`

## 安全说明

- 本项目是纯前端，所有数据处理都在浏览器本地完成。
- `localStorage` 仅是便捷持久化手段，不是安全存储。
- 自定义域名可以提升信任感、品牌一致性与后续迁移性，但不会改变 `localStorage` 的本地泄露风险。
- 请勿把此项目视为密钥保险箱；后续导入导出能力也只会提供风险提示，不会把明文密钥自动变成安全介质。

## GitHub Pages 与自定义域名

- 工作流使用 GitHub Pages 官方自定义 workflow 链路：`configure-pages -> upload-pages-artifact -> deploy-pages`。
- 在自定义域名场景下，Vite 的 `base` 保持默认 `/`，不要改成仓库子路径。
- 实际自定义域名是否生效，以仓库 **Settings -> Pages** 与 DNS 记录配置为准。
- 仓库根目录提供了 `CNAME` 占位文件，便于后续替换为真实域名；它不是“只有存在才会生效”的唯一条件。

## 目录约定

- `src/app/`：应用壳层
- `src/features/`：后续功能模块预留
- `src/lib/`：后续基础能力预留
- `src/test/`：测试辅助与基线用例
- `e2e/helpers/`：E2E 存储辅助函数
- `e2e/fixtures/`：E2E 共享测试数据
