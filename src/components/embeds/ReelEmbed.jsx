import React, { useEffect, useRef, useState } from 'react'

// Instagram's embed.js is loaded once, on demand, shared across all reels.
let igScriptPromise = null
function loadInstagramScript() {
  if (window.instgrm) return Promise.resolve()
  if (!igScriptPromise) {
    igScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://www.instagram.com/embed.js'
      s.async = true
      s.onload = resolve
      s.onerror = () => {
        igScriptPromise = null
        reject(new Error('Instagram embed.js failed to load'))
      }
      document.body.appendChild(s)
    })
  }
  return igScriptPromise
}

export default function ReelEmbed({ item }) {
  const shellRef = useRef(null)
  const [inView, setInView] = useState(false)
  const [failed, setFailed] = useState(false)

  // Lazy: only initialize the Instagram embed once scrolled into view.
  useEffect(() => {
    const el = shellRef.current
    if (!el || !item.embedUrl) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item.embedUrl])

  // Once visible, inject the blockquote and ask Instagram to process it.
  useEffect(() => {
    if (!inView) return
    let cancelled = false
    loadInstagramScript()
      .then(() => {
        // process() scans for unprocessed .instagram-media blockquotes in the DOM
        if (!cancelled && window.instgrm?.Embeds?.process) window.instgrm.Embeds.process()
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [inView])

  if (!item.embedUrl) {
    return (
      <div className="embed-placeholder">
        <strong>No reel linked yet.</strong>
        <br />
        Paste the reel URL (instagram.com/reel/…) into <code>embedUrl</code> for this item.
      </div>
    )
  }

  const permalink = item.embedUrl.split('?')[0].replace(/\/?$/, '/')

  return (
    <div className="reel-shell" ref={shellRef}>
      {inView && !failed && (
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={permalink}
          data-instgrm-version="14"
          style={{ margin: '0 auto', maxWidth: 400, width: '100%', minWidth: 280 }}
        >
          <a href={permalink} target="_blank" rel="noopener noreferrer">
            View this reel on Instagram
          </a>
        </blockquote>
      )}
      {failed && (
        <div className="embed-placeholder">
          Couldn’t load the Instagram embed.{' '}
          <a href={permalink} target="_blank" rel="noopener noreferrer">
            Watch it on Instagram ↗
          </a>
        </div>
      )}
    </div>
  )
}
