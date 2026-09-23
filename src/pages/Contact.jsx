import React from 'react'
import { profile } from '../data/profile.js'

export default function Contact() {
  return (
    <div className="container page">
      <span className="eyebrow">Contact</span>
      <h1 className="page-title">Let’s talk.</h1>
      <p className="prose">
        The fastest way to reach me is email — I usually reply within a day. Happy to share more
        work samples, references, or context on anything here.
      </p>
      <div className="contact-list">
        <a href={`mailto:${profile.email}`}>
          {profile.email} <span>Email →</span>
        </a>
        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn <span>Connect →</span>
        </a>
        <a href={profile.resumePdf} download="Miguel-Ortiz-Resume.pdf">
          Resume <span>Download →</span>
        </a>
      </div>
    </div>
  )
}
