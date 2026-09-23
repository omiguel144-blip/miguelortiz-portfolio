// Generates placeholder assets for every item in src/data/work.json:
//   - a real multi-line PDF for each embedType:"pdf" item
//   - an editorial SVG thumbnail for every item
//   - full-size SVGs for image-embed items, a placeholder resume, and a favicon
// Run: node scripts/make-placeholders.mjs
// Safe to re-run; it overwrites placeholder files only in public/work + resume.pdf.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const items = JSON.parse(fs.readFileSync(path.join(root, 'src/data/work.json'), 'utf8'))

const ACCENT = [0.165, 0.38, 0.79] // #2a61c9 (Plaid-style blue)
const INK = [0.063, 0.102, 0.176]

// ---------- minimal PDF writer (Letter, Helvetica) ----------
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function wrap(text, max = 82) {
  const out = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of para.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > max) {
        out.push(line.trim())
        line = word
      } else {
        line += ' ' + word
      }
    }
    if (line.trim()) out.push(line.trim())
  }
  return out
}

function makePdf({ eyebrow, title, subtitle, body }) {
  const rgb = (c) => c.map((n) => n.toFixed(3)).join(' ')
  let s = ''
  // accent header bar + footer rule
  s += `${rgb(ACCENT)} rg 0 756 612 36 re f\n`
  s += `${rgb(ACCENT)} rg 72 60 468 2 re f\n`
  // eyebrow
  s += `BT /F2 9 Tf ${rgb(ACCENT)} rg 72 700 Td (${esc(eyebrow.toUpperCase())}) Tj ET\n`
  // title (wrapped, bold, 26pt)
  let y = 668
  for (const line of wrap(title, 38)) {
    s += `BT /F1 26 Tf ${rgb(INK)} rg 72 ${y} Td (${esc(line)}) Tj ET\n`
    y -= 32
  }
  y -= 6
  s += `BT /F3 13 Tf 0.35 0.38 0.45 rg 72 ${y} Td (${esc(subtitle)}) Tj ET\n`
  y -= 36
  for (const line of wrap(body)) {
    if (y < 80) break
    if (line === '') {
      y -= 10
      continue
    }
    s += `BT /F2 11 Tf 0.2 0.22 0.28 rg 72 ${y} Td (${esc(line)}) Tj ET\n`
    y -= 17
  }
  s += `BT /F2 8 Tf 0.55 0.57 0.63 rg 72 45 Td (Placeholder document - replace with your real work. Generated for layout preview.) Tj ET\n`

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>',
    `<< /Length ${s.length} >>\nstream\n${s}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

// ---------- editorial SVG thumbnails ----------
const hash = (s) => [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381)

const CATEGORY_MARKS = {
  'case-studies': (h) =>
    `<circle cx="${560 + (h % 80)}" cy="${140 + (h % 60)}" r="150" fill="#2a61c9" opacity="0.9"/>
     <circle cx="${560 + (h % 80)}" cy="${140 + (h % 60)}" r="150" fill="none" stroke="#101a2d" stroke-width="2" transform="translate(14 14)"/>`,
  reports: (h) => {
    let bars = ''
    for (let i = 0; i < 5; i++) {
      const bh = 60 + ((h >> (i * 3)) % 130)
      bars += `<rect x="${500 + i * 52}" y="${330 - bh}" width="34" height="${bh}" fill="${i === 2 ? '#2a61c9' : '#bfe6d2'}"/>`
    }
    return bars
  },
  content: (h) =>
    `<path d="M 520 ${120 + (h % 40)} q 60 -70 120 0 t 120 0" fill="none" stroke="#2a61c9" stroke-width="26" stroke-linecap="round"/>
     <path d="M 520 ${210 + (h % 40)} q 60 -70 120 0 t 120 0" fill="none" stroke="#bfe6d2" stroke-width="26" stroke-linecap="round"/>`,
  decks: (h) =>
    `<rect x="500" y="${90 + (h % 30)}" width="220" height="150" rx="8" fill="#bfe6d2"/>
     <rect x="530" y="${120 + (h % 30)}" width="220" height="150" rx="8" fill="#2a61c9"/>`,
  social: (h) =>
    `<rect x="540" y="${80 + (h % 40)}" width="160" height="250" rx="24" fill="#2a61c9"/>
     <path d="M 595 ${165 + (h % 40)} l 60 40 l -60 40 z" fill="#eef3fa"/>`,
}

function makeThumb(item) {
  const h = hash(item.id)
  const mark = (CATEGORY_MARKS[item.category] || CATEGORY_MARKS.reports)(h)
  const words = item.title.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 20) {
      lines.push(line.trim())
      line = w
    } else line += ' ' + w
  }
  if (line.trim()) lines.push(line.trim())
  const titleSvg = lines
    .slice(0, 4)
    .map(
      (l, i) =>
        `<text x="56" y="${430 + i * 42}" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="bold" fill="#101a2d">${l
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</text>`
    )
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#eef3fa"/>
  <rect width="800" height="14" fill="#2a61c9"/>
  ${mark}
  <text x="56" y="86" font-family="Helvetica, Arial, sans-serif" font-size="15" letter-spacing="3" fill="#2a61c9">${item.category.toUpperCase().replace('-', ' ')}</text>
  ${titleSvg}
  <text x="56" y="560" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#878da0">PLACEHOLDER — ${item.date}</text>
</svg>`
}

// ---------- write everything ----------
const workDir = path.join(root, 'public/work')
const thumbDir = path.join(workDir, 'thumbs')
fs.mkdirSync(thumbDir, { recursive: true })

let pdfCount = 0
let thumbCount = 0
for (const item of items) {
  fs.writeFileSync(path.join(root, 'public', item.thumbnail.replace(/^\//, '')), makeThumb(item))
  thumbCount++
  if (item.embedType === 'pdf') {
    fs.writeFileSync(
      path.join(root, 'public', item.embedUrl.replace(/^\//, '')),
      makePdf({
        eyebrow: `${item.company}  ·  ${item.date}`,
        title: item.title,
        subtitle: item.description,
        body: item.longWriteup + '\n\nThis is a placeholder PDF generated so you can preview the layout and the inline PDF viewer. Drop your real file into public/work/ and update the embedUrl for this item (or use the /admin page while running npm run dev).',
      })
    )
    pdfCount++
  }
  if (item.embedType === 'image' && item.embedUrl.endsWith('.svg')) {
    // full-size image embeds reuse the thumbnail art at higher fidelity
    fs.writeFileSync(path.join(root, 'public', item.embedUrl.replace(/^\//, '')), makeThumb(item))
  }
}

fs.writeFileSync(
  path.join(root, 'public/resume.pdf'),
  makePdf({
    eyebrow: 'Resume',
    title: 'Miguel Ortiz',
    subtitle: 'Marketing Strategist · MTM · Customer Stories, Content, and Growth',
    body: 'This is a placeholder resume PDF. Replace it with your real resume: drop your file at public/resume.pdf (keep the same filename) and it will appear here and in the download button automatically.\n\nExperience, education, and skills go here.',
  })
)

fs.writeFileSync(
  path.join(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2a61c9"/><text x="32" y="43" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#fff">M</text></svg>`
)

console.log(`Generated ${pdfCount} PDFs, ${thumbCount} thumbnails, resume.pdf, favicon.svg`)
