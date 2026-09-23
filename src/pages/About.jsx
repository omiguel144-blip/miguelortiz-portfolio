import React from 'react'
import { profile } from '../data/profile.js'
import { useReveal } from '../lib/useReveal.js'

export default function About() {
  const ref = useReveal()
  return (
    <div className="container page">
      <span className="eyebrow">About</span>
      <h1 className="page-title">
        Hi, I’m {profile.firstName}.
      </h1>
      <div className="prose reveal" ref={ref}>
        {profile.about.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="skills-grid">
        {profile.skills.map((group) => (
          <div key={group.group}>
            <h3>{group.group}</h3>
            <ul>
              {group.items.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
