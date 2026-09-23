import React, { useRef, useState } from 'react'
import { categories } from '../data/categories.js'
import initialWork from '../data/work.json'

// ---------------------------------------------------------------------------
// DEV-ONLY content manager (http://localhost:5173/admin while `npm run dev`).
// Drag files in → they're copied to public/work/ and become draft items.
// Drag rows to reorder (across categories too), edit inline, then Save —
// which rewrites src/data/work.json. Deploy = commit + push as usual.
// ---------------------------------------------------------------------------

const EMBED_TYPES = ['pdf', 'slides', 'reel', 'image', 'link']

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item'

const guessType = (name) => {
  if (/\.pdf$/i.test(name)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name)) return 'image'
  return 'link'
}

const guessLinkType = (url) => {
  if (/instagram\.com\/(reel|reels|p|tv)\//i.test(url)) return 'reel'
  if (/docs\.google\.com\/presentation|canva\.com\/design/i.test(url)) return 'slides'
  return 'link'
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

async function uploadBase64(name, dataBase64) {
  const json = await post('/__admin/upload', { name, dataBase64 })
  return json.path
}

async function uploadFile(file) {
  const dataBase64 = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
  return uploadBase64(file.name, dataBase64)
}

// ---- PDF reading (pdf.js, loaded on demand; dev-only page so never bundled) ----
let pdfjsPromise = null
function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })
  }
  return pdfjsPromise
}

// Extracts text from the first pages and renders page 1 to a PNG thumbnail.
async function readPdf(url) {
  const pdfjs = await getPdfjs()
  const doc = await pdfjs.getDocument({ url }).promise
  let text = ''
  const pages = Math.min(doc.numPages, 4)
  for (let i = 1; i <= pages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    text += content.items.map((t) => t.str).join(' ') + '\n\n'
  }
  const page = await doc.getPage(1)
  const scale = 900 / page.getViewport({ scale: 1 }).width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise
  const thumbBase64 = canvas.toDataURL('image/png').split(',')[1]
  return { text: text.replace(/\s+/g, ' ').slice(0, 10000), thumbBase64 }
}

// Merge generated fields into an item. Only fills blanks unless `fresh`
// (a just-uploaded item whose title/category/date were filename guesses).
function mergeFields(cur, fields, fresh, validCategories) {
  const out = { ...cur }
  const canFill = (key) => {
    const v = cur[key]
    return fresh || v == null || v === '' || (Array.isArray(v) && v.length === 0)
  }
  const set = (key, val) => {
    if (val && canFill(key)) out[key] = val
  }
  set('title', fields.title)
  set('company', fields.company)
  if (fields.category && validCategories.includes(fields.category) && fresh) out.category = fields.category
  set('description', fields.description)
  set('goal', fields.goal)
  set('longWriteup', fields.longWriteup)
  if (Array.isArray(fields.tags) && fields.tags.length && canFill('tags'))
    out.tags = fields.tags.map(String)
  set('date', fields.date)
  return out
}

