import { useRef, useState, type ChangeEvent } from 'react'
import type { LucideIcon } from 'lucide-react'

import type { CardRecord } from '../../lib/storage'
import type { CardRepository } from '../../lib/storage/repository'
import { appCardRepository } from '../cards'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ImportExportFeedbackPanel, type ImportExportFeedback } from './ImportExportFeedback'
import {
  createExportFileName,
  downloadTextFile,
  importCardsFromJson,
  readFileText,
  stringifyExportPayload,
  type ImportCardsSummary,
  type TextDownloadOptions,
} from './io'

export interface ImportExportPanelProps {
  cards: CardRecord[]
  repository?: CardRepository
  onCollectionChanged?: () => void
  downloadFile?: (options: TextDownloadOptions) => void
  readSelectedFile?: (file: File) => Promise<string>
  compact?: boolean
  toolbar?: boolean
  showClearButton?: boolean
  importIcon?: LucideIcon
  exportIcon?: LucideIcon
  clearIcon?: LucideIcon
}

type ConfirmAction = 'export' | 'clear' | null

export function ImportExportPanel({
  cards,
  repository = appCardRepository,
  onCollectionChanged,
  downloadFile = downloadTextFile,
  readSelectedFile = readFileText,
  compact = false,
  toolbar = false,
  showClearButton = true,
  importIcon: ImportIcon,
  exportIcon: ExportIcon,
  clearIcon: ClearIcon,
}: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [feedback, setFeedback] = useState<ImportExportFeedback | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const fileText = await readSelectedFile(file)
      const importResult = importCardsFromJson(fileText, repository)

      if (!importResult.ok) {
        setFeedback({
          kind: 'message',
          tone: 'danger',
          title: '导入失败',
          description: importResult.error.message,
        })
        return
      }

      if (importResult.value.importedCount > 0 || importResult.value.skippedDuplicates > 0) {
        onCollectionChanged?.()
      }

      setFeedback({
        kind: 'summary',
        tone: resolveImportTone(importResult.value),
        title: `已处理文件：${file.name}`,
        description: '结果会区分新增、重复跳过和字段失败；非法条目不会落入本地仓储。',
        summary: importResult.value,
      })
    } catch (error) {
      setFeedback({
        kind: 'message',
        tone: 'danger',
        title: '导入失败',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      event.target.value = ''
    }
  }

  const handleConfirmExport = () => {
    const exportResult = repository.exportCards()

    setConfirmAction(null)

    if (!exportResult.ok) {
      setFeedback({
        kind: 'message',
        tone: 'danger',
        title: '导出失败',
        description: exportResult.error.message,
      })
      return
    }

    try {
      downloadFile({
        content: stringifyExportPayload(exportResult.value),
        fileName: createExportFileName(exportResult.value.exportedAt),
        mimeType: 'application/json',
      })
    } catch (error) {
      setFeedback({
        kind: 'message',
        tone: 'danger',
        title: '导出失败',
        description: error instanceof Error ? error.message : String(error),
      })
      return
    }

    setFeedback({
      kind: 'message',
      tone: 'success',
      title: '导出完成',
      description: `已生成 schema v1 JSON，包含 ${exportResult.value.cards.length} 张卡片的原始 rawSecret 文本。`,
    })
  }

  const handleConfirmClear = () => {
    const clearResult = repository.clear()

    setConfirmAction(null)

    if (!clearResult.ok) {
      setFeedback({
        kind: 'message',
        tone: 'danger',
        title: '清空失败',
        description: clearResult.error.message,
      })
      return
    }

    onCollectionChanged?.()
    setFeedback({
      kind: 'message',
      tone: 'success',
      title: '已清空全部卡片',
      description: '当前浏览器中的本地卡片记录已移除；若误操作，需要重新手动导入或录入。',
    })
  }

  return (
    <>
      {!compact ? (
        <div className="section-heading section-heading--compact">
          <span className="section-tag section-tag--muted">导入 / 导出</span>
          <h2 id="import-export-title">明文 JSON 只在确认后流动</h2>
          <p>
            导出会先二次确认“文件为明文，包含密钥”；导入会逐条复用 schema v1 校验，并明确反馈新增、跳过与失败原因。
          </p>
        </div>
      ) : null}

      <div
        aria-label={compact ? (toolbar ? '页面导入导出操作' : '卡片数据操作') : undefined}
        className={`io-actions${compact ? ' io-actions--compact' : ''}${toolbar ? ' io-actions--toolbar' : ''}`}
        role={compact ? 'group' : undefined}
      >
        <button data-testid="import-button" type="button" onClick={() => fileInputRef.current?.click()}>
          {ImportIcon ? <ImportIcon aria-hidden="true" size={16} strokeWidth={2.1} /> : null}
          <span>导入 JSON</span>
        </button>
        <button
          data-testid="export-button"
          disabled={cards.length === 0}
          type="button"
          onClick={() => {
            setConfirmAction('export')
          }}
        >
          {ExportIcon ? <ExportIcon aria-hidden="true" size={16} strokeWidth={2.1} /> : null}
          <span>导出 JSON</span>
        </button>
        {showClearButton ? (
          <button
            data-testid="clear-cards-button"
            disabled={cards.length === 0}
            type="button"
            onClick={() => {
              setConfirmAction('clear')
            }}
          >
            {ClearIcon ? <ClearIcon aria-hidden="true" size={16} strokeWidth={2.1} /> : null}
            <span>清空全部</span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        accept="application/json,.json"
        className="io-file-input"
        data-testid="import-file-input"
        type="file"
        onChange={(event) => {
          void handleFileChange(event)
        }}
      />

      {!compact ? (
        <div className="io-risk-strip" data-testid="storage-risk-strip">
          <strong>本地处理 ≠ 安全存储</strong>
          <p>验证码计算不会上传，但 localStorage 与导出文件都可能被同机其他人或恶意程序读取。</p>
        </div>
      ) : null}

      {feedback ? <ImportExportFeedbackPanel feedback={feedback} floating={toolbar} /> : null}

      {confirmAction === 'export' ? (
        <ConfirmationDialog
          confirmLabel="确认导出明文 JSON"
          confirmTestId="confirm-export-button"
          description="导出的文件为明文，包含密钥与原始 rawSecret 文本；请仅保存在受信任设备，避免进入聊天记录、网盘历史或共享目录。"
          title="确认导出包含密钥的文件？"
          onCancel={() => {
            setConfirmAction(null)
          }}
          onConfirm={handleConfirmExport}
        />
      ) : null}

      {confirmAction === 'clear' ? (
        <ConfirmationDialog
          confirmLabel="确认清空全部卡片"
          confirmTestId="confirm-clear-button"
          description="该操作会删除当前浏览器中的全部本地卡片记录，取消前数据不会变化。"
          title="确认清空全部卡片？"
          onCancel={() => {
            setConfirmAction(null)
          }}
          onConfirm={handleConfirmClear}
        />
      ) : null}
    </>
  )
}

function resolveImportTone(summary: ImportCardsSummary): 'success' | 'warning' | 'danger' {
  if (summary.failedCount > 0 && summary.importedCount === 0 && summary.skippedDuplicates === 0) {
    return 'danger'
  }

  if (summary.failedCount > 0 || summary.skippedDuplicates > 0) {
    return 'warning'
  }

  return 'success'
}
