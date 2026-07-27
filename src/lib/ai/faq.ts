/**
 * FAQ layer.
 *
 * Answers come from three places, in order of preference:
 *   1. `venues.settings.faq` — per-venue overrides written by the owner
 *   2. structured venue fields already captured elsewhere (address, hours)
 *   3. nothing — the topic is omitted entirely
 *
 * Omission is deliberate. An unanswered topic simply isn't given to the model,
 * so the assistant says it will check rather than inventing a WiFi password.
 *
 * Adding editable FAQs later means writing to `settings.faq`; no schema change
 * and no change here.
 */

import type { VenueContext } from './types'

/** Topics the assistant knows how to talk about. */
export const FAQ_TOPICS = [
  'opening_hours',
  'address',
  'parking',
  'wifi',
  'menu',
  'allergens',
  'reservations',
  'payment',
  'accessibility',
] as const

export type FaqTopic = (typeof FAQ_TOPICS)[number]

export const FAQ_TOPIC_LABELS: Record<FaqTopic, string> = {
  opening_hours: 'Opening hours',
  address:       'Address',
  parking:       'Parking',
  wifi:          'WiFi',
  menu:          'Menu',
  allergens:     'Allergens',
  reservations:  'Reservations',
  payment:       'Payment methods',
  accessibility: 'Accessibility',
}

/** Shape of a venue row as far as the FAQ layer is concerned. */
export interface VenueLike {
  id: string
  name: string
  type?: string | null
  city?: string | null
  address?: string | null
  settings?: unknown
}

function readSettings(venue: VenueLike): Record<string, unknown> {
  return (venue.settings && typeof venue.settings === 'object'
    ? venue.settings
    : {}) as Record<string, unknown>
}

/** Owner-written overrides, e.g. { wifi: "Ask any team member for today's code" }. */
function readOverrides(settings: Record<string, unknown>): Record<string, string> {
  const raw = settings.faq
  if (!raw || typeof raw !== 'object') return {}

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/**
 * Opening hours are stored as a day → string map. Rendered compactly so the
 * prompt stays short.
 */
function renderOpeningHours(settings: Record<string, unknown>): string | null {
  const hours = settings.opening_hours
  if (!hours || typeof hours !== 'object') return null

  const parts = Object.entries(hours as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([day, v]) => `${day} ${String(v).trim()}`)

  return parts.length ? parts.join(', ') : null
}

/**
 * Builds the answer map. Only topics with a real answer are included — callers
 * must not substitute a placeholder string, or the model will repeat it to a
 * guest as though it were fact.
 */
export function resolveFaq(venue: VenueLike): Record<string, string> {
  const settings = readSettings(venue)
  const overrides = readOverrides(settings)
  const faq: Record<string, string> = {}

  const derived: Partial<Record<FaqTopic, string | null>> = {
    opening_hours: renderOpeningHours(settings),
    address: venue.address
      ? [venue.address, venue.city].filter(Boolean).join(', ')
      : venue.city || null,
    menu: typeof settings.menu_url === 'string' && settings.menu_url.trim()
      ? settings.menu_url.trim()
      : null,
  }

  for (const topic of FAQ_TOPICS) {
    const answer = overrides[topic] ?? derived[topic] ?? null
    if (answer) faq[FAQ_TOPIC_LABELS[topic]] = answer
  }

  return faq
}

/** Topics with no answer yet — surfaced in the dashboard so owners can fill them in. */
export function missingFaqTopics(venue: VenueLike): FaqTopic[] {
  const resolved = resolveFaq(venue)
  return FAQ_TOPICS.filter(topic => !(FAQ_TOPIC_LABELS[topic] in resolved))
}

/** Assembles the context object the prompts consume. */
export function buildVenueContext(venue: VenueLike): VenueContext {
  const settings = readSettings(venue)
  const assistantName =
    typeof settings.ai_persona_name === 'string' && settings.ai_persona_name.trim()
      ? settings.ai_persona_name.trim()
      : 'Sofia'

  return {
    id:      venue.id,
    name:    venue.name,
    type:    venue.type ?? null,
    city:    venue.city ?? null,
    address: venue.address ?? null,
    assistantName,
    faq:     resolveFaq(venue),
  }
}
