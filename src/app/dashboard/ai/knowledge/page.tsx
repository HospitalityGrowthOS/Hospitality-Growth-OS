export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import {
  FAQ_TOPIC_HINTS,
  FAQ_TOPIC_LABELS,
  resolveFaq,
  type FaqTopic,
} from '@/lib/ai'
import KnowledgeEditor, {
  type KnowledgeField,
  type KnowledgeSection,
} from './KnowledgeEditor'

/**
 * How topics are grouped for the owner. Purely presentational — the resolver
 * doesn't care about grouping, so a new category is one entry here plus a topic
 * in FAQ_TOPICS.
 */
const SECTIONS: { title: string; description: string; topics: FaqTopic[] }[] = [
  {
    title: 'The basics',
    description: 'What guests ask most often.',
    topics: ['restaurant_info', 'opening_hours', 'address'],
  },
  {
    title: 'Getting here and booking',
    description: 'Practical questions before a visit.',
    topics: ['parking', 'reservations', 'accessibility'],
  },
  {
    title: 'Food and drink',
    description: 'The assistant always defers to your team on allergen specifics.',
    topics: ['menu', 'allergens', 'delivery'],
  },
  {
    title: 'In the venue',
    description: 'Questions that come up once guests are with you.',
    topics: ['payment', 'wifi', 'events'],
  },
  {
    title: 'Anything else',
    description: 'Whatever else your guests regularly ask.',
    topics: ['custom'],
  },
]

export default async function KnowledgePage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const settings = (venue.settings || {}) as Record<string, unknown>
  const overrides = (settings.faq && typeof settings.faq === 'object'
    ? settings.faq
    : {}) as Record<string, unknown>

  // Resolved answers include values derived from venue fields, so the editor can
  // show what the assistant would say today even where nothing was written.
  const resolved = resolveFaq({
    id: venue.id,
    name: venue.name,
    type: venue.type,
    city: venue.city,
    address: venue.address,
    settings: venue.settings,
  })

  const sections: KnowledgeSection[] = SECTIONS.map(section => ({
    title: section.title,
    description: section.description,
    fields: section.topics.map<KnowledgeField>(topic => {
      const written = typeof overrides[topic] === 'string' ? (overrides[topic] as string) : ''
      const label = FAQ_TOPIC_LABELS[topic]
      const resolvedValue = resolved[label] ?? null
      return {
        topic,
        label,
        hint: FAQ_TOPIC_HINTS[topic],
        value: written,
        // Only show as "derived" when the answer didn't come from the owner.
        derived: written ? null : resolvedValue,
      }
    }),
  }))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <KnowledgeEditor sections={sections} />
    </div>
  )
}
