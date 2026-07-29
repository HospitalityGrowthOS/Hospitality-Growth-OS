/**
 * Trigger catalogue.
 *
 * A trigger is an event name plus an optional filter. This file holds only
 * *descriptors* — data the workflow builder renders from. The engine matches
 * workflows by string comparison and never consults this list, so an industry
 * module can emit an event that has no descriptor yet and workflows listening
 * for it still run.
 *
 * Adding a trigger is adding an entry here. There is no code path to change.
 */

import type { EventName, TriggerDescriptor } from './types'

export const TRIGGERS: TriggerDescriptor[] = [
  {
    event: 'customer.registered',
    label: 'Guest registers',
    description: 'A new guest record is created, from any channel.',
    category: 'Guests',
    provides: ['guest.name', 'guest.phone', 'guest.email'],
  },
  {
    event: 'loyalty.member_joined',
    label: 'Guest joins loyalty',
    description: 'A guest enrols in the loyalty programme.',
    category: 'Loyalty',
    provides: ['guest.name', 'member.tier', 'member.points_balance'],
  },
  {
    event: 'loyalty.tier_changed',
    label: 'Guest reaches a new tier',
    description: 'A member moves up or down a tier.',
    category: 'Loyalty',
    provides: ['event.from_tier', 'event.to_tier', 'member.points_balance'],
  },
  {
    event: 'loyalty.points_awarded',
    label: 'Points awarded',
    description: 'Points are credited to a member for any reason.',
    category: 'Loyalty',
    provides: ['event.points', 'member.points_balance'],
  },
  {
    event: 'visit.recorded',
    label: 'Visit recorded',
    description: 'A visit is logged against a guest.',
    category: 'Guests',
    provides: ['event.spend_amount', 'event.party_size', 'guest.total_visits'],
  },
  {
    event: 'reservation.created',
    label: 'Reservation created',
    description: 'A booking request is captured.',
    category: 'Reservations',
    provides: ['event.party_size', 'event.requested_for'],
  },
  {
    event: 'reservation.cancelled',
    label: 'Reservation cancelled',
    description: 'A booking is withdrawn.',
    category: 'Reservations',
    provides: ['event.reason'],
  },
  {
    event: 'review.received',
    label: 'Review submitted',
    description: 'A guest answers a review request, at any rating.',
    category: 'Reviews',
    provides: ['event.rating', 'event.feedback'],
  },
  {
    event: 'review.positive',
    label: 'Positive review',
    description: 'A guest rates at or above the positive threshold.',
    category: 'Reviews',
    provides: ['event.rating', 'event.feedback'],
  },
  {
    event: 'review.negative',
    label: 'Negative review',
    description: 'A guest rates below the positive threshold.',
    category: 'Reviews',
    provides: ['event.rating', 'event.feedback'],
  },
  {
    event: 'ai.recommendation.created',
    label: 'AI recommendation generated',
    description: 'Growth Intelligence raises a new recommendation.',
    category: 'Intelligence',
    provides: ['event.type', 'event.priority', 'event.confidence'],
  },
  {
    event: 'business.health.changed',
    label: 'Business health changes',
    description: 'The overall health score moves.',
    category: 'Intelligence',
    provides: ['event.score', 'event.previous_score'],
  },
  {
    event: 'faq.unknown_spike',
    label: 'Assistant cannot answer',
    description: 'Guests repeatedly ask something the knowledge base lacks.',
    category: 'Assistant',
    provides: ['event.topic', 'event.count'],
  },
  {
    event: 'conversation.escalated',
    label: 'Conversation escalated',
    description: 'The assistant hands a guest to a person.',
    category: 'Assistant',
    provides: ['event.reason', 'event.conversation_id'],
  },
]

const BY_EVENT = new Map(TRIGGERS.map(t => [t.event as string, t]))

export function describeTrigger(event: string): TriggerDescriptor | null {
  return BY_EVENT.get(event) ?? null
}

/** Builder groupings, in a stable order. */
export function triggersByCategory(): { category: string; triggers: TriggerDescriptor[] }[] {
  const order: string[] = []
  const groups = new Map<string, TriggerDescriptor[]>()
  for (const t of TRIGGERS) {
    if (!groups.has(t.category)) { groups.set(t.category, []); order.push(t.category) }
    groups.get(t.category)!.push(t)
  }
  return order.map(category => ({ category, triggers: groups.get(category)! }))
}

/**
 * Whether a workflow's trigger matches an event.
 *
 * `triggerConfig` narrows an event without needing a distinct event name — a
 * workflow can listen for `review.received` only when the rating is at most 3,
 * rather than requiring the emitter to invent `review.three_star`.
 */
export function triggerMatches(
  triggerEvent: string,
  triggerConfig: Record<string, unknown>,
  event: { name: EventName; payload: Record<string, unknown> }
): boolean {
  if (triggerEvent !== event.name) return false

  // Every key in the filter must equal the same key in the payload.
  for (const [key, expected] of Object.entries(triggerConfig ?? {})) {
    if (expected === undefined || expected === null || expected === '') continue
    if (String(event.payload[key]) !== String(expected)) return false
  }
  return true
}
