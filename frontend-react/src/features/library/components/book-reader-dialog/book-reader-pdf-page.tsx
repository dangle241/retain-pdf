import { useEffect, useRef, useState } from 'react'

import { pdfjs } from './book-reader-pdfjs'

type BookReaderPdfPageProps = {
  document?: pdfjs.PDFDocumentProxy | null
  pageNumber: number
  availableWidth: number
}

export function BookReaderPdfPage({ document, pageNumber, availableWidth }: BookReaderPdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !document) {
      return
    }

    let canceled = false

    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    queueMicrotask(() => {
      if (!canceled) {
        setRendered(false)
      }
    })

    document.getPage(pageNumber)
      .then((pdfPage) => {
        if (canceled) {
          return null
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 })
        const scale = Math.max(0.2, Math.max(120, availableWidth - 1) / baseViewport.width)
        const viewport = pdfPage.getViewport({ scale })
        const outputScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5))
        const context = canvas.getContext('2d')

        if (!context) {
          return null
        }

        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0)

        const renderTask = pdfPage.render({ canvas, canvasContext: context, viewport })
        renderTaskRef.current = renderTask
        return renderTask.promise
      })
      .then(() => {
        if (!canceled) {
          renderTaskRef.current = null
          setRendered(true)
        }
      })
      .catch((error: unknown) => {
        if (!canceled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          renderTaskRef.current = null
        }
      })

    return () => {
      canceled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [availableWidth, document, pageNumber])

  return (
    <div className="relative grid min-h-[720px] w-full place-items-start justify-center">
      <canvas ref={canvasRef} className={`block bg-white shadow ${rendered ? '' : 'absolute opacity-0'}`} />
      {!rendered ? <div className="text-xs text-neutral-500">正在渲染...</div> : null}
    </div>
  )
}
