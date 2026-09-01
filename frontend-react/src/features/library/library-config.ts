import { BookOpen, CheckCircle2, CheckSquare2, Clock3, FileUp, History, Layers3, Loader2, Sparkles, Tags } from 'lucide-react'

import type { LibraryBookStatus, LibraryNavKey, LibrarySortItem, LibraryStatusFilterItem } from './types'
import type { LibrarySettingsSectionView } from './components/library-settings-dialog/library-settings-types'

export const libraryStatusMeta = {
  processing: { label: '处理中', icon: Loader2, spinning: true },
  ready: { label: '已完成', icon: CheckCircle2, spinning: false },
  queued: { label: '队列中', icon: Clock3, spinning: false },
} satisfies Record<LibraryBookStatus, { label: string; icon: typeof BookOpen; spinning: boolean }>

export const libraryNavDefinitions = [
  { key: 'all', label: '全部书籍', icon: BookOpen },
  { key: 'processing', label: '处理中', icon: Loader2 },
  { key: 'ready', label: '已完成', icon: CheckCircle2 },
  { key: 'queued', label: '队列中', icon: Clock3 },
  { key: 'authors', label: '作者', icon: Layers3 },
  { key: 'tags', label: '标签', icon: Tags },
] satisfies Array<{ key: LibraryNavKey; label: string; icon: typeof BookOpen }>

export const librarySortItems: LibrarySortItem[] = [
  { key: 'recent', label: '最近添加' },
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
    appName: '图书馆',
    searchPlaceholder: '搜索书名、作者或任务',
    settingsLabel: '设置',
  },
  header: {
    title: '图书馆',
    searchAction: '搜索书籍',
    addAction: '添加 PDF',
    summary: (totalBooks: number, activeCount: number) => `${totalBooks} 本书 · ${activeCount} 本正在处理`,
  },
  activity: {
    title: '最近动态',
    liveLabel: '实时',
  },
  filter: {
    viewLabel: '封面视图',
  },
  sidePanel: {
    title: '功能',
    openLabel: '展开功能栏',
    closeLabel: '收起功能栏',
    items: [
      { key: 'upload', label: '上传 PDF', description: '添加新书', icon: FileUp },
      { key: 'selection', label: '多选', description: '批量管理', icon: CheckSquare2 },
      { key: 'recent', label: '最近任务', description: '查看处理记录', icon: History },
      { key: 'processing', label: '处理中', description: '查看当前任务', icon: Loader2 },
      { key: 'tools', label: '工具', description: '预留扩展入口', icon: Sparkles },
    ],
  },
  selection: {
    deleteSelected: '删除所选',
    clear: '清除选择',
    selectedCount: (count: number) => `已选择 ${count} 本`,
    deleteConfirm: (count: number) => `确定删除选中的 ${count} 本书吗？`,
  },
  empty: {
    title: '还没有书籍',
    description: '后续可以从这里上传 PDF，或在接入后端后显示已处理的任务。',
  },
  cover: {
    brand: 'RetainPDF',
    pageUnit: '页',
  },
  detail: {
    tabs: {
      overview: '详情',
      translation: '翻译',
      artifacts: '文件',
      progress: '进度',
    },
    sections: {
      overview: '书籍详情',
      translation: '翻译任务',
      artifacts: '文件产物',
      progress: '任务进度',
    },
    fields: {
      pages: '页数',
      status: '状态',
      updatedAt: '更新',
      workflow: '流程',
      language: '语言',
      ocrProvider: 'OCR',
      translationEngine: '翻译',
      fileSize: '文件',
      createdAt: '创建',
    },
    actions: {
      reader: '对照阅读',
      downloadPdf: '下载 PDF',
      downloadingPdf: '下载中',
      downloadArtifact: '下载文件',
      deleteBook: '删除',
      deletingBook: '删除中',
    },
    deleteConfirm: '确定删除这本书吗？相关任务记录和产物文件会被移除。',
    forceDeleteConfirm: '任务仍在运行或排队。是否强制删除？',
    loading: '正在读取后端详情...',
    fallback: {
      description: '暂无书籍简介',
      unknown: '未知',
    },
    artifactState: {
      ready: '可用',
      processing: '生成中',
      queued: '等待中',
    },
    progressState: {
      active: '当前',
      done: '完成',
      selected: '查看',
      pending: '等待',
    },
  },
  dialog: {
    close: '关闭',
    closeBackdrop: '关闭弹窗',
  },
  reader: {
    loading: '正在下载 PDF，完成后开始阅读...',
    loadingSource: '正在下载原始 PDF...',
    loadingTranslated: '正在下载译文 PDF...',
    ready: '对照阅读已就绪',
    error: '对照阅读加载失败',
    sourcePdf: '原始 PDF',
    translatedPdf: '译文 PDF',
    sourceShort: '原文',
    translatedShort: '译文',
    sourceEmpty: '没有可用的原始 PDF',
    translatedEmpty: '没有可用的译文 PDF',
    downloadSource: '下载原文',
    downloadTranslated: '下载译文',
    loadedCount: (count: number) => `${count}/2 个 PDF 已加载`,
  },
  settings: {
    title: '设置',
    sections: [
      {
        key: 'translation',
        title: '翻译',
        description: '后续在这里配置翻译模型、并发、术语表和默认目标语言。',
        items: ['默认目标语言', '翻译模型', '并发数量', '术语表'],
      },
      {
        key: 'ocr',
        title: 'OCR',
        description: '后续在这里配置 OCR 服务、页数范围和识别策略。',
        items: ['默认 OCR 服务', '页数范围', '识别策略', '失败重试'],
      },
      {
        key: 'files',
        title: '文件',
        description: '后续在这里配置下载目录、文件命名和产物保留策略。',
        items: ['下载目录', '文件命名', '产物保留', '自动清理'],
      },
      {
        key: 'display',
        title: '显示',
        description: '后续在这里配置书架密度、排序偏好和界面显示选项。',
        items: ['书架密度', '默认排序', '显示进度', '界面语言'],
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
