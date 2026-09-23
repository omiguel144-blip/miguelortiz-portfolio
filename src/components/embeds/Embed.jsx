import React from 'react'
import PdfEmbed from './PdfEmbed.jsx'
import SlidesEmbed from './SlidesEmbed.jsx'
import ReelEmbed from './ReelEmbed.jsx'
import ImageEmbed from './ImageEmbed.jsx'
import LinkEmbed from './LinkEmbed.jsx'

const EMBEDS = {
  pdf: PdfEmbed,
  slides: SlidesEmbed,
  reel: ReelEmbed,
  image: ImageEmbed,
  link: LinkEmbed,
}

// One component, switched on item.embedType — add new types to the map above.
export default function Embed({ item }) {
  const Component = EMBEDS[item.embedType]
  if (!Component) {
    return (
      <div className="embed-placeholder">
        Unknown embedType <strong>{String(item.embedType)}</strong>. Use one of:{' '}
        {Object.keys(EMBEDS).join(', ')}.
      </div>
    )
  }
  return <Component item={item} />
}
