/**
 * Opportunity Center.
 *
 * Identifies audiences worth acting on. Nothing here executes anything — the
 * Automation Engine will consume these later. Each opportunity carries the
 * audience size so a future campaign builder can target it directly.
 */

import { daysSince, type RawData } from './gather'
import type { CustomerIntelligence, LoyaltyIntelligence, Opportunity, ReviewIntelligence } from './types'
import { POSITIVE_THRESHOLD } from './reviews'

/** Birthdays this far ahead are worth preparing a message for. */
const BIRTHDAY_LOOKAHEAD_DAYS = 14

export function findOpportunities(params: {
  raw: RawData
  customers: CustomerIntelligence
  loyalty: LoyaltyIntelligence
  reviews: ReviewIntelligence
  now?: number
}): Opportunity[] {
  const { raw, customers, loyalty, reviews } = params
  const now = params.now ?? Date.now()
  const out: Opportunity[] = []

  // ── Reactivation ────────────────────────────────────────────────────────────
  if (customers.inactiveGuests.length > 0) {
    const withPoints = customers.inactiveGuests.filter(g => g.points > 0)
    out.push({
      kind: 'reactivation',
      title: 'Win back guests who have drifted',
      description:
        `${customers.inactiveGuests.length} members have not visited in over a month` +
        `${withPoints.length ? `, and ${withPoints.length} of them still have unspent points to come back for` : ''}.`,
      audienceSize: customers.inactiveGuests.length,
      supportingMetrics: {
        inactive: customers.inactiveGuests.length,
        with_unspent_points: withPoints.length,
        longest_gap_days: customers.inactiveGuests[0]?.daysInactive ?? 0,
      },
    })
  }

  // ── Birthdays ───────────────────────────────────────────────────────────────
  const upcoming = raw.members.filter(m => {
    if (!m.birthday) return false
    const days = daysUntilNextBirthday(m.birthday, now)
    return days !== null && days <= BIRTHDAY_LOOKAHEAD_DAYS
  })
  if (upcoming.length > 0) {
    out.push({
      kind: 'birthday',
      title: `${upcoming.length} ${upcoming.length === 1 ? 'birthday' : 'birthdays'} in the next ${BIRTHDAY_LOOKAHEAD_DAYS} days`,
      description:
        'Birthday messages get opened more than any other campaign, and give a natural reason to visit.',
      audienceSize: upcoming.length,
      supportingMetrics: {
        upcoming_birthdays: upcoming.length,
        window_days: BIRTHDAY_LOOKAHEAD_DAYS,
      },
    })
  }

  // ── VIPs ────────────────────────────────────────────────────────────────────
  const vips = customers.topGuests.filter(g => g.visits >= 3)
  if (vips.length > 0) {
    out.push({
      kind: 'vip',
      title: `${vips.length} regulars worth recognising`,
      description:
        `Your most frequent guests have visited ${vips.reduce((s, g) => s + g.visits, 0)} times between them. ` +
        'Recognising them by name — or with something small — is what turns a regular into an advocate.',
      audienceSize: vips.length,
      supportingMetrics: {
        regulars: vips.length,
        combined_visits: vips.reduce((s, g) => s + g.visits, 0),
        top_spend: vips[0]?.totalSpent ?? 0,
      },
    })
  }

  // ── Tier upgrades ───────────────────────────────────────────────────────────
  // Members within reach of the next tier respond well to being told so.
  const nearSilver = raw.members.filter(m => m.tier === 'bronze' && m.points_balance >= 350 && m.points_balance < 500)
  if (nearSilver.length > 0) {
    out.push({
      kind: 'tier_upgrade',
      title: `${nearSilver.length} members are close to Silver`,
      description:
        'Telling guests how few points they need is one of the few messages that reliably brings forward a visit.',
      audienceSize: nearSilver.length,
      supportingMetrics: {
        near_silver: nearSilver.length,
        closest_points: Math.max(...nearSilver.map(m => m.points_balance)),
      },
    })
  }

  // ── Review recovery ─────────────────────────────────────────────────────────
  if (reviews.negativeCount > 0) {
    out.push({
      kind: 'review_recovery',
      title: `${reviews.negativeCount} unhappy ${reviews.negativeCount === 1 ? 'guest' : 'guests'} to follow up`,
      description:
        `Guests who rated below ${POSITIVE_THRESHOLD} stars stayed private rather than posting publicly. ` +
        'A personal reply is the difference between a lost guest and a recovered one.',
      audienceSize: reviews.negativeCount,
      supportingMetrics: {
        negative_responses: reviews.negativeCount,
        average_rating: reviews.averageRating ?? 'n/a',
      },
    })
  }

  return out.sort((a, b) => b.audienceSize - a.audienceSize)
}

/**
 * Days until the next occurrence of a birthday, ignoring the stored year.
 * Returns null for values that are not a usable date.
 */
function daysUntilNextBirthday(birthday: string, now: number): number | null {
  const parsed = new Date(birthday)
  if (Number.isNaN(parsed.getTime())) return null

  const today = new Date(now)
  const next = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate())
  if (next.getTime() < today.getTime()) next.setFullYear(today.getFullYear() + 1)

  return Math.ceil((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}
