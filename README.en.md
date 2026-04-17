# MFA Web

<p align="center">
  <img src="./public/favicon.svg" alt="MFA Web icon" width="72" height="72" />
</p>

<p align="center">
  A local TOTP card tool built with <strong>Vite + React + TypeScript</strong>.<br />
  It lets you view, copy, organize, import, and export your common MFA codes directly in the browser.
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

**English** | [简体中文](./README.md)

<!-- README-I18N:END -->

> [!IMPORTANT]
> MFA Web is a local frontend tool, not a hosted security service. Card data is stored in the browser `localStorage` by default, and exported files are plain JSON that keep the original `rawSecret` text.

## Overview

This project turns your common TOTP codes into a manageable card list. The current page layout centers on the card panel: the top bar provides **Show Secrets / Hide Secrets**, **Import JSON**, **Export JSON**, and **Add Card** actions, while the main area renders the OTP card list. Creating and editing cards happens inside an overlay workspace instead of a permanent form on the homepage.

All OTP calculation happens in the browser, and the current implementation is fixed to standard TOTP: `SHA-1`, `6` digits, and a `30`-second period.

## Core Capabilities

- **Local card management**: create, edit, and delete cards, then refresh the list immediately after saving
- **Live codes**: generate TOTP codes in the browser and show the refresh progress
- **Secret visibility control**: hide raw secrets by default and reveal or mask them again with one global toggle
- **Quick copy**: copy the current 6-digit code to the clipboard with one click
- **Ordering**: reorder cards with drag and drop or keyboard controls, then persist the result locally
- **Import and export**: import and export plain JSON with per-item validation feedback
- **Cross-tab sync**: refresh other tabs through the `storage` event when local data changes

## Current Product Boundaries

MFA Web is explicitly focused on viewing and organizing local TOTP cards. The following capabilities are **not part of the current implementation**:

- no backend, account system, user login, or server-side storage
- no team collaboration, cloud sync, or remote backups
- no QR scanning, QR recognition, or `otpauth://` workflow
- no HOTP and no configurable hash algorithm, digit count, or time period

If you need stronger isolation, leak prevention, multi-device sync, or organization-level auditing, use a dedicated password manager, hardware token, or enterprise security solution instead of treating this page as a secure vault.

## How to Use

### Add a card

1. Click **Add Card** in the top-right corner.
2. Enter a Base32 MFA secret.
3. Optionally add a note.
4. After saving, the card is written to the local repository and appears in the list immediately.

### View, copy, and edit

- Each card shows the note, the secret text in either masked or revealed form, and the current OTP code.
- Raw secrets are hidden for all cards by default; click **Show Secrets** in the top bar to reveal them, then click **Hide Secrets** to mask them again.
- Click **Copy** to write the current code to the clipboard.
- You can open separate workspaces for **Edit Note** and **Edit Secret**.
- Deletion always shows a confirmation dialog, and canceling leaves the existing data unchanged.

### Ordering

- Pointer drag-and-drop sorting is supported.
- Keyboard sorting is also supported: `Enter` / `Space` picks up a card, `↑` / `↓` moves it, `Enter` confirms, and `Escape` cancels.

### Import and export

- **Import JSON**: reads a local file, validates the schema item by item, and reports added cards, skipped duplicates, and failure reasons.
- **Export JSON**: requires a risk confirmation before export; the generated file is plain JSON and includes the original `rawSecret`.

## Quick Start

### Requirements

- Node.js 22 (the current CI version)
- pnpm 10

### Install dependencies

```bash
pnpm install
```

### Local development

```bash
pnpm dev
```

Please access the app through the Vite development server or preview server instead of opening `index.html` with `file://`. The current entry relies on resource paths such as `/src/main.tsx` and `/favicon.svg` that are served by Vite, so directly opening the local HTML file is not a supported runtime mode for this repo, and browser `localStorage` behavior is also unstable in that scenario.

### Common commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:ui
pnpm preview
```

> [!NOTE]
> `pnpm build` actually runs `tsc -b && vite build`. Type checking covers not only `src`, but also `vite.config.ts` and `playwright.config.ts`.

## Validation Flow

The recommended minimum validation loop is:

```bash
pnpm lint
pnpm test
pnpm build
```

If you need more focused verification, the current repo commonly uses:

```bash
pnpm vitest run src/lib/totp/**/*.test.ts
pnpm vitest run src/lib/storage/**/*.test.ts
pnpm vitest run src/app/App.test.tsx
pnpm vitest run src/features/cards/CardComposer.test.tsx
pnpm vitest run src/features/cards/OtpCard.test.tsx
pnpm vitest run src/features/import-export/**/*.test.tsx
```

### About Playwright

`pnpm test:ui` uses the Playwright config, but it does not run against `pnpm dev`. Instead, it uses:

```bash
pnpm build
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
```

> [!CAUTION]
> The current `e2e/app.smoke.spec.ts` depends on WSL calling Windows Edge over CDP and includes hard-coded `msedge.exe`, PowerShell, and `cmd.exe` paths. It is not a universal cross-platform smoke test, so confirm the environment first before using it for local verification.
>
> In addition, some assertions in this smoke spec still target the old homepage structure and have drifted from the current UI. `pnpm test:ui` is better treated as an environment-constrained reference check rather than the authoritative source of truth for the current page specification.

## Data and Security Notes

### Local storage contract

- `localStorage` key: `mfa-web/cards:v1`
- storage schema version: `1`
- export format: plain JSON
- exported content: includes `rawSecret`, `normalizedSecret`, notes, colors, and timestamps

### Fixed TOTP rules

- algorithm: `SHA-1`
- digits: `6`
- period: `30` seconds

### Security boundary

OTP calculation never uploads to a backend, but that **does not mean secure storage**. Browser environments, other accounts on the same machine, malicious extensions, malware, chat logs, cloud drive history, or shared directories can all expose the secrets contained in local cards and exported files.

If the repo adds a custom domain in the future, it only changes the access entry and deployment path; it does not change the risk boundary of browser `localStorage` or plain-text exports.

## Project Structure

```text
src/
  app/                  app shell, workspace toggles, list state, ordering, and global time/card store
  features/cards/       card composition, rendering, copy, editing, and ordering interactions
  features/import-export/ import/export entry points, confirmation dialog, feedback, and file I/O
  lib/storage/          schema, localStorage repository, and import merge logic
  lib/totp/             Base32 normalization / decoding and TOTP calculation
e2e/                    Playwright smoke spec and helper files
```

## Deployment

The repository is currently deployed with GitHub Pages:

- trigger: pushes to `main` or manual workflow dispatch
- build environment: Node.js 22 + pnpm 10
- install command: `pnpm install --frozen-lockfile`
- build output: `dist`

Vite `base` is not hard-coded. It is decided dynamically based on:

- whether the repository root contains `CNAME`
- whether the build runs inside GitHub Actions
- whether the repository name equals `<owner>.github.io`

That means the README should not treat the deployment path or custom domain as a fixed fact. If the published entry changes, this document should be updated accordingly.

Also, `pnpm preview` is only for checking the build output locally, not a production server.
