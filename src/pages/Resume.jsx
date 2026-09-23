import React, { useEffect, useState } from 'react'
import { profile } from '../data/profile.js'

export default function Resume() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = (e) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="container page">
      <span className="eyebrow">Resume</span>
      <h1 className="page-title">Resume</h1>
      <div className="hero-cta">
        <a className="btn btn-primary" href={profile.resumePdf} download="Miguel-Ortiz-Resume.pdf">
          Download PDF ↓
        </a>
        <a className="btn btn-ghost" href={profile.resumePdf} target="_blank" rel="noopener noreferrer">
          Open in new tab ↗
        </a>
      </div>
      {!narrow && (
        <div className="resume-viewer">
          <iframe
            src={`${profile.resumePdf}#view=FitH`}
            title="Resume PDF"
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </div>
      )}
    </div>
  )
}
