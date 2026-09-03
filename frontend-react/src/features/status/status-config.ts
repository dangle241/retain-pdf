import { Check, FileSearch, Languages, ScanText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { StageKey, SubstageKey } from './types'

export const statusStages: Array<{ key: StageKey; label: string; icon: LucideIcon }> = [
  { key: 'ocr', label: 'OCR', icon: ScanText },
  { key: 'translate', label: 'Translate', icon: Languages },
  { key: 'render', label: 'Render', icon: FileSearch },
  { key: 'done', label: 'Done', icon: Check },
]

export const translationSubstages: Array<{ key: SubstageKey; label: string }> = [
  { key: 'translation_batches', label: 'Translation Batches' },
  { key: 'continuation_review', label: 'Cross-column / Cross-page' },
  { key: 'page_policies', label: 'Page Policies' },
  { key: 'garbled', label: 'Garbled Text Repair' },
]

export const statusCopy = {
  actions: {
    cancel: 'Cancel',
    home: 'Home',
    detail: 'Details',
    reader: 'Side-by-side Reader',
    downloadPdf: 'Download PDF',
  },
  progress: {
    fallback: 'Processing',
  },
}