export default function Admin() {
  const [items, setItems] = useState(initialWork)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState({ kind: '', msg: '' })
  const [editingId, setEditingId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // item id or `end:<categoryId>`
  const [dragOverZone, setDragOverZone] = useState(false)
  const [fillingId, setFillingId] = useState(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [resumeBusy, setResumeBusy] = useState(false)
  const fileInputRef = useRef(null)
  const resumeInputRef = useRef(null)

  // Replaces public/resume.pdf — the file behind the /resume page.
  const uploadResume = async (file) => {
    setResumeBusy(true)
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const { kb } = await post('/__admin/resume', { dataBase64 })
      setStatus({ kind: 'saved', msg: `Resume replaced (${kb} KB) — it's live at /resume immediately, no Save needed.` })
    } catch (err) {
      setStatus({ kind: 'error', msg: `Resume upload failed: ${String(err.message || err)}` })
    } finally {
      setResumeBusy(false)
    }
  }

  const update = (next) => {
    setItems(next)
    setDirty(true)
  }

  const patchItem = (id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    setDirty(true)
  }

  // ---- auto-fill: thumbnail from page 1 + metadata drafted by Claude ----
  const autoFill = async (item, { fresh = false } = {}) => {
    setFillingId(item.id)
    try {
      let text = ''
      let readNote = ''
      if (item.embedType === 'pdf' && item.embedUrl) {
        setStatus({ kind: '', msg: `Reading ${item.embedUrl.split('/').pop()}…` })
        try {
          const pdf = await readPdf(item.embedUrl)
          text = pdf.text
          if (!item.thumbnail) {
            const thumbnail = await uploadBase64(`${item.id}-thumb.png`, pdf.thumbBase64)
            // top-anchor page renders so document titles aren't cropped away
            patchItem(item.id, { thumbnail, thumbPosition: 'top' })
          }
        } catch (pdfErr) {
          // Don't fail the whole run — draft from the filename and say so.
          readNote = ` Couldn't read the PDF itself (${String(pdfErr.message || pdfErr).slice(0, 80)}), so the draft is based on the filename only.`
        }
      } else if (item.embedType === 'link' && /^https?:/i.test(item.embedUrl)) {
        setStatus({ kind: '', msg: `Fetching ${item.embedUrl}…` })
        const meta = await post('/__admin/scrape', { url: item.embedUrl })
        text = [meta.title, meta.description].filter(Boolean).join('\n\n')
        if (!item.thumbnail && meta.thumbnail) patchItem(item.id, { thumbnail: meta.thumbnail })
      } else if (item.embedType === 'reel' && /^https?:/i.test(item.embedUrl) && !item.thumbnail) {
        setStatus({ kind: '', msg: 'Fetching the reel’s cover image…' })
        try {
          const { thumbnail } = await post('/__admin/social-thumb', { url: item.embedUrl, id: item.id })
          patchItem(item.id, { thumbnail, thumbPosition: 'center' })
        } catch (coverErr) {
          readNote = ` Couldn't fetch the cover (${String(coverErr.message || coverErr).slice(0, 80)}) — the card shows Instagram's live preview instead.`
        }
      }
      setStatus({ kind: '', msg: 'Asking Claude to draft the details… (10–60s)' })
      const { fields } = await post('/__admin/generate', {
        filename: item.embedUrl || item.title,
        text,
        current: { title: item.title, company: item.company, category: item.category, date: item.date },
        categories: categories.map((c) => ({ id: c.id, label: c.label })),
      })
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? mergeFields(i, fields, fresh, categories.map((c) => c.id)) : i
        )
      )
      setDirty(true)
      setStatus({
        kind: 'saved',
        msg: `Auto-filled "${fields.title || item.title}" — review, then Save.${readNote}`,
      })
    } catch (err) {
      setStatus({ kind: 'error', msg: `Auto-fill failed: ${String(err.message || err)}` })
    } finally {
      setFillingId(null)
    }
  }

  // ---- add files (dropzone or picker) ----
  const MAX_FILE_MB = 60
  const addFiles = async (fileList) => {
    let files = [...fileList]
    if (!files.length) return
    const tooBig = files.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig.length) {
      setStatus({
        kind: 'error',
        msg: `Skipped ${tooBig.map((f) => `"${f.name}" (${Math.round(f.size / 1048576)} MB)`).join(', ')} — over ${MAX_FILE_MB} MB. Files that large make the live site painfully slow; re-export a compressed PDF (in Canva: Share → Download → "PDF Standard" instead of "PDF Print") and drop it again.`,
      })
      files = files.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
      if (!files.length) return
    }
    setStatus({ kind: '', msg: `Uploading ${files.length} file(s)…` })
    try {
      const newItems = []
      for (const file of files) {
        const path = await uploadFile(file)
        const type = guessType(file.name)
        const base = slug(file.name)
        let id = base
        let n = 1
        while ([...items, ...newItems].some((i) => i.id === id)) id = `${base}-${n++}`
        newItems.push({
          id,
          title: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '),
          category: categories[0].id,
          company: '',
          goal: '',
          description: '',
          longWriteup: '',
          embedType: type,
          embedUrl: path,
          thumbnail: type === 'image' ? path : '',
          tags: [],
          date: new Date().toISOString().slice(0, 7),
          featured: false,
        })
      }
      setItems((prev) => [...prev, ...newItems])
      setDirty(true)
      setEditingId(newItems[0].id)
      setStatus({ kind: 'saved', msg: `Added ${newItems.length} item(s).` })
      // Auto-fill each new PDF: first-page thumbnail + Claude-drafted details.
      for (const it of newItems) {
        if (it.embedType === 'pdf') await autoFill(it, { fresh: true })
      }
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err.message || err) })
    }
  }

  // ---- add a URL: Instagram reel, Google Slides / Canva deck, or live page ----
  const addLink = async () => {
    const url = linkUrl.trim()
    if (!/^https?:\/\//i.test(url)) {
      setStatus({ kind: 'error', msg: 'Paste a full URL starting with https://' })
      return
    }
    const type = guessLinkType(url)
    let base = type
    try {
      base = slug(`${new URL(url).hostname.replace(/^www\./, '')}-${type}`)
    } catch {
      /* keep fallback */
    }
    let id = base
    let n = 1
    while (items.some((i) => i.id === id)) id = `${base}-${n++}`
    const item = {
      id,
      title: type === 'reel' ? 'Instagram Reel' : '',
      category: type === 'reel' ? 'social' : type === 'slides' ? 'decks' : 'content',
      company: '',
      goal: '',
      description: '',
      longWriteup: '',
      embedType: type,
      embedUrl: url,
      thumbnail: '',
      tags: [],
      date: new Date().toISOString().slice(0, 7),
      featured: false,
    }
    setItems((prev) => [...prev, item])
    setDirty(true)
    setEditingId(id)
    setLinkUrl('')
    if (type === 'reel') {
      setStatus({ kind: '', msg: 'Reel added — fetching its cover image…' })
      try {
        const { thumbnail } = await post('/__admin/social-thumb', { url, id })
        patchItem(id, { thumbnail, thumbPosition: 'center' })
        setStatus({
          kind: 'saved',
          msg: 'Reel added to Social & Video with its cover image. Give it a title and description, then Save.',
        })
      } catch (err) {
        setStatus({
          kind: 'saved',
          msg: `Reel added — couldn't fetch the cover (${String(err.message || err).slice(0, 120)}). The card shows Instagram's live preview until one is set.`,
        })
      }
    } else if (type === 'slides') {
      setStatus({
        kind: 'saved',
        msg: 'Deck link added — make sure the deck is published (Google Slides: File → Share → Publish to web; Canva: Share → smart link). Then Save.',
      })
    } else {
      await autoFill(item) // live pages: scrape title/description/preview image, then draft
    }
  }

  // ---- reorder via drag ----
  const handleDrop = (targetKey) => {
    if (!dragId) return
    const dragged = items.find((i) => i.id === dragId)
    if (!dragged) return
    let rest = items.filter((i) => i.id !== dragId)
    if (String(targetKey).startsWith('end:')) {
      const cat = targetKey.slice(4)
      const moved = { ...dragged, category: cat }
      // insert after the last item of that category (or at the end)
      let idx = -1
      rest.forEach((i, n) => {
        if (i.category === cat) idx = n
      })
      rest.splice(idx + 1, 0, moved)
    } else {
      const idx = rest.findIndex((i) => i.id === targetKey)
      if (idx === -1) return
      rest.splice(idx, 0, { ...dragged, category: rest[idx].category })
    }
    update(rest)
    setDragId(null)
    setDropTarget(null)
  }

  // ---- save ----
  const save = async () => {
    setStatus({ kind: '', msg: 'Saving…' })
    try {
      const res = await fetch('/__admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setDirty(false)
      setStatus({ kind: 'saved', msg: `Saved ${json.count} items to src/data/work.json ✓` })
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err.message || err) })
    }
  }

  const editing = items.find((i) => i.id === editingId)

  return (
    <div className="container admin">
      <h1>Content Manager</h1>
      <p className="admin-note">
        Local only — this page exists while <code>npm run dev</code> is running and is never part of
        the deployed site. Drop files below: PDFs get a first-page thumbnail and Claude drafts the
        description, goal, write-up, and tags automatically (✨ Auto-fill runs it on any row — it
        only fills fields that are empty). Drag rows to reorder or move between categories, then{' '}
        <strong>Save</strong>. To publish, redeploy (git push).
      </p>

      <div
        className={`dropzone ${dragOverZone ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverZone(true)
        }}
        onDragLeave={() => setDragOverZone(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverZone(false)
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
      >
        <strong>Drag PDFs or images here</strong> — they’ll be copied into <code>public/work/</code>{' '}
        and become new items.
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" type="button" onClick={() => fileInputRef.current?.click()}>
            …or choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="add-link-row">
        <input
          type="url"
          value={linkUrl}
          placeholder="…or paste a link: Instagram reel, Google Slides / Canva deck, or a live page"
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLink()}
        />
        <button type="button" className="btn btn-primary" onClick={addLink} disabled={!linkUrl.trim()}>
          Add link
        </button>
      </div>

      <div className="resume-row">
        <div>
          <strong>Resume</strong> — the PDF served on the{' '}
          <a href="/resume" target="_blank" rel="noopener noreferrer">
            /resume
          </a>{' '}
          page.
        </div>
        <span className="spacer" />
        <a className="btn btn-ghost" href="/resume.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px' }}>
          View current ↗
        </a>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 16px' }}
          disabled={resumeBusy}
          onClick={() => resumeInputRef.current?.click()}
        >
          {resumeBusy ? 'Uploading…' : 'Replace resume PDF'}
        </button>
        <input
          ref={resumeInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) uploadResume(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="admin-toolbar">
        <button className="btn btn-primary" type="button" onClick={save} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </button>
        <span className={`admin-status ${status.kind}`}>{status.msg}</span>
        <span className="spacer" />
        <a href="/" style={{ fontSize: 13.5 }}>
          View site →
        </a>
      </div>

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.id)
        return (
          <div className="admin-group" key={cat.id}>
            <h2>
              {cat.label} <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>({catItems.length})</span>
            </h2>
            <ul className="admin-list">
              {catItems.map((item) => (
                <React.Fragment key={item.id}>
                  <li
                    className={`admin-item ${dragId === item.id ? 'dragging' : ''} ${
                      dropTarget === item.id ? 'drop-target' : ''
                    }`}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setDropTarget(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDropTarget(item.id)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleDrop(item.id)
                    }}
                  >
                    <span className="grip" title="Drag to reorder">
                      ⠿
                    </span>
                    {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <img alt="" />}
                    <div>
                      <div className="admin-item-title">{item.title}</div>
                      <div className="admin-item-sub">
                        {item.embedType} · {item.date}
                        {item.featured ? ' · ★ featured' : ''}
                      </div>
                    </div>
                    <span className="spacer" />
                    <button
                      type="button"
                      onClick={() => autoFill(item)}
                      disabled={fillingId !== null}
                      title="Render page 1 as the thumbnail and have Claude draft the empty fields"
                    >
                      {fillingId === item.id ? 'Filling…' : '✨ Auto-fill'}
                    </button>
                    <button type="button" onClick={() => setEditingId(editingId === item.id ? null : item.id)}>
                      {editingId === item.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (confirm(`Delete "${item.title}" from the list? (The file in public/work/ is not deleted.)`))
                          update(items.filter((i) => i.id !== item.id))
                      }}
                    >
                      Delete
                    </button>
                  </li>
                  {editingId === item.id && editing && (
                    <li>
                      <ItemEditor
                        item={editing}
                        onChange={(next) => update(items.map((i) => (i.id === next.id ? next : i)))}
                        onUploadThumb={async (file) => {
                          const path = await uploadFile(file)
                          update(items.map((i) => (i.id === item.id ? { ...i, thumbnail: path } : i)))
                        }}
                      />
                    </li>
                  )}
                </React.Fragment>
              ))}
              <li
                className={`admin-item ${dropTarget === `end:${cat.id}` ? 'drop-target' : ''}`}
                style={{ borderStyle: 'dashed', color: 'var(--ink-faint)', fontSize: 13, justifyContent: 'center' }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(`end:${cat.id}`)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(`end:${cat.id}`)
                }}
              >
                {dragId ? `Drop here to move into ${cat.label}` : `End of ${cat.label}`}
              </li>
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function ItemEditor({ item, onChange, onUploadThumb }) {
  const set = (key, value) => onChange({ ...item, [key]: value })
  const thumbInput = useRef(null)
  const [coverState, setCoverState] = useState({ busy: false, error: '' })
  const isSocialItem = item.embedType === 'reel' || item.category === 'social'
  const fetchCover = async () => {
    setCoverState({ busy: true, error: '' })
    try {
      const { thumbnail } = await post('/__admin/social-thumb', { url: item.embedUrl, id: item.id })
      onChange({ ...item, thumbnail, thumbPosition: 'center' })
      setCoverState({ busy: false, error: '' })
    } catch (err) {
      setCoverState({ busy: false, error: String(err.message || err) })
    }
  }
  return (
    <div className="editor-card">
      <div className="editor-grid">
        <div className="field">
          <label htmlFor={`${item.id}-title`}>Title</label>
          <input id={`${item.id}-title`} value={item.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-category`}>Category</label>
          <select id={`${item.id}-category`} value={item.category} onChange={(e) => set('category', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-company`}>Company / client (hover tab)</label>
          <input id={`${item.id}-company`} value={item.company || ''} onChange={(e) => set('company', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-goal`}>Goal (hover tab)</label>
          <input id={`${item.id}-goal`} value={item.goal || ''} onChange={(e) => set('goal', e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor={`${item.id}-desc`}>One-line description (card)</label>
          <input id={`${item.id}-desc`} value={item.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor={`${item.id}-writeup`}>Long write-up (expanded view)</label>
          <textarea
            id={`${item.id}-writeup`}
            value={item.longWriteup || ''}
            onChange={(e) => set('longWriteup', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-type`}>Embed type</label>
          <select id={`${item.id}-type`} value={item.embedType} onChange={(e) => set('embedType', e.target.value)}>
            {EMBED_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-url`}>Embed URL / file path</label>
          <input
            id={`${item.id}-url`}
            value={item.embedUrl}
            placeholder="/work/file.pdf or https://…"
            onChange={(e) => set('embedUrl', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-thumb`}>Thumbnail</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id={`${item.id}-thumb`}
              value={item.thumbnail || ''}
              placeholder="/work/thumbs/…"
              onChange={(e) => set('thumbnail', e.target.value)}
            />
            {isSocialItem && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}
                onClick={fetchCover}
                disabled={coverState.busy || !/^https?:/i.test(item.embedUrl || '')}
                title="Grab the post's own cover image automatically"
              >
                {coverState.busy ? 'Fetching…' : 'Fetch cover'}
              </button>
            )}
            <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px' }} onClick={() => thumbInput.current?.click()}>
              Upload
            </button>
            <input
              ref={thumbInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onUploadThumb(e.target.files[0])}
            />
          </div>
          {coverState.error && (
            <p style={{ color: '#b3261e', fontSize: 12, margin: '6px 0 0' }}>{coverState.error}</p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-fit`}>Thumbnail shape</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select id={`${item.id}-fit`} value={item.thumbFit || 'natural'} onChange={(e) => set('thumbFit', e.target.value)}>
              <option value="natural">Natural size (whole image)</option>
              <option value="cover">Crop to 4:3</option>
            </select>
            <select
              aria-label="Crop position"
              value={item.thumbPosition || 'top'}
              onChange={(e) => set('thumbPosition', e.target.value)}
              disabled={(item.thumbFit || 'natural') !== 'cover'}
            >
              <option value="top">Show top</option>
              <option value="center">Show center</option>
              <option value="bottom">Show bottom</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Card preview</label>
          <div className={`thumb-preview ${(item.thumbFit || 'natural') === 'cover' ? 'cover' : ''}`}>
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" style={{ objectPosition: item.thumbPosition || 'top' }} />
            ) : (
              <span>No thumbnail yet</span>
            )}
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-tags`}>Tags (comma-separated)</label>
          <input
            id={`${item.id}-tags`}
            value={(item.tags || []).join(', ')}
            onChange={(e) =>
              set(
                'tags',
                e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
              )
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-campaign`}>Campaign (posts sharing a name stack together)</label>
          <input
            id={`${item.id}-campaign`}
            value={item.campaign || ''}
            placeholder="e.g. Museum Launch"
            onChange={(e) => set('campaign', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-date`}>Date (YYYY-MM) + optional end date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id={`${item.id}-date`} value={item.date || ''} onChange={(e) => set('date', e.target.value)} />
            <input
              aria-label="End date (optional)"
              value={item.endDate || ''}
              placeholder="end: YYYY-MM or present"
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${item.id}-featured`}>Featured</label>
          <input
            id={`${item.id}-featured`}
            type="checkbox"
            style={{ width: 'auto' }}
            checked={!!item.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />
        </div>
      </div>
    </div>
  )
}
