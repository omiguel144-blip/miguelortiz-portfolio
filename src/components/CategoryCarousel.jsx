import React, { useEffect, useRef, useState } from 'react'
import WorkCard from './WorkCard.jsx'
import CampaignStack from './CampaignStack.jsx'
import { useReveal } from '../lib/useReveal.js'

// Items that share a non-empty `campaign` name (2+ of them) collapse into one
// stack entry at the position of their first member.
function groupByCampaign(items) {
  const entries = []
  const grouped = new Set()
  for (const item of items) {
    const name = (item.campaign || '').trim()
    if (name) {
      if (grouped.has(name)) continue
      const members = items.filter((i) => (i.campaign || '').trim() === name)
      if (members.length > 1) {
        grouped.add(name)
        entries.push({ kind: 'stack', name, items: members })
        continue
      }
    }
    entries.push({ kind: 'item', item })
  }
  return entries
}

// One section: heading + a masonry grid of cards. Collapsed, the grid is
// height-capped with a gradient rising from the bottom of the visible cards
// and a pill that expands the section to show everything.
const SHELF_CAP = 660 // px of grid shown while a section is collapsed

export default function CategoryCarousel({ category, items, onOpen }) {
  const gridRef = useRef(null)
  const headRef = useReveal()
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)
  const [openStacks, setOpenStacks] = useState({})

  // Cap the grid only when that hides a meaningful amount of it — a section
  // that fits (or nearly fits) just renders whole, no fade, no pill.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const check = () => setClipped(grid.offsetHeight > SHELF_CAP + 140)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [items.length])

  const collapse = () => {
    setExpanded(false)
    document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!items.length) return null

  const entries = groupByCampaign(items)

  return (
    <section className="category-section" id={category.id} aria-labelledby={`${category.id}-title`}>
      <div className="container">
        <div className="category-head reveal" ref={headRef}>
          <div>
            <span className="eyebrow">
              {String(items.length).padStart(2, '0')} {items.length === 1 ? 'project' : 'projects'}
            </span>
            <h2 id={`${category.id}-title`}>{category.label}</h2>
            {category.blurb && <p>{category.blurb}</p>}
          </div>
        </div>
        <div
          className="shelf"
          style={!expanded && clipped ? { maxHeight: SHELF_CAP, overflow: 'hidden' } : undefined}
        >
          <div className="masonry" ref={gridRef} role="list" aria-label={`${category.label} projects`}>
            {entries.map((entry) =>
              entry.kind === 'item' ? (
                <div role="listitem" key={entry.item.id} style={{ display: 'contents' }}>
                  <WorkCard item={entry.item} onOpen={onOpen} />
                </div>
              ) : openStacks[entry.name] ? (
                <React.Fragment key={`stack-${entry.name}`}>
                  <button
                    type="button"
                    className="stack-collapse"
                    onClick={() => setOpenStacks((s) => ({ ...s, [entry.name]: false }))}
                    title={`Stack the ${entry.name} posts back together`}
                  >
                    <span className="stack-collapse-name">{entry.name}</span>
                    <span className="stack-collapse-hint">⊟ Stack</span>
                  </button>
                  {entry.items.map((item) => (
                    <div role="listitem" key={item.id} style={{ display: 'contents' }}>
                      <WorkCard item={item} onOpen={onOpen} />
                    </div>
                  ))}
                </React.Fragment>
              ) : (
                <div role="listitem" key={`stack-${entry.name}`} style={{ display: 'contents' }}>
                  <CampaignStack
                    name={entry.name}
                    items={entry.items}
                    onExpand={() => setOpenStacks((s) => ({ ...s, [entry.name]: true }))}
                  />
                </div>
              )
            )}
          </div>
          {!expanded && clipped && (
            <div className="shelf-fade">
              <button type="button" className="btn btn-primary show-all" onClick={() => setExpanded(true)}>
                Show all {items.length} ↓
              </button>
            </div>
          )}
        </div>
        {expanded && (
          <div className="show-less-row">
            <button type="button" className="btn btn-ghost show-all" onClick={collapse}>
              Show less ↑
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
