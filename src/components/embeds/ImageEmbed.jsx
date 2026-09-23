import React from 'react'

// Single image, or a gallery when the item has an `images: []` array.
export default function ImageEmbed({ item }) {
  const images = Array.isArray(item.images) && item.images.length ? item.images : [item.embedUrl]
  if (!images[0]) {
    return (
      <div className="embed-placeholder">
        <strong>No image yet.</strong>
        <br />
        Add the file to <code>public/work/</code> and set <code>embedUrl</code> for this item.
      </div>
    )
  }
  return (
    <figure className="image-embed">
      <div className="image-gallery">
        {images.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? item.title : `${item.title} — image ${i + 1}`} loading="lazy" />
        ))}
      </div>
      {item.caption && <figcaption>{item.caption}</figcaption>}
    </figure>
  )
}
