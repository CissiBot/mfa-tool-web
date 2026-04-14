# MFA Web

<p align="center">
  <img src="./public/favicon.svg" alt="MFA Web 图标" width="72" height="72" />
</p>

<p align="center">
  一个基于 <strong>Vite + React + TypeScript</strong> 构建的本地 TOTP 卡片工具。<br />
  你可以在浏览器里集中查看、复制、整理、导入和导出常用 MFA 验证码。
</p>

<p align="center">
  <a href="https://vite.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" /></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" /></a>
  <a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white" /></a>
  <a href="https://vitest.dev/"><img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" /></a>
  <a href="https://playwright.dev/"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white" /></a>
  <a href="https://docs.github.com/pages"><img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-121013?logo=github&logoColor=white" /></a>
</p>

<!-- README-I18N:START -->

[English](./README.en.md) | **简体中文**

<!-- README-I18N:END -->

> [!IMPORTANT]
> MFA Web 是本地前端工具，不是托管式安全服务。卡片数据默认保存在浏览器 `localStorage`，导出文件为明文 JSON，并保留原始 `rawSecret` 文本。

## 概览

这个项目把常用 TOTP 验证码整理成可管理的卡片列表。当前页面结构以卡片面板为中心：顶部提供 **导入 JSON**、**导出 JSON** 和 **添加卡片** 按钮，主体区域展示验证码卡片列表；新增与编辑操作通过覆盖层工作区完成，而不是在首页常驻表单中完成。

所有验证码计算都在浏览器内完成，当前实现固定使用标准 TOTP：`SHA-1`、`6` 位、`30` 秒周期。

## 核心能力

- **本地卡片管理**：新增、编辑、删除卡片，保存后立即刷新列表
- **实时验证码**：在浏览器中生成 TOTP，并显示刷新进度
- **快速复制**：一键复制当前 6 位验证码到剪贴板
- **排序整理**：支持鼠标拖拽和键盘排序，结果会持久化保存
- **导入导出**：支持明文 JSON 导入与导出，并提供逐条校验反馈
- **跨标签页同步**：本地数据变化后可通过 `storage` 事件刷新其他标签页视图

## 当前产品边界

MFA Web 当前明确聚焦在“本地查看和整理 TOTP 卡片”，以下能力**不在现有实现范围内**：

- 没有后端、账号体系、用户登录或服务端存储
- 没有团队协作、云同步或远程备份
- 没有扫码录入、二维码识别或 `otpauth://` 工作流
- 没有 HOTP，也没有可配置哈希算法、位数或时间周期

如果你需要更强的隔离、防泄漏、多设备同步或组织级审计能力，应使用专门的密码管理器、硬件令牌或企业安全方案，而不是把当前页面当作安全保险箱。

## 使用方式

### 添加卡片

1. 点击右上角 **添加卡片**
2. 输入 Base32 格式的 MFA 密钥
3. 选填备注
4. 保存后卡片会写入本地仓储，并立即出现在列表中

### 查看、复制与编辑

- 卡片会展示备注、原始密钥文本和当前验证码
- 点击 **复制** 可把当前验证码写入剪贴板
- 可分别进入“修改备注”或“修改密钥”工作区
- 删除前会显示确认弹窗，取消不会改动已有数据

### 排序

- 支持指针拖拽排序
- 也支持键盘排序：`Enter` / `空格` 拿起卡片，`↑` / `↓` 移动，`Enter` 确认，`Escape` 取消

### 导入与导出

- **导入 JSON**：读取本地文件，逐条校验 schema，并反馈新增、重复跳过与失败原因
- **导出 JSON**：导出前强制进行风险确认，生成的文件为明文，包含原始 `rawSecret`

## 快速开始

### 环境要求

- Node.js 22（CI 当前使用该版本）
- pnpm 10

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

