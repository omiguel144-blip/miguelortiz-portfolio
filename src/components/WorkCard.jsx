import React from 'react'
import { motion } from 'framer-motion'
import { categoryById } from '../data/categories.js'

// Card in the carousel. Hover slides a colored info tab out to the right
// (company + goal); click expands into the full ItemOverlay.
export default function WorkCard({ item, onOpen }) {
  const category = categoryById[item.category]
  // Social cards all share Instagram's 4:5 post frame, whatever the cover's own shape
  const isSocial = item.category === 'social'
  return (
    <motion.button
      type="button"
      className="work-card"
      onClick={() => onOpen(item)}
      aria-haspopup="dialog"
      aria-label={`Open ${item.title}`}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="work-card-frame" style={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          className={`work-card-thumb ${
            isSocial ? 'thumb-social' : (item.thumbFit || 'natural') !== 'natural' ? 'thumb-cover' : ''
          }`}
          layoutId={`thumb-${item.id}`}
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt=""
              loading="lazy"
              style={{ objectPosition: item.thumbPosition || 'top' }}
            />
          ) : item.embedType === 'reel' && item.embedUrl ? (
            // No saved thumbnail — show Instagram's own embed preview, cropped
            // to the thumb area; the card button stays the only click target.
            <div className="thumb-reel" aria-hidden="true">
              <iframe
                src={`${item.embedUrl.split('?')[0].replace(/\/?$/, '/')}embed/`}
                title=""
                loading="lazy"
                scrolling="no"
                tabIndex={-1}
              />
            </div>
          ) : (
            <div className="thumb-placeholder" aria-hidden="true">
              <span className="thumb-letter">{(item.title || '?').trim()[0]?.toUpperCase()}</span>
            </div>
          )}
        </motion.div>
        <div className="work-card-body">
          <div className="work-card-meta">
            {category && <span className="pill">{category.label}</span>}
            {item.featured && <span className="pill" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>★ Featured</span>}
          </div>
          <h3>{item.title}</h3>
          <p className="work-card-desc">{item.description}</p>
          {item.tags?.length > 0 && (
            <div className="tag-row">
              {item.tags.slice(0, 4).map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {(item.company || item.goal) && (
        <div className="work-card-tab" aria-hidden="true">
          {item.company && <div className="tab-company">{item.company}</div>}
          {item.goal && <p className="tab-goal">{item.goal}</p>}
          <span className="tab-open">Open project →</span>
        </div>
      )}
    </motion.button>
  )
}
