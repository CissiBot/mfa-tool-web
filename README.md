# MFA 本地验证码网站

一个基于 `Vite + React + TypeScript` 的纯前端静态 MFA/TOTP 工具站。所有验证码计算、卡片保存、导入导出都在当前浏览器内完成，适合部署到 `GitHub Pages + 自定义域名`。

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

## GitHub Pages 发布链路

仓库使用 GitHub Pages 官方推荐的自定义工作流链路：

1. 构建：`pnpm build`
2. 上传产物：`actions/upload-pages-artifact`
3. 部署：`actions/deploy-pages`

补充约定：

- 产物目录固定为 `dist/`。
- Vite `base` 保持默认 `/`，不要假设站点一定跑在 `/<repo>/` 子路径下；这样才兼容 GitHub Pages + 自定义域名。
- 根目录 `CNAME` 会在 workflow 里被复制到 `dist/CNAME`，确保 Pages artifact 也携带自定义域名文件。

## 自定义域名接入步骤

### 1. 准备 CNAME

- 修改仓库根目录的 `CNAME` 文件，把占位域名替换成你的真实域名，例如：`mfa.example.com`。
- GitHub Pages 部署时会读取产物中的 `CNAME`，所以 workflow 已额外把根目录 `CNAME` 注入到 `dist/`。

### 2. 配置 DNS 记录

如果你使用子域名（推荐，例如 `mfa.example.com`）：

- 添加一条 `CNAME` 记录：`mfa.example.com -> <username>.github.io`

如果你坚持使用根域名（例如 `example.com`），需要按 GitHub Pages 文档配置 `A/AAAA` 记录；但对这个项目来说，子域名通常更清晰，也更适合和其他站点隔离管理。

### 3. 配置 GitHub Pages

进入仓库 **Settings -> Pages**：

- 确认 Source 使用 GitHub Actions
- 在 **Custom domain** 中填入与你 `CNAME` 一致的域名
- 等待 GitHub 校验 DNS 生效

### 4. 开启 HTTPS

当 DNS 和证书准备完成后，在 **Settings -> Pages** 中：

- 确认站点已经可以通过 `https://你的域名` 访问
- 勾选 **Enforce HTTPS**

`Enforce HTTPS` 的作用是强制浏览器走 HTTPS，避免用户继续通过明文 HTTP 访问站点；但它同样**不会**把本地 `localStorage` 变成安全存储，只是让传输入口符合现代浏览器的基本要求。

## 为什么优先自定义域名，而不是默认 github.io

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
