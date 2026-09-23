# Miguel Ortiz — Portfolio

A static portfolio site built with **Vite + React**. Work is organized by item type
(Case Studies, Reports & Strategy, Content Marketing, Presentations & Decks, Social & Video)
in horizontal carousels; hovering a card slides out a cobalt info tab, clicking expands the
item to a full view with the embedded artifact.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## Add or edit work — two ways

### 1. The easy way: the local admin page

While `npm run dev` is running, open **http://localhost:5173/admin**:

- **Drag PDFs or images onto the dropzone** — they're copied into `public/work/` and become
  new draft items automatically.
- **PDFs are auto-filled**: page 1 is rendered as the thumbnail, and Claude reads the first
  pages to draft the title, description, goal, write-up, and tags. The **✨ Auto-fill** button
  on any row runs the same thing (for `link` items it fetches the page's title/description/
  preview image first). Auto-fill only fills fields that are empty — it never overwrites
  something you typed.
- **Paste a URL in the "Add link" box** to add work that isn't a file: Instagram reels
  (`instagram.com/reel/…` → embeds with Instagram's player), Google Slides / Canva decks,
  or any live page (those get scraped + auto-filled).
- **Drag rows** to reorder items, or drag them into another category's list to re-categorize.
- Click **Edit** on any row to adjust any field by hand — including **Thumbnail crop**
  (fill-and-crop vs. fit-whole-image, and which part to show: top/center/bottom) with a
  live preview of exactly how the card will look.
- Click **Save changes** — this rewrites `src/data/work.json`.

**Auto-fill needs Claude access** (one-time setup, pick either):

- Log in the Claude Code CLI: run `claude` in Terminal once and complete the login, **or**
- Set an API key before starting the dev server: `export ANTHROPIC_API_KEY=sk-ant-…`

If neither is available, the text fields show an error explaining what to set up — but the
first-page thumbnail still works (it's rendered locally, no Claude needed), and every field
can still be edited by hand.

The admin page is **dev-only**: it is not part of the deployed site, so there's nothing to
secure or maintain in production. After saving, publish by deploying (see below).

### 2. The manual way: edit the data file

Every work item is one entry in [`src/data/work.json`](src/data/work.json):

```json
{
  "id": "unique-slug",
  "title": "Project title",
  "category": "case-studies",        // must match an id in src/data/categories.js
  "company": "Client name",          // shown on the hover tab
  "goal": "One sentence goal",       // shown on the hover tab
  "description": "One-liner for the card",
  "longWriteup": "Longer story for the expanded view (\\n\\n for paragraphs)",
  "embedType": "pdf",                // pdf | slides | reel | image | link
  "embedUrl": "/work/my-file.pdf",   // file in public/work/ or an external URL
  "thumbnail": "/work/thumbs/my-thumb.png",
  "tags": ["Copywriting", "Salesforce"],
  "date": "2026-05",
  "featured": true
}
```

**Where files go:** drop PDFs/images into `public/work/` and thumbnails into
`public/work/thumbs/`, then reference them as `/work/…` paths.

**Embed types:**

| embedType | embedUrl should be | Notes |
| --------- | ------------------ | ----- |
| `pdf` | `/work/file.pdf` | Renders inline; on phones it shows the thumbnail + a "View PDF" button instead |
| `slides` | Published Google Slides URL (File → Share → Publish to web) or Canva share link | Shown in a responsive 16:9 frame |
| `reel` | `https://www.instagram.com/reel/…/` | Official Instagram embed, lazy-loaded |
| `image` | `/work/image.png` | Add an optional `"images": []` array for a gallery, `"caption"` for a caption |
| `link` | Any live URL | Renders a rich preview card |

**Categories** (rename/reorder/add) live in [`src/data/categories.js`](src/data/categories.js).
**Your name, headline, about text, skills, and links** live in [`src/data/profile.js`](src/data/profile.js).
**Resume:** replace `public/resume.pdf` with your real resume (keep the filename).

## Regenerating placeholder assets

The current PDFs/thumbnails are placeholders. They were generated with:

```bash
node scripts/make-placeholders.mjs
```

You can delete that script once your real work is in.

## Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects Vite; accept the defaults and click **Deploy**.

Every `git push` redeploys automatically. `vercel.json` is already configured so
deep links like `/about` work.

### Custom domain later

In the Vercel project: **Settings → Domains → Add**, enter your domain, and follow the DNS
instructions (usually adding an `A` record or `CNAME` at your registrar). HTTPS is automatic.

## Design tokens

Colors, fonts, and spacing are CSS variables at the top of
[`src/styles/global.css`](src/styles/global.css) — change `--accent` there to retheme the
whole site.
