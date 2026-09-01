import type { LibraryActivity, LibraryBook, LibraryBookArtifact } from './types'

const defaultArtifacts: LibraryBookArtifact[] = [
  { key: 'source', label: 'Source PDF', state: 'ready', detail: '保留原始UploadFiles' },
  { key: 'translated', label: 'Translation PDF', state: 'processing', detail: '等待Rendering complete' },
  { key: 'bilingual', label: 'Side-by-side PDF', state: 'queued', detail: 'Rendering后生成' },
]

function buildBookDetail(index: number, pages: number, status: LibraryBook['status']): LibraryBook['detail'] {
  return {
    sourceLanguage: '英文',
    targetLanguage: '中文',
    workflow: pages > 500 ? 'book' : 'paper',
    ocrProvider: pages > 300 ? 'PaddleOCR' : 'MinerU',
    translationEngine: 'DeepSeek',
    fileSize: `${Math.max(8, Math.round(pages * 0.18))} MB`,
    createdAt: index === 0 ? 'Today 00:42' : `${(index % 23) + 1}: ${(index * 11) % 60}`.replace(': ', ':'),
    description: status === 'ready' ? 'CompleteTranslation和Side-by-side PDF 生成, 可进入Side-by-side Reader.' : status === 'processing' ? '正在处理书籍内容, Translation结果会在任务Done后进入书架.' : '任务已加入队列, Waiting for an available execution slot.',
    tags: pages > 800 ? ['长Documents', '图书', 'Side-by-sideTranslation'] : ['PDF', 'Translation'],
    artifacts: defaultArtifacts.map((artifact) => {
      if (status === 'ready') {
        return { ...artifact, state: 'ready', detail: '已生成' }
      }
      if (status === 'processing' && artifact.key === 'source') {
        return { ...artifact, state: 'ready', detail: '已Upload' }
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
    updatedAt: '刚刚',
    progressLabel: 'RenderingPreparing, total 533 pages',
    coverTone: 'dark',
    detail: buildBookDetail(0, 533, 'processing'),
    snapshot: {
      activeStage: 'render',
      selectedStage: 'render',
      elapsedText: '12m 18s',
      stageProgress: {
        ocr: { current: 533, total: 533, text: 'Page 533/533 pages' },
        translate: {
          current: 5216,
          total: 5216,
          text: 'Page 5216/5216 batches',
          substageKey: 'translation_batches',
        },
        render: { current: 0, total: 533, text: 'RenderingPreparing, total 533 pages' },
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
    progressLabel: '已生成Side-by-side PDF',
    coverTone: 'medium',
    detail: buildBookDetail(1, 1464, 'ready'),
    snapshot: {
      activeStage: 'done',
      selectedStage: 'done',
      elapsedText: 'Done',
      pdfReady: true,
      readerReady: true,
      stageProgress: {
        ocr: { current: 1464, total: 1464, text: 'Page 1464/1464 pages' },
        translate: { current: 8820, total: 8820, text: 'Page 8820/8820 batches' },
        render: { current: 1464, total: 1464, text: 'Page 1464/1464 pages' },
      },
    },
  },
  {
    id: 'statistical-learning',
    title: 'The Elements of Statistical Learning',
    authors: 'Hastie, Tibshirani, Friedman',
    pages: 745,
    status: 'queued',
    updatedAt: '队列中',
    progressLabel: 'Waiting for an available execution slot',
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
    ? '已生成Side-by-side PDF'
    : status === 'processing'
      ? `Page ${renderCurrent}/${pages} pages`
      : 'Waiting for an available execution slot'

  return {
    id: `generated-book-${String(index + 1).padStart(3, '0')}`,
    title,
    authors: authors[index % authors.length],
    pages,
    status,
    updatedAt: status === 'ready' ? `${(index % 23) + 1}: ${(index * 7) % 60}`.replace(': ', ':') : status === 'processing' ? 'Processing' : '队列中',
    progressLabel,
    coverTone,
    detail: buildBookDetail(index + seedBooks.length, pages, status),
    snapshot: {
      activeStage: status === 'ready' ? 'done' : status === 'processing' ? 'render' : 'ocr',
      selectedStage: status === 'ready' ? 'done' : status === 'processing' ? 'render' : 'ocr',
      elapsedText: status === 'ready' ? 'Done' : status === 'processing' ? `${(index % 18) + 2}m` : 'Queued',
      pdfReady: status === 'ready',
      readerReady: status === 'ready',
      stageProgress: {
        ocr: status === 'queued' ? { text: 'Waiting to start', indeterminate: true } : { current: pages, total: pages, text: `Page ${pages}/${pages} pages` },
        translate: status === 'queued' ? undefined : { current: translatedBatches, total: translatedBatches, text: `Page ${translatedBatches}/${translatedBatches} batches` },
        render: status === 'ready'
          ? { current: pages, total: pages, text: `Page ${pages}/${pages} pages` }
          : status === 'processing'
            ? { current: renderCurrent, total: pages, text: renderCurrent > 0 ? `Page ${renderCurrent}/${pages} pages` : `RenderingPreparing, total ${pages} pages` }
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
    title: 'RenderingStageStart',
    detail: 'Quantum Chemistry & Spectroscopy 正在PreparingPages叠加.',
    time: '刚刚',
  },
  {
    id: 'activity-ready',
    title: 'PDF Complete',
    detail: 'Molecular Biology of the Cell 已进入Side-by-side Reader.',
    time: '01:12',
  },
  {
    id: 'activity-queued',
    title: '新书加入书架',
    detail: 'The Elements of Statistical Learning 等待处理.',
    time: '00:58',
  },
]





