import React, { useState } from 'react'
import { shareUrl } from '../lib/share.js'

// Copies the item's view-only link. On phones it opens the native share sheet
// instead (Messages, Mail, LinkedIn…), falling back to copy if that's dismissed
// or unsupported.
export default function ShareButton({ item, className = '' }) {
  const [state, setState] = useState('idle') // idle | copied | error

  const onClick = async () => {
    const url = shareUrl(item)
    const touch = window.matchMedia('(hover: none)').matches
    if (touch && navigator.share) {
      try {
        await navigator.share({ title: item.title, url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      window.prompt('Copy this link:', url)
      return
    }
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button type="button" className={`share-btn ${className}`} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      </svg>
      <span aria-live="polite">{state === 'copied' ? 'Link copied' : 'Share link'}</span>
    </button>
  )
}
