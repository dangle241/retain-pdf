import { BookOpen, CheckCircle2, CheckSquare2, Clock3, FileUp, History, Layers3, Loader2, Sparkles, Tags } from 'lucide-react'

import type { LibraryBookStatus, LibraryNavKey, LibrarySortItem, LibraryStatusFilterItem } from './types'
import type { LibrarySettingsSectionView } from './components/library-settings-dialog/library-settings-types'

export const libraryStatusMeta = {
  processing: { label: '处理中', icon: Loader2, spinning: true },
  ready: { label: '已完成', icon: CheckCircle2, spinning: false },
  queued: { label: 'queued', icon: Clock3, spinning: false },
} satisfies Record<LibraryBookStatus, { label: string; icon: typeof BookOpen; spinning: boolean }>

export const libraryNavDefinitions = [
  { key: 'all', label: 'All Books', icon: BookOpen },
  { key: 'processing', label: '处理中', icon: Loader2 },
  { key: 'ready', label: '已完成', icon: CheckCircle2 },
  { key: 'queued', label: '队列中', icon: Clock3 },
  { key: 'authors', label: 'Author', icon: Layers3 },
  { key: 'tags', label: '标签', icon: Tags },
] satisfies Array<{ key: LibraryNavKey; label: string; icon: typeof BookOpen }>

export const librarySortItems: LibrarySortItem[] = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'title', label: '标题' },
  { key: 'authors', label: '作者' },
  { key: 'pages', label: '页数' },
]

export const libraryStatusFilterItems: LibraryStatusFilterItem[] = [
  { key: 'all', label: '全部' },
  { key: 'ready', label: '已完成' },
  { key: 'processing', label: '处理中' },
  { key: 'queued', label: '队列中' },
]

export const libraryCopy = {
  topBar: {
appName: 'Library',
    searchPlaceholder: 'Search book title, author, or task',
settingsLabel: 'Settings',
  },
  header: {
title: 'Library',
    searchAction: 'Search Books',
addAction: 'Add PDF',
    summary: (totalBooks: number, activeCount: number) => `${totalBooks} Book · ${activeCount} Processing.`,
  },
  activity: {
    title: 'Recent Activity',
    liveLabel: 'Real-time',
  },
  filter: {
    viewLabel: 'Cover View',
  },
  sidePanel: {
    title: 'Features',
    openLabel: 'Expand Toolbar',
    closeLabel: 'Collapse Toolbar',
    items: [
      { key: 'upload', label: '上传 PDF', description: 'addBook function missing. Implement.', icon: FileUp },
      { key: 'selection', label: 'Multi-select', description: 'Batch management', icon: CheckSquare2 },
      { key: 'recent', label: '最近任务', description: 'View Processing Records', icon: History },
      { key: 'processing', label: '处理中', description: 'View current task', icon: Loader2 },
      { key: 'tools', label: 'Tools', description: 'reserved extension entry', icon: Sparkles },
    ],
  },
  selection: {
    deleteSelected: 'Delete Selected',
    clear: 'Clear Selection',
selectedCount: (count: number) => Selected ${count} books,
deleteConfirm: (count: number) => Are you sure you want to delete the selected ${count} books?,
  },
  empty: {
    title: 'no books yet',
    description: 'Upload here later. PDFor display processed tasks after backend integration.',
  },
  cover: {
    brand: 'RetainPDF',
pageUnit: 'pages',
  },
  detail: {
    tabs: {
overview: 'Details',
translation: 'Translation',
artifacts: 'Files',
progress: 'Progress',
    },
    sections: {
overview: 'Book Details',
      translation: 'Translation task',
      artifacts: 'Artifacts',
      progress: 'Task progress',
    },
    fields: {
pages: 'Pages',
status: 'Status',
updatedAt: 'Updated',
workflow: 'Workflow',
      language: 'language',
      ocrProvider: 'OCR',
translationEngine: 'Translation',
fileSize: 'File size',
createdAt: 'Created',
    },
    actions: {
reader: 'Side-by-side reading',
downloadPdf: 'Download PDF',
downloadingPdf: 'Downloading',
      downloadArtifact: 'Download file',
deleteBook: 'Delete',
      deletingBook: 'Deleting...',
    },
    deleteConfirm: 'Confirm delete this book? Related task records and output files will be removed.',
    forceDeleteConfirm: 'Task still running or queued. Force delete?',
    loading: 'Loading backend details...',
    fallback: {
      description: 'No book description.',
      unknown: 'Unknown',
    },
    artifactState: {
ready: 'Available',
processing: 'Generating',
      queued: 'Provide source text for translation.',
    },
    progressState: {
active: 'Current',
done: 'Done',
selected: 'View',
      pending: 'Wait',
    },
  },
  dialog: {
close: 'Close',
    closeBackdrop: 'Close',
  },
  reader: {
loading: 'Downloading PDF. After completion, start reading...',
    loadingSource: 'Downloading original PDF...',
loadingTranslated: 'Downloading translated PDF...',
ready: 'Side-by-side reading ready',
error: 'Side-by-side reading load failed',
sourcePdf: 'Original PDF',
translatedPdf: 'Translated PDF',
sourceShort: 'Original',
translatedShort: 'Translated',
    sourceEmpty: 'No original available PDF',
    translatedEmpty: 'No translated available PDF',
    downloadSource: 'Download source',
downloadTranslated: 'Download translated',
loadedCount: (count: number) => ${count}/2 PDFs loaded,
  },
  settings: {
title: 'Settings',
    sections: [
      {
        key: 'translation',
title: 'Translation',
        description: 'Configure translation model, concurrency, glossary, and default target language here later.',
items: ['English', 'Translation Model', 'Concurrency', 'Glossary'],
      },
      {
        key: 'ocr',
        title: 'OCR',
        description: 'Configure here later. OCR Service, page range, and recognition strategy.',
items: ['Default OCR service', 'Page range', 'Recognition Strategy', 'Retry on failure'],
      },
      {
        key: 'files',
title: 'Files',
        description: 'Configure download directory, file naming, and artifact retention policy here.',
        items: ['Download directory', 'File naming', 'Keep artifacts', 'Auto Clean'],
      },
      {
        key: 'display',
title: 'Display',
        description: 'Configure bookshelf density, sorting preferences, and display options here.',
        items: ['Bookshelf density', 'Default sort', 'Show progress', 'Interface Language'],
      },
    ] satisfies LibrarySettingsSectionView[],
  },
  devPreview: {
    title: 'Component Preview',
    topBarTitle: 'Top Bar',
    bookCardsTitle: 'Book Cards',
    statusTitle: 'Status Card',
  },
}
