import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import work from './src/data/work.json' with { type: 'json' }

/**
 * Dev-only content API for the /admin page.
 * Only exists while `npm run dev` is running — the deployed site is pure static files.
 *
 *   POST /__admin/upload    { name, dataBase64 }  → saves file to public/work/, returns { path }
 *   POST /__admin/save      { items: [...] }      → rewrites src/data/work.json
 *   POST /__admin/scrape    { url }               → fetches page title/description/og:image
 *   POST /__admin/generate  { text, current, … }  → asks Claude to draft the item's metadata
 */

// ---------------------------------------------------------------------------
// Auto-fill: generate portfolio metadata from extracted document text.
// Tries the Anthropic SDK first (ANTHROPIC_API_KEY or `ant auth login`),
// then falls back to the local Claude Code CLI (`claude -p`) so it works
// with a plain Claude Code login and no API key.
// ---------------------------------------------------------------------------

function fieldSchema(categoryIds) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'company', 'category', 'description', 'goal', 'longWriteup', 'tags', 'date'],
    properties: {
      title: { type: 'string', description: 'Concise professional title, max 60 chars' },
      company: { type: 'string', description: 'Client/org name, empty string if unknown' },
      category: { type: 'string', enum: categoryIds },
      description: { type: 'string', description: 'One line for the card, max 120 chars' },
      goal: { type: 'string', description: 'One sentence: what the piece set out to achieve' },
      longWriteup: { type: 'string', description: '2-4 short paragraphs separated by blank lines' },
      tags: { type: 'array', items: { type: 'string' }, description: '3-5 short skill/tool tags' },
      date: { type: 'string', description: 'YYYY-MM if evident from the document, else empty string' },
    },
  }
}

function buildPrompt({ filename, text, current, categories }) {
  const cats = categories.map((c) => `${c.id} (${c.label})`).join(', ')
  return `You are filling in portfolio metadata for a work sample by Miguel Ortiz, a product manager and product marketer (MTM) applying to product manager / product marketing manager roles. Write copy that presents the work credibly to a hiring manager — concrete and specific, no buzzword filler.

File: ${filename}
Existing values (keep them consistent where they look intentional):
  title: ${current.title || '(empty)'}
  company: ${current.company || '(empty)'}
  category: ${current.category || '(empty)'}
  date: ${current.date || '(empty)'}
Category options: ${cats}

Extracted document text (may be messy or truncated):
"""
${text || '(no text could be extracted — infer what you can from the filename and existing values)'}
"""

Produce:
- title: concise, professional, max 60 chars
- company: the client/organization the work was for, if evident
- category: the best-fitting option
- description: one line for the work card, max 120 chars
- goal: one sentence stating what this piece set out to achieve (shown on a hover tab)
- longWriteup: 2-4 short paragraphs separated by blank lines; if the work is a case study or project story, structure it as Situation / Task / Action / Result
- tags: 3-5 short skill or tool tags (e.g. "Product Requirements", "Go-to-Market", "Figma")
- date: YYYY-MM only if the document clearly indicates one, else ""`
}

function extractJson(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON found in model output')
  return JSON.parse(raw.slice(start, end + 1))
}

async function generateViaSdk(payload) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ timeout: 120000 })
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: {
      format: {
        type: 'json_schema',
        schema: fieldSchema(payload.categories.map((c) => c.id)),
      },
    },
    messages: [{ role: 'user', content: buildPrompt(payload) }],
  })
  if (response.stop_reason === 'refusal') throw new Error('Model declined the request')
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Empty model response')
  return JSON.parse(text)
}

