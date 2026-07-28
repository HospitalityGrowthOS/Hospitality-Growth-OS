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

import {
  DEFAULT_ASSISTANT_CONFIG,
  isReplyLength,
  isTone,
  type AssistantConfig,
  type VenueContext,
} from './types'

/**
 * Knowledge topics the assistant can speak to.
 *
 * Adding a topic here is the only change needed — the Knowledge Base UI renders
 * from this list, and the resolver picks it up automatically.
 */
export const FAQ_TOPICS = [
  'restaurant_info',
  'opening_hours',
  'address',
  'parking',
  'reservations',
  'menu',
  'allergens',
  'payment',
  'accessibility',
  'wifi',
  'delivery',
  'events',
  'custom',
] as const

export type FaqTopic = (typeof FAQ_TOPICS)[number]

export const FAQ_TOPIC_LABELS: Record<FaqTopic, string> = {
  restaurant_info: 'Restaurant information',
  opening_hours:   'Opening hours',
  address:         'Address',
  parking:         'Parking',
  reservations:    'Reservations',
  menu:            'Menu',
  allergens:       'Allergens',
  payment:         'Payment methods',
  accessibility:   'Accessibility',
  wifi:            'Wi-Fi',
  delivery:        'Delivery and takeaway',
  events:          'Events and private hire',
  custom:          'Anything else',
}

/** Guidance shown beside each field in the Knowledge Base editor. */
export const FAQ_TOPIC_HINTS: Record<FaqTopic, string> = {
  restaurant_info: 'What kind of place this is, the style of food, the atmosphere.',
  opening_hours:   'Filled in automatically from your opening hours, or override here.',
  address:         'Filled in automatically from your venue address, or add directions.',
  parking:         'Nearby car parks, street parking, how far away.',
  reservations:    'How guests book, how far ahead, minimum group size.',
  menu:            'A link to your menu, or the dishes you are known for.',
  allergens:       'How you handle allergies. The assistant always defers to your team on specifics.',
  payment:         'Cards accepted, cash only, tipping.',
  accessibility:   'Step-free access, accessible toilets, space for a wheelchair.',
  wifi:            'Whether there is guest Wi-Fi and how to get on it.',
  delivery:        'Whether you deliver, which platforms, the area you cover.',
  events:          'Private hire, large groups, set menus.',
  custom:          'Anything else guests often ask that does not fit above.',
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
    restaurant_info: venue.type ? `A ${venue.type}` : null,
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

/** Reads owner-set voice settings, falling back to defaults for anything unset. */
export function resolveAssistantConfig(venue: VenueLike): AssistantConfig {
  const settings = readSettings(venue)
  const raw = (settings.ai && typeof settings.ai === 'object'
    ? settings.ai
    : {}) as Record<string, unknown>

  return {
    tone: typeof raw.tone === 'string' && isTone(raw.tone)
      ? raw.tone
      : DEFAULT_ASSISTANT_CONFIG.tone,
    length: typeof raw.length === 'string' && isReplyLength(raw.length)
      ? raw.length
      : DEFAULT_ASSISTANT_CONFIG.length,
    houseRules: typeof raw.house_rules === 'string' && raw.house_rules.trim()
      ? raw.house_rules.trim()
      : null,
  }
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
    config:  resolveAssistantConfig(venue),
  }
}
