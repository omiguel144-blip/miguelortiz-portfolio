import React from 'react'

export default function LinkEmbed({ item }) {
  if (!item.embedUrl) {
    return (
      <div className="embed-placeholder">
        <strong>No link yet.</strong> Set <code>embedUrl</code> to the live page for this item.
      </div>
    )
  }
  let domain = ''
  try {
    domain = new URL(item.embedUrl).hostname.replace(/^www\./, '')
  } catch {
    domain = item.embedUrl
  }
  return (
    <a className="link-card" href={item.embedUrl} target="_blank" rel="noopener noreferrer">
      {item.thumbnail && <img src={item.thumbnail} alt="" />}
      <div className="link-card-body">
        <span className="link-card-domain">{domain} ↗</span>
        <h4>{item.title}</h4>
        <p>{item.description}</p>
      </div>
    </a>
  )
}
