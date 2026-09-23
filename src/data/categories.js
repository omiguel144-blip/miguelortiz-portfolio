// Category config — rename, reorder, or add sections here.
// `id` must match the `category` field on items in work.json.
export const categories = [
  {
    id: 'case-studies',
    label: 'Case Studies',
    blurb:
      'Deep-dive project stories — situation, task, action, result — with the artifacts that shipped along the way.',
  },
  {
    id: 'reports',
    label: 'Reports & Strategy',
    blurb: 'Research syntheses, market sizing, strategy memos, and competitive analyses.',
  },
  {
    id: 'content',
    label: 'Content Marketing',
    blurb: 'Campaigns, copywriting, email, and brand voice work.',
  },
  {
    id: 'decks',
    label: 'Presentations & Decks',
    blurb: 'Pitch decks, consulting presentations, and workshop slides.',
  },
  {
    id: 'social',
    label: 'Social & Video',
    blurb: 'Short-form video and Instagram work.',
  },
]

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))
