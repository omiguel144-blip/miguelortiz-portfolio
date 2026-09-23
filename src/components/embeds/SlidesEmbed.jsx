import React from 'react'

// Normalizes common share URLs into embeddable ones.
function toEmbedUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('docs.google.com') && u.pathname.includes('/presentation/')) {
      // .../pub?start=... or .../edit → .../embed
      return url.replace(/\/(pub|edit|preview)([?#].*)?$/, '/embed$2')
    }
    if (u.hostname.includes('canva.com') && u.pathname.includes('/design/')) {
      if (!u.searchParams.has('embed')) u.searchParams.set('embed', '')
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

export default function SlidesEmbed({ item }) {
  if (!item.embedUrl) {
    return (
      <div className="embed-placeholder">
        <strong>No deck linked yet.</strong>
        <br />
        Paste a published Google Slides URL (File → Share → Publish to web) or a Canva share link into{' '}
        <code>embedUrl</code> for this item.
      </div>
    )
  }
  return (
    <div>
      <div className="embed-frame-16x9">
        <iframe
          src={toEmbedUrl(item.embedUrl)}
          title={`Slides: ${item.title}`}
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="embed-actions">
        <a href={item.embedUrl} target="_blank" rel="noopener noreferrer">
          Open deck in new tab ↗
        </a>
      </div>
    </div>
  )
}
