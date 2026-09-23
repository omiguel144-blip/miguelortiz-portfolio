import React, { useEffect, useState } from 'react'

function useIsNarrow(breakpoint = 720) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = (e) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return narrow
}

export default function PdfEmbed({ item }) {
  const narrow = useIsNarrow()

  if (!item.embedUrl) {
    return (
      <div className="embed-placeholder">
        <strong>No PDF yet.</strong>
        <br />
        Add the file to <code>public/work/</code> and set <code>embedUrl</code> for this item.
      </div>
    )
  }

  // PDFs in a cramped mobile iframe are unusable — show a tappable preview instead.
  if (narrow) {
    return (
      <div className="pdf-mobile-fallback">
        {item.thumbnail && (
          // whole first page, natural shape — tapping opens the real PDF
          <img src={item.thumbnail} alt="" style={{ width: '100%', height: 'auto', aspectRatio: 'auto' }} />
        )}
        <div className="pdf-mobile-body">
          <a className="btn btn-primary" href={item.embedUrl} target="_blank" rel="noopener noreferrer">
            View PDF ↗
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <iframe
        className="pdf-frame"
        src={`${item.embedUrl}#view=FitH`}
        title={`PDF: ${item.title}`}
        style={{ flex: 1 }}
      />
      <div className="embed-actions">
        <a href={item.embedUrl} target="_blank" rel="noopener noreferrer">
          Open in new tab ↗
        </a>
        <a href={item.embedUrl} download>
          Download ↓
        </a>
      </div>
    </div>
  )
}
