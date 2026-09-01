import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

import { Button, Dialog } from '@/components/ui'

import { libraryCopy } from '../../library-config'
import { downloadLibraryResource } from '../../api'
import { loadPdfDocument } from './book-reader-pdf-document'
import { BookReaderPdfPagePair } from './book-reader-pdf-page-pair'
import { sourcePdfUrl, translatedPdfUrl } from './book-reader-selectors'
import type { BookReaderBook, ReaderPdfState } from './book-reader-types'
import type { pdfjs } from './book-reader-pdfjs'

const ESTIMATED_PAGE_PAIR_HEIGHT = 720

type BookReaderDialogProps = {
  book?: BookReaderBook
  open: boolean
  onClose: () => void
}

export function BookReaderDialog({ book, open, onClose }: BookReaderDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLoadKeyRef = useRef('')
  const [state, setState] = useState<ReaderPdfState>({ loading: false, loadedCount: 0 })
  const [sourceDocument, setSourceDocument] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [translatedDocument, setTranslatedDocument] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [sourceError, setSourceError] = useState('')
  const [translatedError, setTranslatedError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const bookId = book?.id

    if (!open || !bookId) {
      activeLoadKeyRef.current = ''
      return
    }

    const loadKey = `${bookId}:full-pdf`

    if (activeLoadKeyRef.current === loadKey) {
      return
    }

    activeLoadKeyRef.current = loadKey
    let canceled = false
    const readerBook = { id: bookId }
    const sourcePath = sourcePdfUrl(readerBook)
    const translatedPath = translatedPdfUrl(readerBook)

    queueMicrotask(() => {
      if (canceled) {
        return
      }

      setState({ loading: true, loadedCount: 0 })
      setSourceDocument(null)
      setTranslatedDocument(null)
      setSourceError('')
      setTranslatedError('')
      setPageCount(0)
      setScrollTop(0)
    })

    const sourceLoad = loadPdfDocument(sourcePath, 'source', {
      onProgress: (progress) => {
        if (canceled) {
          return
        }

        setState((current) => ({
          ...current,
          sourceStatus: describeLoadProgress('原文', progress.phase, progress.bytes, progress.message),
        }))
      },
    })
    const translatedLoad = loadPdfDocument(translatedPath, 'translated', {
      onProgress: (progress) => {
        if (canceled) {
          return
        }

        setState((current) => ({
          ...current,
          translatedStatus: describeLoadProgress('译文', progress.phase, progress.bytes, progress.message),
        }))
      },
    })

    Promise.allSettled([sourceLoad.promise, translatedLoad.promise])
      .then(([sourceResult, translatedResult]) => {
        if (canceled) {
          if (sourceResult.status === 'fulfilled') {
            sourceResult.value.destroy()
          }
          if (translatedResult.status === 'fulfilled') {
            translatedResult.value.destroy()
          }
          return
        }

        const nextSourceDocument = sourceResult.status === 'fulfilled' ? sourceResult.value : null
        const nextTranslatedDocument = translatedResult.status === 'fulfilled' ? translatedResult.value : null
        const loadedCount = Number(Boolean(nextSourceDocument)) + Number(Boolean(nextTranslatedDocument))

        if (nextSourceDocument) {
          setSourceDocument(nextSourceDocument)
        } else {
          setSourceError(libraryCopy.reader.error)
        }

        if (nextTranslatedDocument) {
          setTranslatedDocument(nextTranslatedDocument)
        } else {
          setTranslatedError(libraryCopy.reader.error)
        }

        setPageCount(Math.max(nextSourceDocument?.numPages ?? 0, nextTranslatedDocument?.numPages ?? 0))
        setState({
          loading: false,
          loadedCount,
          sourceStatus: sourceResult.status === 'fulfilled' ? '原文 PDF 已就绪' : '原文 PDF 加载失败',
          translatedStatus: translatedResult.status === 'fulfilled' ? '译文 PDF 已就绪' : '译文 PDF 加载失败',
          error: loadedCount === 2 ? undefined : libraryCopy.reader.error,
        })
      })

    return () => {
      canceled = true
      sourceLoad.cancel()
      translatedLoad.cancel()
    }
  }, [book?.id, open])

  useEffect(() => {
    return () => {
      sourceDocument?.destroy()
    }
  }, [sourceDocument])

  useEffect(() => {
    return () => {
      translatedDocument?.destroy()
    }
  }, [translatedDocument])

  if (!book) {
    return null
  }

  const sourcePath = sourcePdfUrl(book)
  const translatedPath = translatedPdfUrl(book)
  const readerReady = Boolean(sourceDocument && translatedDocument)
  const effectivePageCount = readerReady ? pageCount || book.pages || 0 : 0
  const pages = readerReady && effectivePageCount ? Array.from({ length: effectivePageCount }, (_, index) => index + 1) : []
  const currentPage = effectivePageCount ? Math.max(1, Math.min(effectivePageCount, Math.floor(scrollTop / ESTIMATED_PAGE_PAIR_HEIGHT) + 1)) : 1
  const loadingText = state.error || sourceError || translatedError || (
    state.loading || state.loadedCount < 2
      ? `${libraryCopy.reader.loading} ${libraryCopy.reader.loadedCount(state.loadedCount)}${formatReaderStatusLines(state)}`
      : libraryCopy.reader.error
  )

  function handleScroll() {
    const scrollEl = scrollRef.current

    if (!scrollEl) {
      return
    }

    setScrollTop(scrollEl.scrollTop)
  }

  return (
    <Dialog
      open={open}
      title={book.title}
      closeLabel={libraryCopy.dialog.close}
      backdropCloseLabel={libraryCopy.dialog.closeBackdrop}
      hideHeader
      className="h-[calc(100vh-8px)] max-h-[calc(100vh-8px)] max-w-[calc(100vw-8px)] rounded-xl"
      contentClassName="h-full"
      onClose={onClose}
    >
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
        <div ref={scrollRef} className="scrollbar-subtle min-h-0 overflow-auto border border-neutral-200 bg-neutral-100" onScroll={handleScroll}>
          <div className="min-h-full">
            {pages.length ? (
              pages.map((pageNumber) => (
                <BookReaderPdfPagePair
                  key={pageNumber}
                  sourceDocument={sourceDocument}
                  sourceError={sourceError}
                  sourceLoading={state.loading && !sourceDocument}
                  translatedDocument={translatedDocument}
                  translatedError={translatedError}
                  translatedLoading={state.loading && !translatedDocument}
                  pageNumber={pageNumber}
                />
              ))
            ) : (
              <div className="grid min-h-[560px] place-items-center whitespace-pre-line text-center text-sm leading-7 text-neutral-500">
                {loadingText}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-x border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void downloadLibraryResource(sourcePath, `${book.id}-source.pdf`)}>
              <Download />
              {libraryCopy.reader.downloadSource}
            </Button>
          </div>
          <div className="min-w-20 text-center text-xs text-neutral-500">
            {currentPage} / {effectivePageCount || '-'}
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void downloadLibraryResource(translatedPath, `${book.id}-translated.pdf`)}>
              <Download />
              {libraryCopy.reader.downloadTranslated}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function formatBytes(value?: number) {
  if (!value) {
    return ''
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function describeLoadProgress(label: string, phase: 'downloading' | 'parsing' | 'ready' | 'failed', bytes?: number, message?: string) {
  if (phase === 'downloading') {
    return `${label} PDF 正在下载`
  }

  if (phase === 'parsing') {
    return `${label} PDF 已下载${formatBytes(bytes) ? ` ${formatBytes(bytes)}` : ''}，正在解析`
  }

  if (phase === 'ready') {
    return `${label} PDF 已就绪`
  }

  return `${label} PDF 加载失败${message ? `：${message}` : ''}`
}

function formatReaderStatusLines(state: ReaderPdfState) {
  const lines = [state.sourceStatus, state.translatedStatus].filter(Boolean)

  return lines.length ? `\n${lines.join('\n')}` : ''
}