function generateViaCli(payload) {
  const prompt =
    buildPrompt(payload) +
    '\n\nRespond with ONLY a JSON object with keys: title, company, category, description, goal, longWriteup, tags (array), date. No markdown fences, no commentary.'
  // Give the CLI a clean slate: session vars from a parent Claude Code process
  // (CLAUDECODE, ANTHROPIC_BASE_URL, …) break nested runs and auth resolution.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC|CLAUDE)/i.test(k))
  )
  return new Promise((resolve, reject) => {
    const child = execFile(
      'claude',
      ['-p', prompt],
      { timeout: 180000, maxBuffer: 4 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          // the CLI reports failures (e.g. auth) on stdout
          const detail = String(stdout || stderr || '').trim() || `exit ${err.code ?? err.signal}`
          return reject(new Error(detail.slice(0, 300)))
        }
        try {
          resolve(extractJson(stdout))
        } catch (parseErr) {
          reject(parseErr)
        }
      }
    )
    child.stdin?.end() // `claude -p` waits for stdin EOF when it's a pipe
  })
}

async function generateFields(payload) {
  try {
    return await generateViaSdk(payload)
  } catch (sdkErr) {
    try {
      return await generateViaCli(payload)
    } catch (cliErr) {
      if (cliErr.code === 'ENOENT') {
        throw new Error(
          `No Claude access: set ANTHROPIC_API_KEY (or run \`ant auth login\`), or install the Claude Code CLI. (SDK: ${sdkErr.message})`
        )
      }
      throw new Error(`Claude call failed — SDK: ${sdkErr.message}; CLI: ${cliErr.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Social covers. Instagram's embed page ships without the cover image in the
// HTML (it's injected by JS), so a plain fetch sees nothing — a local headless
// Chrome run executes that JS and dumps the finished DOM instead. YouTube and
// TikTok expose covers directly, no browser needed.
// ---------------------------------------------------------------------------

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
].filter(Boolean)

function chromeDumpDom(url) {
  const chrome = CHROME_PATHS.find((p) => fs.existsSync(p))
  if (!chrome)
    throw new Error(
      'No Chrome/Chromium found (set CHROME_PATH). The card will use Instagram’s live embed preview instead.'
    )
  return new Promise((resolve, reject) => {
    execFile(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--virtual-time-budget=12000',
        '--timeout=25000',
        '--dump-dom',
        url,
      ],
      { timeout: 45000, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout)))
    )
  })
}

const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'")

async function socialCoverUrl(target) {
  const host = target.hostname.replace(/^www\./, '')

  if (/(^|\.)instagram\.com$/.test(host)) {
    const m = target.pathname.match(/\/(?:reel|reels|p|tv)\/([^/]+)/)
    if (!m) throw new Error('Not a recognizable Instagram post URL')
    const dom = await chromeDumpDom(`https://www.instagram.com/p/${m[1]}/embed/captioned/`)
    const img = dom.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]*>/)
    const src = img?.[0].match(/src="([^"]+)"/)
    if (!src) throw new Error('Instagram rendered no cover image (private or removed post?)')
    return decodeEntities(src[1])
  }

  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) {
    const id =
      host === 'youtu.be'
        ? target.pathname.slice(1).split('/')[0]
        : target.searchParams.get('v') || target.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]
    if (!id) throw new Error('Could not find a YouTube video id in the URL')
    for (const size of ['maxresdefault', 'hqdefault']) {
      const u = `https://i.ytimg.com/vi/${id}/${size}.jpg`
      const probe = await fetch(u, { signal: AbortSignal.timeout(10000) })
      if (probe.ok) return u
    }
    throw new Error('YouTube has no thumbnail for that video id')
  }

  if (/(^|\.)tiktok\.com$/.test(host)) {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target.href)}`, {
      signal: AbortSignal.timeout(15000),
    })
    const meta = await r.json().catch(() => ({}))
    if (!meta.thumbnail_url) throw new Error('TikTok oEmbed returned no thumbnail')
    return meta.thumbnail_url
  }

  const page = await fetch(target, {
    headers: { 'user-agent': 'Mozilla/5.0 (portfolio-admin preview fetch)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  const og = metaFromHtml(await page.text(), 'og:image')
  if (!og) throw new Error(`No og:image found on ${host}`)
  return new URL(og, target).href
}

// Minimal HTML meta extraction for link items
function metaFromHtml(html, name) {
  const attr = `(?:property|name)=["']${name}["']`
  const m =
    html.match(new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']*)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}`, 'i'))
  return (m?.[1] || '')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .trim()
}
function adminApi() {
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => {
        data += chunk
        if (data.length > 80 * 1024 * 1024) reject(new Error('File too large (80MB max)'))
      })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })

  const json = (res, status, obj) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(obj))
  }

  return {
    name: 'admin-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__admin/') || req.method !== 'POST') return next()
        try {
          const body = JSON.parse(await readBody(req))

          if (req.url === '/__admin/upload') {
            const safeName = String(body.name || 'file')
              .replace(/[^a-zA-Z0-9._-]+/g, '-')
              .replace(/^[-.]+/, '')
            if (!safeName) return json(res, 400, { error: 'Bad file name' })
            const dir = path.resolve(server.config.root, 'public/work')
            fs.mkdirSync(dir, { recursive: true })
            // avoid silently overwriting an existing asset
            let finalName = safeName
            let i = 1
            while (fs.existsSync(path.join(dir, finalName))) {
              const ext = path.extname(safeName)
              finalName = `${path.basename(safeName, ext)}-${i++}${ext}`
            }
            fs.writeFileSync(path.join(dir, finalName), Buffer.from(body.dataBase64, 'base64'))
            return json(res, 200, { path: `/work/${finalName}` })
          }

          if (req.url === '/__admin/resume') {
            const buf = Buffer.from(String(body.dataBase64 || ''), 'base64')
            if (buf.subarray(0, 4).toString() !== '%PDF')
              return json(res, 400, { error: 'That file is not a PDF — the resume must be a .pdf' })
            fs.writeFileSync(path.resolve(server.config.root, 'public/resume.pdf'), buf)
            return json(res, 200, { ok: true, kb: Math.round(buf.length / 1024) })
          }

          if (req.url === '/__admin/save') {
            if (!Array.isArray(body.items)) return json(res, 400, { error: 'items must be an array' })
            const file = path.resolve(server.config.root, 'src/data/work.json')
            fs.writeFileSync(file, JSON.stringify(body.items, null, 2) + '\n')
            return json(res, 200, { ok: true, count: body.items.length })
          }

          if (req.url === '/__admin/generate') {
            if (!Array.isArray(body.categories) || !body.categories.length)
              return json(res, 400, { error: 'categories required' })
            const fields = await generateFields({
              filename: String(body.filename || ''),
              text: String(body.text || '').slice(0, 12000),
              current: body.current || {},
              categories: body.categories,
            })
            return json(res, 200, { fields })
          }

          if (req.url === '/__admin/social-thumb') {
            let target
            try {
              target = new URL(body.url)
            } catch {
              return json(res, 400, { error: 'Invalid URL' })
            }
            const coverUrl = await socialCoverUrl(target)
            const img = await fetch(coverUrl, { signal: AbortSignal.timeout(20000) })
            if (!img.ok) throw new Error(`Cover download failed (HTTP ${img.status})`)
            const type = img.headers.get('content-type') || ''
            const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
            const dir = path.resolve(server.config.root, 'public/work/thumbs')
            fs.mkdirSync(dir, { recursive: true })
            // deterministic name so refetching replaces the old cover
            const base = String(body.id || 'social').replace(/[^a-zA-Z0-9-]+/g, '-') || 'social'
            const name = `${base}-cover.${ext}`
            fs.writeFileSync(path.join(dir, name), Buffer.from(await img.arrayBuffer()))
            return json(res, 200, { thumbnail: `/work/thumbs/${name}` })
          }

          if (req.url === '/__admin/scrape') {
            let target
            try {
              target = new URL(body.url)
            } catch {
              return json(res, 400, { error: 'Invalid URL' })
            }
            const page = await fetch(target, {
              headers: { 'user-agent': 'Mozilla/5.0 (portfolio-admin preview fetch)' },
              redirect: 'follow',
              signal: AbortSignal.timeout(15000),
            })
            const html = await page.text()
            const title =
              metaFromHtml(html, 'og:title') ||
              (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim()
            const description =
              metaFromHtml(html, 'og:description') || metaFromHtml(html, 'description')
            let thumbnail = ''
            const ogImage = metaFromHtml(html, 'og:image')
            if (ogImage) {
              try {
                const imgUrl = new URL(ogImage, target)
                const img = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) })
                if (img.ok) {
                  const type = img.headers.get('content-type') || ''
                  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
                  const dir = path.resolve(server.config.root, 'public/work/thumbs')
                  fs.mkdirSync(dir, { recursive: true })
                  const name = `link-${target.hostname.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.${ext}`
                  fs.writeFileSync(path.join(dir, name), Buffer.from(await img.arrayBuffer()))
                  thumbnail = `/work/thumbs/${name}`
                }
              } catch {
                // og:image fetch failing is non-fatal — the text meta is the payload
              }
            }
            return json(res, 200, { title, description, thumbnail })
          }

          return json(res, 404, { error: 'Unknown admin endpoint' })
        } catch (err) {
          return json(res, 500, { error: String(err.message || err) })
        }
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Link previews (Open Graph / Twitter cards). Chat apps and LinkedIn don't run
// JavaScript, so each share link needs its own HTML with the tags baked in:
// the build writes dist/view/<slug>/index.html per work item. Images come
// from public/og/ (python3 scripts/make-og-images.py), else the thumbnail.
// ---------------------------------------------------------------------------
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'https://miguelortiz-portfolio.vercel.app'
).replace(/\/$/, '')

