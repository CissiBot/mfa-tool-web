# MFA Web

<p align="center">
  <img src="./public/favicon.svg" alt="MFA Web 图标" width="72" height="72" />
</p>

一个面向日常使用的本地 TOTP 验证码工具网站，用来集中管理常用 MFA 卡片，并在浏览器中直接查看、复制、排序、备份与迁移验证码。

<p align="center">
  <a href="https://vite.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" /></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" /></a>
  <a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white" /></a>
  <a href="https://vitest.dev/"><img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" /></a>
  <a href="https://playwright.dev/"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white" /></a>
  <a href="https://docs.github.com/pages"><img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-121013?logo=github&logoColor=white" /></a>
</p>

**在线使用：<https://mfa.cissi.top/>**

> [!IMPORTANT]
> MFA Web 是本地工具，不是托管式安全服务。卡片数据默认保存在浏览器 `localStorage`，导出 JSON 也会保留原始密钥文本。

## 为什么使用 MFA Web

MFA Web 是一个基于 **Vite + React + TypeScript** 构建的纯前端应用，界面、验证码计算、卡片管理与导入导出都直接运行在浏览器中。

- **固定入口**：把常用 TOTP 卡片集中放在一个稳定地址里
- **纯前端运行**：验证码计算全部在浏览器内完成，不依赖后端
- **本地整理能力**：支持新增、编辑、删除、拖动排序与快速复制验证码
- **备份迁移直接**：支持明文 JSON 导入 / 导出，适合临时迁移与本地备份
- **规则简单稳定**：固定使用标准 TOTP（SHA-1、6 位、30 秒）

## 适用场景

MFA Web 适合以下场景：

- 管理一组常用的 TOTP 账号
- 在浏览器里快速查看和复制验证码
- 按使用频率整理卡片顺序
- 在不同浏览器或设备之间手动导出 / 导入迁移

它不适合以下预期：

- 账号体系、团队协作或云同步
- 服务端隔离存储
- 硬件令牌级别的安全防护
- 扫码录入、二维码识别或 otpauth URI 工作流

## 核心能力

### 本地卡片管理

- 新增卡片
- 分别修改备注与密钥
- 删除单张卡片前会先确认
- 拖动卡片实时排序
- 新增卡片时自动轮换默认颜色

### 实时验证码

- 浏览器本地生成 6 位 TOTP 验证码
- 自动按 30 秒周期刷新
- 显示当前刷新进度
- 一键复制当前验证码

### 导入与导出

- 导出当前卡片为明文 JSON
- 导出前显示风险确认
- 导入后反馈新增、重复跳过与失败原因
- 支持基于同一 schema 的本地备份恢复

## 快速开始

### 直接使用

打开：<https://mfa.cissi.top/>

### 本地开发

```bash
pnpm install
pnpm dev
```

### 本地验证

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test e2e/app.smoke.spec.ts --config=playwright.config.ts
```

> [!NOTE]
> E2E smoke 复用仓库现有的生产预览链路：先构建，再通过 `vite preview` 验证页面行为。

## 常见操作

### 添加卡片

1. 点击右上角 **添加卡片**
2. 输入 Base32 密钥
3. 可选填写备注
4. 保存后卡片会立即出现在列表中，下一张新卡会自动轮换默认颜色

### 编辑与整理

- 可分别修改备注与密钥
- 删除前会显示二次确认，取消不会影响现有卡片
- 拖动排序把手可调整卡片顺序
- 拖动过程中列表会实时换位

### 导出备份

1. 点击 **导出 JSON**
2. 阅读并确认明文导出风险
3. 下载备份文件并保存在受信任位置

### 导入数据

1. 点击 **导入 JSON**
2. 选择符合格式的备份文件
3. 查看导入结果中的新增、跳过和失败原因

## 数据与安全边界

### 数据存储方式

- 卡片默认保存在当前浏览器的 `localStorage`
- 导出文件是明文 JSON
- 导出内容会保留原始 `rawSecret` 文本

这意味着浏览器环境、同机账户、恶意扩展、恶意程序或系统级入侵，都可能接触到这些数据。

### 安全定位

MFA Web 是本地使用工具，重点在于录入、查看、整理与备份，不是密钥保险箱。

如果需要更强的隔离、防泄漏或多设备同步能力，应配合专门的密码管理器、硬件令牌或受控企业安全方案使用，而不是依赖当前页面本身。

### 访问入口与域名

生产入口固定为 `https://mfa.cissi.top/`。

这个域名提供的是稳定入口与迁移灵活性，不改变 `localStorage`、导出文件或浏览器环境本身的安全边界。

## 技术参考

### TOTP 规则

- 哈希算法：`SHA-1`
- 验证码位数：`6`
- 时间步长：`30 秒`

### 存储约定

- localStorage key：`mfa-web/cards:v1`
- storage schema version：`1`

### 仓库结构

- `src/app/`：应用壳层、页面装配、全局状态
- `src/features/cards/`：卡片录入、展示、编辑与排序交互
- `src/features/import-export/`：导入导出、确认弹窗与反馈提示
- `src/lib/storage/`：存储 schema、仓储与数据约束
- `src/lib/totp/`：Base32 规范化与 TOTP 计算
- `e2e/`：Playwright smoke 用例与辅助数据

## 维护者参考

- 构建命令：`pnpm build`
- 输出目录：`dist`

当前 Vite 配置兼容本地开发与根路径静态托管；如果部署链路、构建方式或主入口发生变化，应同步更新本 README。

## 后续维护重点

优先关注核心交互稳定性、导入导出反馈可读性，以及文档中的入口、命令与实际线上链路是否持续一致。
