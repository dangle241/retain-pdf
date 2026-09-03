import { useEffect, useRef, useState } from 'react'

import { BookReaderPdfPage } from './book-reader-pdf-page'
import type { pdfjs } from './book-reader-pdfjs'

type BookReaderPdfPagePairProps = {
  sourceDocument?: pdfjs.PDFDocumentProxy | null
  sourceError?: string
  sourceLoading?: boolean
  translatedDocument?: pdfjs.PDFDocumentProxy | null
  translatedError?: string
  translatedLoading?: boolean
  pageNumber: number
}

export function BookReaderPdfPagePair({
  sourceDocument,
  sourceError,
  sourceLoading = false,
  translatedDocument,
  translatedError,
  translatedLoading = false,
  pageNumber,
}: BookReaderPdfPagePairProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const sourceCellRef = useRef<HTMLDivElement>(null)
  const translatedCellRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [sourceWidth, setSourceWidth] = useState(320)
  const [translatedWidth, setTranslatedWidth] = useState(320)

  useEffect(() => {
    const row = rowRef.current

    if (!row) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px 0px' },
    )

    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sourceCell = sourceCellRef.current
    const translatedCell = translatedCellRef.current

    if (!sourceCell || !translatedCell) {
      return
    }

    function updateWidths() {
      const nextSourceWidth = Math.max(120, sourceCell?.clientWidth || 0)
      const nextTranslatedWidth = Math.max(120, translatedCell?.clientWidth || 0)

      setSourceWidth((current) => Math.abs(current - nextSourceWidth) > 8 ? nextSourceWidth : current)
      setTranslatedWidth((current) => Math.abs(current - nextTranslatedWidth) > 8 ? nextTranslatedWidth : current)
    }

    updateWidths()
    const observer = new ResizeObserver(updateWidths)
    observer.observe(sourceCell)
    observer.observe(translatedCell)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rowRef} className="grid grid-cols-2 items-start border-b border-neutral-200 last:border-b-0">
      <div ref={sourceCellRef} className="min-w-0 bg-neutral-100">
        {visible ? (
          <BookReaderPdfPage document={sourceDocument} pageNumber={pageNumber} availableWidth={sourceWidth} />
        ) : (
          <div className="grid min-h-[720px] place-items-center text-xs text-neutral-500">
            {sourceError || (sourceLoading ? 'DownloadingSource PDF...' : '')}
          </div>
        )}
      </div>
      <div ref={translatedCellRef} className="min-w-0 bg-neutral-100">
        {visible ? (
          <BookReaderPdfPage document={translatedDocument} pageNumber={pageNumber} availableWidth={translatedWidth} />
        ) : (
          <div className="grid min-h-[720px] place-items-center text-xs text-neutral-500">
            {translatedError || (translatedLoading ? 'DownloadingTranslation PDF...' : '')}
          </div>
        )}
      </div>
    </div>
  )
}

