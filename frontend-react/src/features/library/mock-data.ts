import type { LibraryActivity, LibraryBook, LibraryBookArtifact } from './types'

const defaultArtifacts: LibraryBookArtifact[] = [
  { key: 'source', label: '原始 PDF', state: 'ready', detail: 'Keep original uploaded file' },
  { key: 'translated', label: '译文 PDF', state: 'processing', detail: 'Waiting for rendering to complete' },
  { key: 'bilingual', label: '对照 PDF', state: 'queued', detail: 'generated after rendering' },
]

function buildBookDetail(index: number, pages: number, status: LibraryBook['status']): LibraryBook['detail'] {
  return {
sourceLanguage: 'English',
targetLanguage: 'Chinese',
    workflow: pages > 500 ? 'book' : 'paper',
    ocrProvider: pages > 300 ? 'PaddleOCR' : 'MinerU',
    translationEngine: 'DeepSeek',
    fileSize: `${Math.max(8, Math.round(pages * 0.18))} MB`,
    createdAt: index === 0 ? 'Today 00:42' : `${(index % 23) + 1}: ${(index * 11) % 60}`.replace(': ', ':'),
    description: status === 'ready' ? 'Translation and comparison completed PDF generated, can enter side-by-side reading.' : status === 'processing' ? 'Processing book content. Results to bookshelf after completion.' : 'Task queued. Waiting for available execution slot.',
tags: pages > 800 ? ['Long Document', 'Books', 'Bilingual Translation'] : ['PDF', 'Translation'],
    artifacts: defaultArtifacts.map((artifact) => {
      if (status === 'ready') {
        return { ...artifact, state: 'ready', detail: '已生成' }
      }
      if (status === 'processing' && artifact.key === 'source') {
        return { ...artifact, state: 'ready', detail: 'Uploaded' }
      }
      return artifact
    }),
  }
}

const seedBooks: LibraryBook[] = [
  {
    id: 'quantum-spectroscopy',
    title: 'Quantum Chemistry & Spectroscopy',
    authors: 'Thomas Engel',
    pages: 533,
    status: 'processing',
    updatedAt: 'Just now',
progressLabel: 'Rendering preparation, 533 pages',
    coverTone: 'dark',
    detail: buildBookDetail(0, 533, 'processing'),
    snapshot: {
      activeStage: 'render',
      selectedStage: 'render',
elapsedText: '12min 18s',
      stageProgress: {
        ocr: { current: 533, total: 533, text: '第 533/533 页' },
        translate: {
          current: 5216,
          total: 5216,
text: 'Batch 5216/5216',
          substageKey: 'translation_batches',
        },
        render: { current: 0, total: 533, text: '渲染准备中，共 533 页' },
      },
    },
  },
  {
    id: 'molecular-biology',
    title: 'Molecular Biology of the Cell',
    authors: 'Bruce Alberts',
    pages: 1464,
    status: 'ready',
updatedAt: 'Today 01:12',
    progressLabel: 'Comparison generated PDF',
    coverTone: 'medium',
    detail: buildBookDetail(1, 1464, 'ready'),
    snapshot: {
      activeStage: 'done',
      selectedStage: 'done',
elapsedText: 'Done',
      pdfReady: true,
      readerReady: true,
      stageProgress: {
        ocr: { current: 1464, total: 1464, text: '第 1464/1464 页' },
        translate: { current: 8820, total: 8820, text: '第 8820/8820 批' },
        render: { current: 1464, total: 1464, text: '第 1464/1464 页' },
      },
    },
  },
  {
    id: 'statistical-learning',
    title: 'The Elements of Statistical Learning',
    authors: 'Hastie, Tibshirani, Friedman',
    pages: 745,
    status: 'queued',
    updatedAt: 'Queued',
    progressLabel: 'Waiting for available execution slot',
    coverTone: 'light',
    detail: buildBookDetail(2, 745, 'queued'),
    snapshot: {
      activeStage: 'ocr',
      selectedStage: 'ocr',
elapsedText: 'Queued',
      stageProgress: {
        ocr: { text: 'Waiting to start', indeterminate: true },
      },
    },
  },
]