请通过 Vite 开发服务器或预览服务器访问页面，不要直接以 `file://` 方式打开 `index.html`；当前入口依赖 `/src/main.tsx`、`/favicon.svg` 这类由 Vite 提供的资源路径，直接打开本地 HTML 不属于仓库支持的运行方式，而且浏览器在该场景下对 `localStorage` 的行为也不稳定。

### 常用命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:ui
pnpm preview
```

> [!NOTE]
> `pnpm build` 实际会执行 `tsc -b && vite build`。类型检查不仅覆盖 `src`，也会覆盖 `vite.config.ts` 和 `playwright.config.ts`。

## 验证链路

推荐的最小验证闭环是：

```bash
pnpm lint
pnpm test
pnpm build
```

如果你要做更聚焦的验证，仓库当前常见测试入口包括：

```bash
pnpm vitest run src/lib/totp/**/*.test.ts
pnpm vitest run src/lib/storage/**/*.test.ts
pnpm vitest run src/app/App.test.tsx
pnpm vitest run src/features/cards/CardComposer.test.tsx
pnpm vitest run src/features/cards/OtpCard.test.tsx
pnpm vitest run src/features/import-export/**/*.test.tsx
```

### 关于 Playwright

`pnpm test:ui` 使用的是 Playwright 配置，但运行方式不是 `pnpm dev`，而是：

```bash
pnpm build
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
```

> [!CAUTION]
> 当前 `e2e/app.smoke.spec.ts` 依赖 WSL 下调用 Windows Edge 与 CDP，包含硬编码的 `msedge.exe`、PowerShell 和 `cmd.exe` 路径。它不是一个无环境前提的通用跨平台 smoke，用于本地验证时需要先确认环境具备这条链路。
>
> 另外，这个 smoke 用例的部分断言仍基于旧首页结构，和现行 UI 已有漂移；`pnpm test:ui` 更适合作为环境受限的参考验证，不应直接视为当前页面规格的权威来源。

## 数据与安全说明

### 本地存储约定

- `localStorage` key：`mfa-web/cards:v1`
- storage schema version：`1`
- 导出格式：明文 JSON
- 导出内容：包含 `rawSecret`、`normalizedSecret`、备注、颜色与时间戳

### TOTP 固定规则

- 算法：`SHA-1`
- 位数：`6`
- 周期：`30` 秒

### 安全边界

验证码计算不会上传到后端，但这**不等于安全存储**。浏览器环境、同机账户、恶意扩展、恶意程序、聊天记录、网盘历史或共享目录，都可能暴露本地卡片和导出文件中的密钥内容。

如果仓库将来配置了自定义域名，它只影响访问入口和部署路径，不会改变浏览器 `localStorage` 与明文导出的风险边界。

## 项目结构

```text
src/
  app/                  应用壳层、工作区开关、列表态、排序与全局时间/卡片 store
  features/cards/       卡片录入、展示、复制、编辑与排序交互
  features/import-export/ 导入导出入口、确认弹窗、反馈提示与文件 IO
  lib/storage/          schema、localStorage 仓储与导入合并逻辑
  lib/totp/             Base32 规范化 / 解码与 TOTP 计算
e2e/                    Playwright smoke 用例与辅助文件
```

## 部署

仓库当前通过 GitHub Pages 部署：

- 触发方式：`main` 分支 push 或手动触发 workflow
- 构建环境：Node.js 22 + pnpm 10
- 安装方式：`pnpm install --frozen-lockfile`
- 构建产物：`dist`

Vite 的 `base` 不是写死的，而是会根据以下条件动态决定：

- 仓库根目录是否存在 `CNAME`
- 是否运行在 GitHub Actions 中
- 仓库名是否等于 `<owner>.github.io`

这意味着 README 不应把部署路径或自定义域名写成固定不变的事实；如果部署入口发生变化，应同步更新此文档。

另外，`pnpm preview` 仅用于本地检查构建产物，不是正式生产服务器。
