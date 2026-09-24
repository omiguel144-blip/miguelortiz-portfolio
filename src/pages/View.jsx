import React, { Suspense, lazy, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Embed from '../components/embeds/Embed.jsx'
import ShareButton from '../components/ShareButton.jsx'
import { findItemBySlug } from '../lib/share.js'
import { profile } from '../data/profile.js'

const PdfPages = lazy(() => import('../components/PdfPages.jsx'))

// Standalone, view-only page for one piece of work — what a share link opens.
export default function View() {
  const { slug } = useParams()
  const item = findItemBySlug(slug)

  useEffect(() => {
    const prev = document.title
    document.title = item ? `${item.title} | ${profile.name}` : `Not found | ${profile.name}`
    return () => {
      document.title = prev
    }
  }, [item])

  if (!item) {
    return (
      <div className="container page">
        <span className="eyebrow">Shared file</span>
        <h1 className="page-title">This link doesn’t go anywhere.</h1>
        <p className="prose">
          It may have been renamed. <Link to="/">Browse all of my work</Link> instead.
        </p>
      </div>
    )
  }

  return (
    <div className="container page view-page">
      <header className="view-head">
        {item.company && <span className="eyebrow">{item.company}</span>}
        <h1 className="page-title">{item.title}</h1>
        {item.goal && <p className="view-goal">{item.goal}</p>}
        <ShareButton item={item} className="share-btn-light" />
      </header>

      <div className="view-body">
        {item.embedType === 'pdf' && item.embedUrl ? (
          <Suspense fallback={<div className="pdf-loading">Loading {item.title}…</div>}>
            <PdfPages url={item.embedUrl} title={item.title} />
          </Suspense>
        ) : (
          <Embed item={item} />
        )}
      </div>

      <footer className="view-foot">
        <p>
          Shared by <strong>{profile.name}</strong>. View only.
        </p>
        <Link className="btn btn-primary" to="/">
          See more of my work →
        </Link>
      </footer>
    </div>
  )
}
