/**
 * Growth Intelligence Engine.
 *
 * Import from '@/lib/intelligence'. Business calculations live here, never in
 * React components, so the Automation Engine, AI Copilot and Founder Dashboard
 * can consume exactly the same numbers the dashboard shows.
 */

import { FAQ_TOPIC_LABELS, missingFaqTopics, type VenueLike } from '@/lib/ai'
import { gatherRawData, windowBounds } from './gather'
import { computeCustomerIntelligence } from './customers'
import { computeLoyaltyIntelligence } from './loyalty'
import { computeReviewIntelligence } from './reviews'
import { computeHealthScore } from './health'
import { generateRecommendations } from './recommendations'
import { findOpportunities } from './opportunities'
import { buildTimeline } from './timeline'
import { rate } from './gather'
import type { IntelligenceSnapshot } from './types'

export * from './types'
export { WINDOW_DAYS } from './gather'
export { INACTIVE_AFTER_DAYS } from './customers'
export { POSITIVE_THRESHOLD } from './reviews'
export { RULE_COUNT } from './recommendations'
export { generateBusinessSummary, type SummaryPeriod } from './insights'
export { persistRecommendations, loadStoredRecommendations } from './store'

/**
 * Computes the full picture for a venue in one pass.
 *
 * Every figure comes from platform data. Where a metric has no underlying data
 * it is null, and callers render a placeholder rather than a zero that reads
 * like a real measurement.
 */
export async function getIntelligence(venue: VenueLike): Promise<IntelligenceSnapshot> {
  const now = Date.now()
  const { since30 } = windowBounds(now)
  const raw = await gatherRawData(venue.id)

  const customers = computeCustomerIntelligence(raw, now)
  const loyalty   = computeLoyaltyIntelligence(raw, now)
  const reviews   = computeReviewIntelligence(raw, now)
  const health    = computeHealthScore(raw, now)

  const unansweredTopics = missingFaqTopics(venue).map(t => FAQ_TOPIC_LABELS[t])

  const intentCounts = new Map<string, number>()
  for (const m of raw.messages) {
    if (m.intent) intentCounts.set(m.intent, (intentCounts.get(m.intent) ?? 0) + 1)
  }
  const topIntents = Array.from(intentCounts.entries())
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)

  const recommendations = generateRecommendations({
    raw, customers, loyalty, reviews, unansweredTopics, topIntents,
  })

  const opportunities = findOpportunities({ raw, customers, loyalty, reviews, now })
  const timeline = buildTimeline({ raw, recommendations })

  const conversations30d = raw.conversations.filter(c => c.created_at >= since30).length
  const escalations30d = raw.conversations.filter(
    c => c.created_at >= since30 && c.status === 'escalated'
  ).length

  return {
    health,
    customers,
    loyalty,
    reviews,
    recommendations,
    opportunities,
    timeline,
    assistant: {
      conversations30d,
      escalations30d,
      escalationRate: rate(escalations30d, conversations30d),
      aiFailures30d: raw.aiCalls.filter(c => c.created_at >= since30 && !c.success).length,
      pendingReservations: raw.reservations.length,
      unansweredTopics,
    },
    generatedAt: new Date(now).toISOString(),
  }
}