const titlePrefixes = [
  'Modern',
  'Applied',
  'Advanced',
  'Foundations of',
  'Introduction to',
  'Principles of',
  'Handbook of',
  'Computational',
  'Experimental',
  'Selected Topics in',
]

const titleSubjects = [
  'Quantum Mechanics',
  'Statistical Physics',
  'Organic Chemistry',
  'Machine Learning',
  'Numerical Analysis',
  'Molecular Genetics',
  'Signal Processing',
  'Linear Algebra',
  'Thermodynamics',
  'Scientific Computing',
]

const authors = [
  'A. Chen',
  'M. Anderson',
  'L. Zhang',
  'S. Patel',
  'E. Fischer',
  'K. Tanaka',
  'R. Williams',
  'Y. Nakamura',
  'D. Smith',
  'H. Martin',
]

function buildGeneratedBook(index: number): LibraryBook {
  const title = `${titlePrefixes[index % titlePrefixes.length]} ${titleSubjects[index % titleSubjects.length]}`
  const pages = 180 + ((index * 37) % 1320)
  const status = index % 13 === 0 ? 'queued' : index % 7 === 0 ? 'processing' : 'ready'
  const coverTone = index % 3 === 0 ? 'dark' : index % 3 === 1 ? 'medium' : 'light'
  const translatedBatches = pages * 6
  const renderCurrent = status === 'ready' ? pages : status === 'processing' ? Math.floor(pages * ((index % 9) / 10)) : 0
  const progressLabel = status === 'ready'
    ? 'Comparison generated. PDF'
    : status === 'processing'
? Page ${renderCurrent}/${pages}
: 'Waiting for available execution slot'

  return {
    id: `generated-book-${String(index + 1).padStart(3, '0')}`,
    title,
    authors: authors[index % authors.length],
    pages,
    status,
updatedAt: status === 'ready' ? ${(index % 23) + 1}: ${(index * 7) % 60}.replace(': ', ':') : status === 'processing' ? 'Processing' : 'Queued',
    progressLabel,
    coverTone,
    detail: buildBookDetail(index + seedBooks.length, pages, status),
    snapshot: {
      activeStage: status === 'ready' ? 'done' : status === 'processing' ? 'render' : 'ocr',
      selectedStage: status === 'ready' ? 'done' : status === 'processing' ? 'render' : 'ocr',
elapsedText: status === 'ready' ? 'Done' : status === 'processing' ? ${(index % 18) + 2}min : 'Queued',
      pdfReady: status === 'ready',
      readerReady: status === 'ready',
      stageProgress: {
        ocr: status === 'queued' ? { text: '等待开始', indeterminate: true } : { current: pages, total: pages, text: `第 ${pages}/${pages} 页` },
translate: status === 'queued' ? undefined : { current: translatedBatches, total: translatedBatches, text: Batch ${translatedBatches}/${translatedBatches} },
        render: status === 'ready'
? { current: pages, total: pages, text: Page ${pages}/${pages} }
          : status === 'processing'
? { current: renderCurrent, total: pages, text: renderCurrent > 0 ? Page ${renderCurrent}/${pages} : Rendering preparation, ${pages} pages }
            : undefined,
      },
    },
  }
}

const generatedBooks = Array.from({ length: 500 - seedBooks.length }, (_, index) => buildGeneratedBook(index))

export const libraryBooks: LibraryBook[] = [...seedBooks, ...generatedBooks]

export const libraryActivities: LibraryActivity[] = [
  {
    id: 'activity-render',
    title: 'render stage started',
    detail: 'Quantum Chemistry & Spectroscopy Preparing page overlay.',
time: 'Just now',
  },
  {
    id: 'activity-ready',
title: 'PDF completed',
    detail: 'Molecular Biology of the Cell Entered comparative reading.',
    time: '01:12',
  },
  {
    id: 'activity-queued',
    title: 'Add to Bookshelf',
    detail: 'The Elements of Statistical Learning Pending.',
    time: '00:58',
  },
]
