import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Embed from './embeds/Embed.jsx'
import { categoryById } from '../data/categories.js'

function formatDate(d) {
  if (!d) return ''
  if (/^present$/i.test(String(d).trim())) return 'Present'
  const [y, m] = String(d).split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return m ? `${months[Number(m) - 1]} ${y}` : y
}

// "Jun 2025" or, with an optional endDate, "Jun 2025 – Sep 2025" / "… – Present"
function formatRange(item) {
  if (!item.date) return ''
  const start = formatDate(item.date)
  const end = item.endDate ? formatDate(item.endDate) : ''
  return end && end !== start ? `${start} – ${end}` : start
}

// Full expanded view: artifact fills the main area, the colored info tab
// (company, goal, write-up) sits on the upper right — the card's hover tab, grown up.
export default function ItemOverlay({ item, onClose }) {
  const closeRef = useRef(null)
  const category = categoryById[item.category]

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <motion.div
      className="overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="overlay-panel"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <button ref={closeRef} type="button" className="overlay-close" onClick={onClose} aria-label="Close project view">
          ✕
        </button>

        <div className="overlay-main">
          <Embed item={item} />
        </div>

        <motion.aside
          className="overlay-side"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="overlay-side-inner">
            {item.company && <div className="tab-company">{item.company}</div>}
            <h2>{item.title}</h2>
            {item.goal && (
              <div className="side-goal">
                <strong>Goal</strong>
                {item.goal}
              </div>
            )}
            {item.longWriteup && <p className="side-writeup">{item.longWriteup}</p>}
            {item.tags?.length > 0 && (
              <div className="tag-row">
                {item.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="side-date">
            {category?.label}
            {item.date ? ` · ${formatRange(item)}` : ''}
          </div>
        </motion.aside>
      </motion.div>
    </motion.div>
  )
}
