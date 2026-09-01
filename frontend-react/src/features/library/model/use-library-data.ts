import { useEffect, useRef, useState } from 'react'

import { getLibraryJob, jobDetailToLibraryBook, jobListToLibraryBooks, listLibraryJobs } from '../api'
import { libraryBooks } from '../mock-data'
import type { LibraryBook } from '../types'
import { mockLibraryEnabled, normalizedBookId } from './library-model-utils'

type UseLibraryDataOptions = {
  onLoadError?: (message: string) => void
}

export function useLibraryData({ onLoadError }: UseLibraryDataOptions = {}) {
  const [books, setBooks] = useState<LibraryBook[]>(() => mockLibraryEnabled() ? libraryBooks : [])
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>(() => mockLibraryEnabled() ? libraryBooks[0]?.id : undefined)
  const [detailLoadingBookId, setDetailLoadingBookId] = useState<string>()
  const [loadedDetailBookIds, setLoadedDetailBookIds] = useState<Set<string>>(() => new Set())
  const loadingDetailBookIds = useRef(new Set<string>())
  const selectedBook = books.find((book) => book.id === selectedBookId) ?? books[0]

  useEffect(() => {
    let canceled = false

    listLibraryJobs()
      .then((data) => {
        if (canceled) {
          return
        }

        const nextBooks = jobListToLibraryBooks(data.items)
        setBooks(nextBooks)
        setSelectedBookId((current) => current && nextBooks.some((book) => book.id === current) ? current : nextBooks[0]?.id)
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setBooks(mockLibraryEnabled() ? libraryBooks : [])
          setSelectedBookId(mockLibraryEnabled() ? libraryBooks[0]?.id : undefined)
          onLoadError?.(error instanceof Error ? error.message : '加载图书馆失败')
        }
      })

    return () => {
      canceled = true
    }
  }, [onLoadError])

  function loadBookDetail(bookId: string) {
    if (loadedDetailBookIds.has(bookId) || loadingDetailBookIds.current.has(bookId)) {
      return
    }

    loadingDetailBookIds.current.add(bookId)
    setDetailLoadingBookId(bookId)

    getLibraryJob(bookId)
      .then((detail) => {
        setBooks((currentBooks) => currentBooks.map((book) => (
          book.id === bookId ? jobDetailToLibraryBook(detail, book) : book
        )))
        setLoadedDetailBookIds((current) => new Set(current).add(bookId))
      })
      .finally(() => {
        loadingDetailBookIds.current.delete(bookId)
        setDetailLoadingBookId((current) => current === bookId ? undefined : current)
      })
  }

  function removeBookFromLibrary(bookId: string) {
    const rootBookId = normalizedBookId(bookId)
    setBooks((currentBooks) => {
      const nextBooks = currentBooks.filter((book) => book.id !== rootBookId && book.id !== `${rootBookId}-ocr`)
      setSelectedBookId((current) => current === rootBookId || current === `${rootBookId}-ocr` ? nextBooks[0]?.id : current)
      return nextBooks
    })
    setLoadedDetailBookIds((current) => {
      const next = new Set(current)
      next.delete(rootBookId)
      next.delete(`${rootBookId}-ocr`)
      return next
    })
  }

  return {
    books,
    selectedBook,
    selectedBookId: selectedBook?.id,
    detailLoadingBookId,
    setSelectedBookId,
    loadBookDetail,
    removeBookFromLibrary,
  }
}
