import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { categories, categoryById } from '../data/categories.js'
import work from '../data/work.json'
import { profile } from '../data/profile.js'
import CategoryCarousel from '../components/CategoryCarousel.jsx'
import ItemOverlay from '../components/ItemOverlay.jsx'

const slugId = (s) =>
  'co-' +
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// The same work, shelved by client/company instead of category. Companies
// keep the order they first appear in work.json; the blurb lists what kinds
// of work were done for them.
function companySections() {
  const order = []
  const byName = new Map()
  for (const w of work) {
    const name = (w.company || '').trim() || 'Independent work'
    if (!byName.has(name)) {
      byName.set(name, [])
      order.push(name)
    }
    byName.get(name).push(w)
  }
  return order.map((name) => {
    const items = byName.get(name)
    const kinds = [...new Set(items.map((i) => categoryById[i.category]?.label).filter(Boolean))]
    return { id: slugId(name), label: name, blurb: kinds.join(' · '), items }
  })
}

export default function Home() {
  const [openItem, setOpenItem] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [view, setView] = useState('category') // 'category' | 'company'

  const sections = useMemo(
    () =>
      view === 'category'
        ? categories
            .map((c) => ({ ...c, items: work.filter((w) => w.category === c.id) }))
            .filter((s) => s.items.length)
        : companySections(),
    [view]
  )

  // Track which section is on screen to highlight the jump bar.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Split the headline so the first two words get the green gradient (Plaid style).
  const words = profile.headline.split(' ')
  const emphasized = words.slice(0, 2).join(' ')
  const rest = words.slice(2).join(' ')

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Product Management · Product Marketing · Go-to-Market</span>
          <h1>
            <em>{emphasized}</em> {rest}
          </h1>
          <p className="hero-sub">{profile.positioning}</p>
          <div className="hero-cta">
            <a className="btn btn-ghost" href="/resume">
              View my resume
            </a>
            <button className="btn btn-primary" onClick={() => sections[0] && jumpTo(sections[0].id)}>
              Browse the work ↓
            </button>
          </div>
        </div>
      </section>

      <div className="jumpbar" role="navigation" aria-label="Work sections">
        <div className="jumpbar-inner">
          <div className="view-toggle" role="group" aria-label="Group work by">
            <button
              type="button"
              className={view === 'category' ? 'active' : ''}
              onClick={() => setView('category')}
            >
              By category
            </button>
            <button
              type="button"
              className={view === 'company' ? 'active' : ''}
              onClick={() => setView('company')}
            >
              By company
            </button>
          </div>
          <span className="jumpbar-divider" aria-hidden="true" />
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={activeSection === s.id ? 'active' : ''}
              onClick={() => jumpTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sections.map((s) => (
        <CategoryCarousel key={s.id} category={s} items={s.items} onOpen={setOpenItem} />
      ))}

      <AnimatePresence>
        {openItem && <ItemOverlay item={openItem} onClose={() => setOpenItem(null)} />}
      </AnimatePresence>
    </>
  )
}