const SITE = {
  title: 'Miguel Ortiz | Product Management & Product Marketing',
  description:
    'Portfolio of Miguel Ortiz, a product manager and product marketer. Product specs, market research, go-to-market strategy, case studies, decks, and launch content.',
  image: '/og/site.jpg',
  path: '/',
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function metaTags({ title, description, image, path: pagePath, type = 'website' }) {
  const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + p)
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(abs(pagePath))}" />`,
    `<meta property="og:site_name" content="Miguel Ortiz" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(abs(pagePath))}" />`,
    `<meta property="og:image" content="${esc(abs(image))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
    .map((t) => `    ${t}`)
    .join('\n')
}

const OG_START = '<!-- og:start -->'
const OG_END = '<!-- og:end -->'
const withTags = (html, tags) =>
  html.replace(/<!-- title, description[^>]*-->|<!-- og:start -->[\s\S]*?<!-- og:end -->/, `${OG_START}\n${tags}\n    ${OG_END}`)

function itemPreview(item, root) {
  const og = `/og/${item.id}.jpg`
  const image = fs.existsSync(path.join(root, 'public', og)) ? og : item.thumbnail || SITE.image
  const who = item.company ? `${item.company} · ` : ''
  return {
    title: `${item.title} | Miguel Ortiz`,
    description: who + (item.description || item.goal || SITE.description),
    image,
    path: `/view/${item.slug || item.id}`,
    type: 'article',
  }
}

function sharePreviews() {
  let root = process.cwd()
  return {
    name: 'share-previews',
    configResolved(config) {
      root = config.root
    },
    transformIndexHtml: (html) => withTags(html, metaTags(SITE)),
    closeBundle() {
      const dist = path.join(root, 'dist')
      const indexFile = path.join(dist, 'index.html')
      if (!fs.existsSync(indexFile)) return
      const base = fs.readFileSync(indexFile, 'utf8')
      let count = 0
      for (const item of work) {
        const html = withTags(base, metaTags(itemPreview(item, root)))
        // Both the custom slug and the raw id resolve in the app, so give both previews.
        for (const name of new Set([item.slug, item.id].filter(Boolean))) {
          const dir = path.join(dist, 'view', name)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, 'index.html'), html)
          count++
        }
      }
      console.log(`share-previews: wrote ${count} link-preview pages for ${SITE_URL}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), adminApi(), sharePreviews()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
})
