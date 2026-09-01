import { Check, FileSearch, Languages, ScanText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { StageKey, SubstageKey } from './types'

export const statusStages: Array<{ key: StageKey; label: string; icon: LucideIcon }> = [
  { key: 'ocr', label: 'OCR', icon: ScanText },
  { key: 'translate', label: '翻译', icon: Languages },
  { key: 'render', label: '渲染', icon: FileSearch },
  { key: 'done', label: '完成', icon: Check },
]

export const translationSubstages: Array<{ key: SubstageKey; label: string }> = [
  { key: 'translation_batches', label: '翻译批次' },
  { key: 'continuation_review', label: '跨栏/跨页' },
  { key: 'page_policies', label: '页面策略' },
  { key: 'garbled', label: '乱码修复' },
]

export const statusCopy = {
  actions: {
    cancel: '取消',
    home: '主页',
    detail: '详情',
    reader: '对照阅读',
    downloadPdf: '下载 PDF',
  },
  progress: {
    fallback: '处理中',
  },
}
