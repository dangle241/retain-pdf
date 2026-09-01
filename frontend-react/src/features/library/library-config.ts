import { BookOpen, CheckCircle2, CheckSquare2, Clock3, FileUp, History, Layers3, Loader2, Sparkles, Tags } from 'lucide-react'

import type { LibraryBookStatus, LibraryNavKey, LibrarySortItem, LibraryStatusFilterItem } from './types'
import type { LibrarySettingsSectionView } from './components/library-settings-dialog/library-settings-types'

export const libraryStatusMeta = {
  processing: { label: 'Processing', icon: Loader2, spinning: true },
  ready: { label: 'Complete', icon: CheckCircle2, spinning: false },
  queued: { label: 'Queued', icon: Clock3, spinning: false },
} satisfies Record<LibraryBookStatus, { label: string; icon: typeof BookOpen; spinning: boolean }>

export const libraryNavDefinitions = [
  { key: 'all', label: 'All Books', icon: BookOpen },
  { key: 'processing', label: 'Processing', icon: Loader2 },
  { key: 'ready', label: 'Complete', icon: CheckCircle2 },
  { key: 'queued', label: 'Queued', icon: Clock3 },
  { key: 'authors', label: 'Authors', icon: Layers3 },
  { key: 'tags', label: 'Tags', icon: Tags },
] satisfies Array<{ key: LibraryNavKey; label: string; icon: typeof BookOpen }>

export const librarySortItems: LibrarySortItem[] = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'pages', label: 'Pages' },
]

export const libraryStatusFilterItems: LibraryStatusFilterItem[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Complete' },
  { key: 'processing', label: 'Processing' },
  { key: 'queued', label: 'Queued' },
]

export const libraryCopy = {
  topBar: {
    appName: 'Library',
    searchPlaceholder: 'Search title, author, or job',
    settingsLabel: 'Settings',
  },
  header: {
    title: 'Library',
    searchAction: 'Search Books',
    addAction: 'Add PDF',
    summary: (totalBooks: number, activeCount: number) => `${totalBooks} books · ${activeCount} processing`,
  },
  activity: {
    title: 'Recent Activity',
    liveLabel: 'Live',
  },
  filter: {
    viewLabel: 'Cover View',
  },
  sidePanel: {
    title: 'Tools',
    openLabel: 'Expand Tools',
    closeLabel: 'Collapse Tools',
    items: [
      { key: 'upload', label: 'Upload PDF', description: 'Add a new book', icon: FileUp },
      { key: 'selection', label: 'Select', description: 'Batch manage', icon: CheckSquare2 },
      { key: 'recent', label: 'Recent Jobs', description: 'View processing history', icon: History },
      { key: 'processing', label: 'Processing', description: 'View active jobs', icon: Loader2 },
      { key: 'tools', label: 'Tools', description: 'Reserved extension entry', icon: Sparkles },
    ],
  },
  selection: {
    deleteSelected: 'Delete Selected',
    clear: 'Clear Selection',
    selectedCount: (count: number) => `${count} selected`,
    deleteConfirm: (count: number) => `Delete the selected ${count} books?`,
  },
  empty: {
    title: 'No Books Yet',
    description: 'Upload PDFs here later, or show processed jobs once the backend is connected.',
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
      translation: 'Translation Job',
      artifacts: 'File Artifacts',
      progress: 'Job Progress',
    },
    fields: {
      pages: 'Pages',
      status: 'Status',
      updatedAt: 'Updated',
      workflow: 'Workflow',
      language: 'Language',
      ocrProvider: 'OCR',
      translationEngine: 'Translation',
      fileSize: 'File',
      createdAt: 'Created',
    },
    actions: {
      reader: 'Side-by-side Reader',
      downloadPdf: 'Download PDF',
      downloadingPdf: 'Downloading',
      downloadArtifact: 'Download File',
      deleteBook: 'Delete',
      deletingBook: 'Deleting',
    },
    deleteConfirm: 'Delete this book? Related job records and artifacts will be removed.',
    forceDeleteConfirm: 'The job is still running or queued. Force delete it?',
    loading: 'Loading backend details...',
    fallback: {
      description: 'No book description yet',
      unknown: 'Unknown',
    },
    artifactState: {
      ready: 'Ready',
      processing: 'Generating',
      queued: 'Waiting',
    },
    progressState: {
      active: 'Current',
      done: 'Done',
      selected: 'View',
      pending: 'Waiting',
    },
  },
  dialog: {
    close: 'Close',
    closeBackdrop: 'Close dialog',
  },
  reader: {
    loading: 'Downloading PDFs. Reading starts when they are ready...',
    loadingSource: 'Downloading source PDF...',
    loadingTranslated: 'Downloading translated PDF...',
    ready: 'Side-by-side reader is ready',
    error: 'Side-by-side reader failed to load',
    sourcePdf: 'Source PDF',
    translatedPdf: 'Translated PDF',
    sourceShort: 'Source',
    translatedShort: 'Translation',
    sourceEmpty: 'No source PDF available',
    translatedEmpty: 'No translated PDF available',
    downloadSource: 'Download Source',
    downloadTranslated: 'Download Translation',
    loadedCount: (count: number) => `${count}/2 PDFs loaded`,
  },
  settings: {
    title: 'Settings',
    sections: [
      {
        key: 'translation',
        title: 'Translation',
        description: 'Configure translation models, concurrency, glossaries, and the default target language here later.',
        items: ['Default target language', 'Translation model', 'Concurrency', 'Glossary'],
      },
      {
        key: 'ocr',
        title: 'OCR',
        description: 'Configure OCR services, page ranges, and recognition strategy here later.',
        items: ['Default OCR service', 'Page range', 'Recognition strategy', 'Failure retry'],
      },
      {
        key: 'files',
        title: 'Files',
        description: 'Configure download folders, file naming, and artifact retention here later.',
        items: ['Download folder', 'File naming', 'Artifact retention', 'Auto cleanup'],
      },
      {
        key: 'display',
        title: 'Display',
        description: 'Configure shelf density, sort preference, and display options here later.',
        items: ['Shelf density', 'Default sort', 'Show progress', 'Interface language'],
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

