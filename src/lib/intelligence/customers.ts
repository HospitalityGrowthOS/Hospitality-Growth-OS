/**
 * Customer intelligence — who is coming back, who has drifted away.
 */

import { daysSince, growth, windowBounds, type RawData } from './gather'
import type { CustomerIntelligence, InactiveGuest, TopGuest } from './types'

/** A member is "inactive" once this long has passed without a visit. */
export const INACTIVE_AFTER_DAYS = 30

export function computeCustomerIntelligence(raw: RawData, now = Date.now()): CustomerIntelligence {
  const { since30, since60 } = windowBounds(now)

  const totalGuests      = raw.guests.length
  const newGuests30d     = raw.guests.filter(g => g.created_at >= since30).length
  const newGuestsPrev30d = raw.guests.filter(g => g.created_at >= since60 && g.created_at < since30).length

  // A guest with more than one visit inside the window is a returning guest.
  const visitsByGuest = new Map<string, number>()
  for (const v of raw.visits) {
    if (!v.guest_id || v.visited_at < since30) continue
    visitsByGuest.set(v.guest_id, (visitsByGuest.get(v.guest_id) ?? 0) + 1)
  }
  const uniqueVisitors30d  = visitsByGuest.size
  const returningGuests30d = Array.from(visitsByGuest.values()).filter(n => n > 1).length

  const loyaltyMembers = raw.members.length
  const newMembers30d  = raw.members.filter(m => (m.enrolled_at ?? '') >= since30).length

  const tierCounts = new Map<string, number>()
  for (const m of raw.members) tierCounts.set(m.tier, (tierCounts.get(m.tier) ?? 0) + 1)
  const tierDistribution = Array.from(tierCounts.entries())
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => b.count - a.count)

  // Inactive members, worst first. Enrolment date stands in for guests who have
  // never visited, so someone who joined and never returned still surfaces.
  const guestsById = new Map(raw.guests.map(g => [g.id, g]))
  const inactiveGuests: InactiveGuest[] = raw.members
    .map(m => {
      const guest = m.guest_id ? guestsById.get(m.guest_id) : undefined
      const reference = guest?.last_visit_at ?? m.last_activity_at ?? m.enrolled_at
      const days = daysSince(reference, now)
      if (days === null || days < INACTIVE_AFTER_DAYS) return null
      return {
        id: guest?.id ?? m.id,
        name: guest?.name ?? null,
        tier: m.tier,
        points: m.points_balance,
        daysInactive: days,
      }
    })
    .filter((g): g is InactiveGuest => g !== null)
    .sort((a, b) => b.daysInactive - a.daysInactive)

  const topGuests: TopGuest[] = [...raw.guests]
    .filter(g => g.total_visits > 0)
    .sort((a, b) => b.total_spent - a.total_spent || b.total_visits - a.total_visits)
    .slice(0, 5)
    .map(g => ({
      id: g.id,
      name: g.name,
      tier: g.loyalty_tier,
      visits: g.total_visits,
      totalSpent: g.total_spent,
    }))

  return {
    totalGuests,
    newGuests30d,
    newGuestsPrev30d,
    returningGuests30d,
    uniqueVisitors30d,
    loyaltyMembers,
    newMembers30d,
    tierDistribution,
    inactiveGuests,
    topGuests,
    insights: buildInsights({
      totalGuests, newGuests30d, newGuestsPrev30d,
      returningGuests30d, uniqueVisitors30d,
      inactiveGuests, tierDistribution,
    }),
  }
}

/**
 * Natural-language observations. Every sentence restates figures computed
 * above — nothing here is inferred or estimated.
 */
function buildInsights(m: {
  totalGuests: number
  newGuests30d: number
  newGuestsPrev30d: number
  returningGuests30d: number
  uniqueVisitors30d: number
  inactiveGuests: InactiveGuest[]
  tierDistribution: { tier: string; count: number }[]
}): string[] {
  const out: string[] = []

  const change = growth(m.newGuests30d, m.newGuestsPrev30d)
  if (change !== null && Math.abs(change) >= 10) {
    out.push(
      change > 0
        ? `New guests are up ${change}% on the previous 30 days (${m.newGuests30d} vs ${m.newGuestsPrev30d}).`
        : `New guests are down ${Math.abs(change)}% on the previous 30 days (${m.newGuests30d} vs ${m.newGuestsPrev30d}).`
    )
  } else if (m.newGuests30d > 0) {
    out.push(`${m.newGuests30d} new ${m.newGuests30d === 1 ? 'guest' : 'guests'} joined in the last 30 days.`)
  }

  if (m.uniqueVisitors30d > 0) {
    const share = Math.round((m.returningGuests30d / m.uniqueVisitors30d) * 100)
    out.push(
      `${m.returningGuests30d} of ${m.uniqueVisitors30d} guests who visited in the last 30 days came more than once (${share}%).`
    )
  }

  // Group inactive members by tier, so the sentence names something specific.
  const byTier = new Map<string, number>()
  for (const g of m.inactiveGuests) byTier.set(g.tier, (byTier.get(g.tier) ?? 0) + 1)
  const worst = Array.from(byTier.entries()).sort((a, b) => b[1] - a[1])[0]
  if (worst && worst[1] > 0) {
    const [tier, count] = worst
    out.push(
      `${count} ${tier.charAt(0).toUpperCase() + tier.slice(1)} ${count === 1 ? 'member has' : 'members have'} not visited in over ${INACTIVE_AFTER_DAYS} days.`
    )
  }

  const gold = m.tierDistribution.find(t => t.tier === 'gold')
  if (gold && gold.count > 0) {
    out.push(`${gold.count} ${gold.count === 1 ? 'guest has' : 'guests have'} reached Gold.`)
  }

  return out
}
