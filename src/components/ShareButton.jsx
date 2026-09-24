import React, { useEffect, useRef, useState } from 'react'
import { shareUrl } from '../lib/share.js'

// Try the async clipboard API, then the legacy execCommand path on the
// selected input (works in some browsers/contexts where the former is blocked).
async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      input?.select()
      return document.execCommand('copy')
    } catch {
      return false
    }
  }
}

// Opens a small panel with the item's view-only link, copied on open. On
// phones it uses the native share sheet (Messages, Mail, LinkedIn…) instead.
export default function ShareButton({ item, className = '' }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('') // '' | copied | manual
  const inputRef = useRef(null)
  const url = shareUrl(item)

  const copy = async () => {
    const ok = await copyText(url, inputRef.current)
    setStatus(ok ? 'copied' : 'manual')
    inputRef.current?.select()
  }

  const onClick = async () => {
    if (open) return setOpen(false)
    if (window.matchMedia('(hover: none)').matches && navigator.share) {
      try {
        await navigator.share({ title: item.title, url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    setStatus('')
    setOpen(true)
  }

  // Copy as soon as the panel appears, so one click is usually enough.
  useEffect(() => {
    if (open) copy()
  }, [open])

  return (
    <div className={`share ${className}`}>
      <button type="button" className="share-btn" onClick={onClick} aria-expanded={open}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
        Share link
      </button>
      {open && (
        <div className="share-panel">
          <div className="share-row">
            <input
              ref={inputRef}
              readOnly
              value={url}
              aria-label="View-only link"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" onClick={copy}>
              {status === 'copied' ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <p className="share-note" aria-live="polite">
            {status === 'copied'
              ? 'Link copied. Anyone with it can view this piece, but not download it.'
              : status === 'manual'
                ? 'Press ⌘C (or Ctrl+C) to copy the selected link.'
                : 'View-only link to this piece.'}
          </p>
        </div>
      )}
    </div>
  )
}
