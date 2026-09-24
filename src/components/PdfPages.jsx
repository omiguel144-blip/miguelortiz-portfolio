import React, { useEffect, useRef, useState } from 'react'
import { getPdfjs } from '../lib/pdfjs.js'

// View-only PDF: each page is drawn to a canvas with pdf.js, so there's no
// browser PDF toolbar (no download, print, or save button). Pages render as
// they scroll near the viewport and re-render sharp when the width changes.
function Page({ doc, number }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [ratio, setRatio] = useState(1.294) // letter-ish until the page loads
  const [visible, setVisible] = useState(number <= 2)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' })
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    io.observe(el)
    ro.observe(el)
    return () => {
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    let task
    let cancelled = false
    doc.getPage(number).then((page) => {
      const base = page.getViewport({ scale: 1 })
      if (cancelled) return
      setRatio(base.height / base.width)
      if (!visible || !width) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (width * dpr) / base.width })
      const canvas = canvasRef.current
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      task = page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport })
      task.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, number, visible, width])

  return (
    <div ref={wrapRef} className="pdf-page" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} aria-label={`Page ${number}`} />
    </div>
  )
}

export default function PdfPages({ url, title }) {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let loadingTask
    getPdfjs()
      .then((pdfjs) => {
        loadingTask = pdfjs.getDocument({ url })
        return loadingTask.promise
      })
      .then(setDoc)
      .catch((err) => setError(err))
    return () => loadingTask?.destroy()
  }, [url])

  if (error) return <div className="embed-placeholder">This file couldn’t be loaded.</div>
  if (!doc) return <div className="pdf-loading">Loading {title}…</div>

  return (
    <div className="pdf-pages" onContextMenu={(e) => e.preventDefault()}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <Page key={i} doc={doc} number={i + 1} />
      ))}
    </div>
  )
}
