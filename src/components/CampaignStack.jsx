import React from 'react'
import { motion } from 'framer-motion'

// A pile of same-campaign posts, stacked like paper with the sheets fanned
// out of the top corners. Clicking fans the stack out into individual cards.
export default function CampaignStack({ name, items, onExpand }) {
  const [face, ...rest] = items
  const sheets = rest.slice(0, 2)
  return (
    <motion.button
      type="button"
      className="work-card campaign-stack"
      onClick={onExpand}
      aria-label={`Expand campaign ${name} (${items.length} posts)`}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {sheets.map((it, i) => (
        <span key={it.id} className={`stack-sheet sheet-${i + 1}`} aria-hidden="true">
          {it.thumbnail && <img src={it.thumbnail} alt="" loading="lazy" />}
        </span>
      ))}
      <div className="work-card-frame">
        <div className="work-card-thumb thumb-social">
          {face.thumbnail ? (
            <img src={face.thumbnail} alt="" loading="lazy" />
          ) : (
            <div className="thumb-placeholder" aria-hidden="true">
              <span className="thumb-letter">{(name || '?').trim()[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="work-card-body">
          <div className="work-card-meta">
            <span className="pill">Campaign</span>
            <span className="pill pill-soft">{items.length} posts</span>
          </div>
          <h3>{name}</h3>
          <p className="work-card-desc">Tap to fan out the posts in this campaign.</p>
        </div>
      </div>
    </motion.button>
  )
}
