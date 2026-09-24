// Share links: every work item gets a view-only page at /view/<slug>.
// `slug` in work.json is the custom part of the URL; items without one fall
// back to their (unique) id. Ids also resolve for items that have a slug.
import work from '../data/work.json'

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

export const itemSlug = (item) => item.slug || item.id

export function findItemBySlug(slug) {
  const s = String(slug || '').toLowerCase()
  return (
    work.find((w) => w.slug === s) ||
    work.find((w) => w.id === s) ||
    null
  )
}

export const sharePath = (item) => `/view/${itemSlug(item)}`
export const shareUrl = (item) => `${window.location.origin}${sharePath(item)}`
