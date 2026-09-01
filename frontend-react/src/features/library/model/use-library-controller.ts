import { useCallback, useState } from 'react'

import {
  deleteLibraryBook,
  downloadLibraryResource,
  libraryApiUrl,
  libraryCopy,
  libraryResourceUrl,
} from '../index'
import { filterLibraryBooksByQuery, filterLibraryBooksByStatus, sortLibraryBooks } from '../library-selectors'
import type { LibraryBook, LibrarySortKey, LibraryStatusFilterKey } from '../types'
import { useLibraryData } from './use-library-data'
import { useLibraryFeedback } from './use-library-feedback'

export function useLibraryController() {
  const feedback = useLibraryFeedback()
  const handleLoadError = useCallback((message: string) => {
    feedback.setLoadError(message)
  }, [feedback])
  const libraryData = useLibraryData({ onLoadError: handleLoadError })
  const [detailOpen, setDetailOpen] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const [downloadingBookId, setDownloadingBookId] = useState<string>()
  const [deletingBookId, setDeletingBookId] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilterKey, setStatusFilterKey] = useState<LibraryStatusFilterKey>('all')
  const [sortKey, setSortKey] = useState<LibrarySortKey>('recent')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(() => new Set())
  const visibleBooks = sortLibraryBooks(
    filterLibraryBooksByStatus(filterLibraryBooksByQuery(libraryData.books, searchQuery), statusFilterKey),
    sortKey,
  )

  function selectBook(book: LibraryBook) {
    libraryData.setSelectedBookId(book.id)
    setDetailOpen(true)
    libraryData.loadBookDetail(book.id)
  }

  function openReader(bookOrId: LibraryBook | string) {
    const bookId = typeof bookOrId === 'string' ? bookOrId : bookOrId.id
    libraryData.setSelectedBookId(bookId)
    setReaderOpen(true)
    libraryData.loadBookDetail(bookId)
  }

  function toggleSelectedBook(book: LibraryBook) {
    setSelectedBookIds((current) => {
      const next = new Set(current)

      if (next.has(book.id)) {
        next.delete(book.id)
      } else {
        next.add(book.id)
      }

      return next
    })
  }

  function downloadPdf(bookId: string) {
    const book = libraryData.books.find((item) => item.id === bookId)
    const artifactUrl = book?.detail?.artifacts.find((artifact) => artifact.state === 'ready' && artifact.downloadUrl)?.downloadUrl
    const downloadTarget = artifactUrl ? libraryResourceUrl(artifactUrl) : libraryApiUrl(`jobs/${encodeURIComponent(bookId)}/download`)

    setDownloadingBookId(bookId)
    feedback.setLoadError(undefined)
    feedback.setToastText('正在下载...')
    downloadLibraryResource(downloadTarget, `${book?.title || bookId}.pdf`)
      .then(() => {
        feedback.setToastText('已开始下载')
      })
      .catch((error: unknown) => {
        feedback.setLoadError(error instanceof Error ? error.message : '下载 PDF 失败')
      })
      .finally(() => {
        setDownloadingBookId((current) => current === bookId ? undefined : current)
      })
  }

  function downloadArtifact(artifactKey: string) {
    const book = libraryData.selectedBook
    const artifact = book?.detail?.artifacts.find((item) => item.key === artifactKey)

    if (!artifact?.downloadUrl || !book) {
      return
    }

    const fallbackFileName = artifact.fileName || `${book.id}-${artifact.key}`
    setDownloadingBookId(book.id)
    feedback.setLoadError(undefined)
    feedback.setToastText(`正在下载 ${artifact.label}...`)
    downloadLibraryResource(artifact.downloadUrl, fallbackFileName)
      .then(() => {
        feedback.setToastText(`已开始下载 ${artifact.label}`)
      })
      .catch((error: unknown) => {
        feedback.setLoadError(error instanceof Error ? error.message : '下载文件失败')
      })
      .finally(() => {
        setDownloadingBookId((current) => current === book.id ? undefined : current)
      })
  }

  function deleteBook(bookOrId: LibraryBook | string) {
    const bookId = typeof bookOrId === 'string' ? bookOrId : bookOrId.id

    if (!window.confirm(libraryCopy.detail.deleteConfirm)) {
      return
    }

    setDeletingBookId(bookId)
    feedback.setLoadError(undefined)
    deleteLibraryBook(bookId)
      .then(() => {
        libraryData.removeBookFromLibrary(bookId)
        setDetailOpen(false)
        setReaderOpen(false)
        feedback.setToastText('已删除')
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '删除失败'

        if (message.includes('409') && window.confirm(libraryCopy.detail.forceDeleteConfirm)) {
          return deleteLibraryBook(bookId, { force: true })
            .then(() => {
              libraryData.removeBookFromLibrary(bookId)
              setDetailOpen(false)
              setReaderOpen(false)
              feedback.setToastText('已删除')
            })
            .catch((forceError: unknown) => {
              feedback.setLoadError(forceError instanceof Error ? forceError.message : '强制删除失败')
            })
        }

        feedback.setLoadError(message)
      })
      .finally(() => {
        setDeletingBookId((current) => current === bookId ? undefined : current)
      })
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) {
        setSelectedBookIds(new Set())
      }
      return !current
    })
  }

  function clearSelection() {
    setSelectedBookIds(new Set())
    setSelectionMode(false)
  }

  function deleteSelectedBooks() {
    const ids = Array.from(selectedBookIds)

    if (!ids.length || !window.confirm(libraryCopy.selection.deleteConfirm(ids.length))) {
      return
    }

    setDeletingBookId('batch')
    feedback.setLoadError(undefined)
    Promise.all(ids.map((bookId) => deleteLibraryBook(bookId)))
      .then(() => {
        ids.forEach(libraryData.removeBookFromLibrary)
        setDetailOpen(false)
        setReaderOpen(false)
        setSelectedBookIds(new Set())
        setSelectionMode(false)
        feedback.setToastText('已删除')
      })
      .catch((error: unknown) => {
        feedback.setLoadError(error instanceof Error ? error.message : '批量删除失败')
      })
      .finally(() => {
        setDeletingBookId((current) => current === 'batch' ? undefined : current)
      })
  }

  return {
    books: visibleBooks,
    selectedBook: libraryData.selectedBook,
    selectedBookId: libraryData.selectedBookId,
    searchQuery,
    sortKey,
    statusFilterKey,
    selectionMode,
    selectedBookIds,
    detailOpen,
    readerOpen,
    settingsOpen,
    detailLoadingBookId: libraryData.detailLoadingBookId,
    downloadingBookId,
    deletingBookId,
    loadError: feedback.loadError,
    toastText: feedback.toastText,
    actions: {
      selectBook,
      openReader,
      toggleSelectedBook,
      setSearchQuery,
      setSortKey,
      setStatusFilterKey,
      setSettingsOpen,
      setDetailOpen,
      setReaderOpen,
      toggleSelectionMode,
      clearSelection,
      deleteSelectedBooks,
      downloadPdf,
      downloadArtifact,
      deleteBook,
    },
  }
}
