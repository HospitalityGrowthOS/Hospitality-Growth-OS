/**
 * AI business insights.
 *
 * The model never produces a number. It receives figures this module already
 * computed and turns them into prose — so a hallucinated statistic is not
 * possible, only a clumsy sentence.
 *
 * Generated on demand rather than on page load: a model call per render would
 * be slow and would burn budget on views nobody reads.
 */

import { callModel } from '@/lib/ai/client'
import { aiFailure, type AiResult } from '@/lib/ai/types'
import type { IntelligenceSnapshot } from './types'

export type SummaryPeriod = 'daily' | 'weekly'

const SYSTEM = `You write a short business briefing for the owner of a hospitality venue.

You will be given figures already calculated from their platform. Rules:
- Use only the figures given. Never introduce a number that is not in the input.
- Never estimate revenue, bookings or anything financial — that data does not exist.
- Lead with whatever matters most, not with whatever appears first.
- Three or four sentences. No headings, no bullets, no greeting.
- Plain, direct English. Write as though briefing a busy owner between services.
- If the figures are too thin to say anything useful, say exactly that in one sentence.`

/** Flattens the snapshot into the facts worth briefing on. */
function factsFor(snapshot: IntelligenceSnapshot, period: SummaryPeriod): string {
  const { health, customers, loyalty, reviews, assistant, recommendations } = snapshot

  const lines: string[] = [
    `Period: ${period === 'daily' ? 'last 24 hours in context of the last 30 days' : 'last 30 days'}`,
    health.overall !== null
      ? `Business health score: ${health.overall}/100 (${health.components.filter(c => c.score !== null).map(c => `${c.label} ${c.score}`).join(', ')})`
      : 'Business health score: not enough data yet',
    `Guests: ${customers.totalGuests} total, ${customers.newGuests30d} new in 30 days (previous 30: ${customers.newGuestsPrev30d})`,
    `Returning: ${customers.returningGuests30d} of ${customers.uniqueVisitors30d} visitors came more than once`,
    `Loyalty: ${loyalty.totalMembers} members, ${loyalty.pointsIssued} points issued, ${loyalty.pointsRedeemed} redeemed`,
    `Inactive members (30+ days): ${customers.inactiveGuests.length}`,
  ]

  if (reviews.requestsSent > 0) {
    lines.push(
      `Reviews: ${reviews.requestsCompleted} of ${reviews.requestsSent} requests answered` +
      (reviews.averageRating !== null ? `, average ${reviews.averageRating}/5` : '') +
      `, ${reviews.negativeCount} below 4 stars`
    )
  } else {
    lines.push('Reviews: no requests sent yet')
  }

  lines.push(
    `Assistant: ${assistant.conversations30d} conversations, ${assistant.escalations30d} escalated, ${assistant.aiFailures30d} failed AI requests`
  )
  if (assistant.unansweredTopics.length) {
    lines.push(`Assistant has no answer for: ${assistant.unansweredTopics.join(', ')}`)
  }
  if (recommendations.length) {
    lines.push(`Open recommendations: ${recommendations.map(r => r.title).join('; ')}`)
  }

  return lines.join('\n')
}

export async function generateBusinessSummary(params: {
  snapshot: IntelligenceSnapshot
  period: SummaryPeriod
  venueName: string
  venueId: string
}): Promise<AiResult<string>> {
  const { snapshot, period, venueName, venueId } = params

  // Nothing meaningful to brief on — say so without spending a call.
  const hasSignal =
    snapshot.customers.totalGuests > 0 ||
    snapshot.reviews.requestsSent > 0 ||
    snapshot.assistant.conversations30d > 0
  if (!hasSignal) {
    return aiFailure(
      'invalid_response',
      'There is no activity to summarise yet. Enrol a few guests and record some visits first.'
    )
  }

  const result = await callModel({
    system: SYSTEM,
    messages: [{ role: 'user', content: `${venueName}\n\n${factsFor(snapshot, period)}` }],
    maxTokens: 400,
    feature: 'business_insight',
    venueId,
  })

  return result.ok ? { ok: true, data: result.data.trim() } : result
}
