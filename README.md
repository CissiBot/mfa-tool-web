# MFA 本地验证码网站

一个基于 `Vite + React + TypeScript` 的纯前端静态 MFA/TOTP 工具站。所有验证码计算、卡片保存、导入导出都在当前浏览器内完成，当前生产地址为：**https://mfa.cissi.top/**。

## 本地运行与验证

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test e2e/app.smoke.spec.ts --config=playwright.config.ts
```

> `playwright.config.ts` 已使用 `webServer` 托管 `vite preview`，用于验证生产构建产物；不要额外自创另一套预览启动方式。

## 这是什么 / 不是什么

- 这是一个本地处理的验证码工具站：录入 Base32 密钥后，浏览器会在本地生成 6 位 TOTP 验证码。
- 这是一个静态站：没有后端、没有账号系统、没有远程同步。
- 这不是安全隔离产品：它强调易用与迁移，不承诺把密钥变成“安全存储”。

## 本地处理、localStorage 与导出风险

- 所有密钥处理都在本地浏览器里完成，不会上送到项目自己的服务器。
- `localStorage` 只是方便长期保存卡片的本地容器，**不是安全存储**。同机其他人、恶意扩展、恶意程序，或系统层面的入侵都可能读到这些数据。
- 导出 JSON 是明文文件，里面会保留用户原始输入的 `rawSecret` 文本。请避免把它保存到聊天记录、公共网盘、共享目录或不受信任设备。
- 自定义域名可以提升信任感、品牌一致性与迁移性：以后就算迁移到别的静态托管平台，用户也更容易沿用同一入口；但它**不改变** `localStorage` 的本地设备风险，也不是安全隔离机制。

## 当前线上地址

- 主地址：`https://mfa.cissi.top/`
- Cloudflare Pages 默认子域：`https://mfa-tool-web.pages.dev/`
- GitHub 仓库：`https://github.com/CissiBot/mfa-tool-web`

## Cloudflare Pages 发布链路

当前生产环境使用 **Cloudflare Pages 连接 GitHub 仓库自动部署**：

1. GitHub 仓库：`CissiBot/mfa-tool-web`
2. 生产分支：`main`
3. 构建命令：`pnpm build`
4. 产物目录：`dist/`
5. 生产自定义域名：`mfa.cissi.top`

补充约定：

- 产物目录固定为 `dist/`。
- `vite.config.ts` 会自动判断发布场景：
  - 本地开发 / 本地构建：`base = /`
  - GitHub Actions 下的普通项目仓库 Pages：`base = /<repo>/`
  - 配置了真实 `CNAME` 的自定义域名场景：`base = /`
- Cloudflare Pages 直接构建时，会自然使用根路径资源，不依赖仓库里的 `CNAME` 文件。

## GitHub Pages 说明

仓库里仍保留了 GitHub Pages 的 workflow 与兼容性 `base` 逻辑，主要用于保留备用发布链路与本地/CI 构建兼容性；**当前主生产通道已经不是 GitHub Pages，而是 Cloudflare Pages + `mfa.cissi.top`。**

如果以后重新启用 GitHub Pages 项目仓库发布，地址会是：

`https://cissibot.github.io/mfa-tool-web/`

## 自定义域名接入步骤

当前线上已绑定的自定义域名是：`mfa.cissi.top`。

如果后续要迁移到别的域名，建议按 **Cloudflare Pages 自定义域名** 的方式处理，而不是回到仓库内写死占位 `CNAME`。

### 1. 在 Cloudflare Pages 中添加域名

- 把生产域名添加到 Cloudflare Pages 项目。
- 等域名状态进入 `active` 后，再继续 HTTPS 与代理设置。

### 2. 配置 DNS 记录

如果你使用子域名（推荐，例如 `mfa.example.com`）：

- 添加一条 `CNAME` 记录，让子域指向对应的 `*.pages.dev`

当前这个项目的实际绑定就是：`mfa.cissi.top -> mfa-tool-web.pages.dev`

### 3. 等待证书与 HTTPS 收敛

- 当 Cloudflare Pages 域名状态与证书都准备完成后，再决定是否开启代理（橙云）。
- 对这个项目，必须先让域名验证收敛，再开代理，否则容易卡在校验阶段。

### 4. 仓库 About / Homepage

建议把 GitHub 仓库 About 里的 Homepage 直接指向生产地址：

`https://mfa.cissi.top/`

这样用户在 GitHub 仓库首页就能直接看到主站入口。

## 为什么后续可以再接自定义域名，而不是一开始就强绑

- 更容易让用户确认自己访问的是常用入口，减少“这是哪个仓库页”的认知负担。
- 更利于后续迁移：即使未来不再使用 GitHub Pages，也可以继续沿用同一域名。
- 更适合放进个人书签、密码管理器备注或团队内部说明文档。

但再次强调：**自定义域名提升的是入口信任感与迁移性，不是本地数据安全等级。**

## 目录概览

- `src/app/`：应用壳层与页面装配
- `src/features/cards/`：卡片录入、展示、删除
- `src/features/import-export/`：导入导出、风险确认
- `src/lib/`：TOTP、存储 schema 与仓储逻辑
- `e2e/`：Playwright smoke E2E 与辅助数据
