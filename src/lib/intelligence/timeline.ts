/**
 * Intelligence Timeline.
 *
 * A single chronological stream of business events, assembled from records that
 * already exist rather than a new event log. Future reporting and the
 * Automation Engine consume the same builder.
 */

import type { RawData } from './gather'
import type { Recommendation, TimelineEvent } from './types'
import { POSITIVE_THRESHOLD } from './reviews'

export function buildTimeline(params: {
  raw: RawData
  recommendations: Recommendation[]
  limit?: number
}): TimelineEvent[] {
  const { raw, recommendations } = params
  const limit = params.limit ?? 25
  const events: TimelineEvent[] = []

  const guestsById = new Map(raw.guests.map(g => [g.id, g]))
  const nameFor = (guestId: string | null) =>
    (guestId ? guestsById.get(guestId)?.name : null) ?? 'A guest'

  for (const m of raw.members) {
    if (m.enrolled_at) {
      events.push({
        kind: 'member_enrolled',
        title: `${nameFor(m.guest_id)} joined the loyalty programme`,
        detail: null,
        at: m.enrolled_at,
      })
    }
    if (m.tier_upgraded_at) {
      events.push({
        kind: 'tier_upgrade',
        title: `${nameFor(m.guest_id)} reached ${m.tier.charAt(0).toUpperCase() + m.tier.slice(1)}`,
        detail: `${m.points_balance} points`,
        at: m.tier_upgraded_at,
      })
    }
  }

  for (const r of raw.reviewRequests) {
    if (r.rating == null) continue
    const when = r.completed_at ?? r.created_at
    const negative = r.rating < POSITIVE_THRESHOLD
    events.push({
      kind: negative ? 'negative_feedback' : 'review_received',
      title: negative
        ? `${r.rating}-star feedback needs a response`
        : `${r.rating}-star review received`,
      detail: r.feedback ? r.feedback.slice(0, 140) : null,
      at: when,
    })
  }

  for (const a of raw.actionItems) {
    if (a.type !== 'conversation_escalation') continue
    events.push({
      kind: 'escalation',
      title: a.title,
      detail: `${a.priority} priority`,
      at: a.created_at,
    })
  }

  for (const r of raw.reservations) {
    events.push({
      kind: 'reservation_request',
      title: `Reservation request from ${r.guest_name ?? 'a guest'}`,
      detail: r.party_size ? `${r.party_size} people` : null,
      at: r.created_at,
    })
  }

  for (const rec of recommendations) {
    events.push({
      kind: 'recommendation',
      title: rec.title,
      detail: `${rec.priority} priority · ${rec.category}`,
      at: rec.generatedAt,
    })
  }

  return events
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
