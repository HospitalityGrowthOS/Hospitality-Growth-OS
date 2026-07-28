/**
 * Review intelligence — reputation, and whether guests are responding at all.
 *
 * Built from `review_requests`, which is what this platform actually sends and
 * collects. Public Google ratings are not read here; that arrives with the
 * Google integration.
 */

import { rate, windowBounds, type RawData, type RawReviewRequest } from './gather'
import type { ReviewIntelligence } from './types'

/** A request counts as "sent" once it has left the queue. */
const SENT_STATUSES = new Set(['sent', 'positive', 'negative'])

/** Ratings at or above this are treated as positive, matching the feedback flow. */
export const POSITIVE_THRESHOLD = 4

export function computeReviewIntelligence(raw: RawData, now = Date.now()): ReviewIntelligence {
  const { since90 } = windowBounds(now)
  const requests = raw.reviewRequests

  const sent = requests.filter(r => SENT_STATUSES.has(r.status))
  const completed = requests.filter(r => r.rating != null)

  const positiveCount = completed.filter(r => (r.rating ?? 0) >= POSITIVE_THRESHOLD).length
  const negativeCount = completed.length - positiveCount

  const averageRating = completed.length
    ? Number((completed.reduce((s, r) => s + (r.rating ?? 0), 0) / completed.length).toFixed(1))
    : null

  // Sentiment from the assistant's own classification of guest messages, which
  // is a different signal from star ratings and worth showing beside them.
  const sentimentCounts = new Map<string, number>()
  for (const m of raw.messages) {
    if (m.sentiment) sentimentCounts.set(m.sentiment, (sentimentCounts.get(m.sentiment) ?? 0) + 1)
  }
  const sentimentDistribution = Array.from(sentimentCounts.entries())
    .map(([sentiment, count]) => ({ sentiment, count }))

  const weeklyTrend = buildWeeklyTrend(completed.filter(r => (r.completed_at ?? r.created_at) >= since90), now)

  const recentNegative = completed
    .filter(r => (r.rating ?? 5) < POSITIVE_THRESHOLD)
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))
    .slice(0, 5)
    .map(r => ({
      rating: r.rating ?? 0,
      feedback: r.feedback,
      when: r.completed_at ?? r.created_at,
    }))

  return {
    requestsSent: sent.length,
    requestsCompleted: completed.length,
    completionRate: rate(completed.length, sent.length),
    averageRating,
    positiveCount,
    negativeCount,
    sentimentDistribution,
    weeklyTrend,
    recentNegative,
    insights: buildInsights({
      sent: sent.length,
      completed: completed.length,
      averageRating,
      positiveCount,
      negativeCount,
      weeklyTrend,
    }),
  }
}

/** Groups completed responses into rolling 7-day buckets anchored to today, oldest first. */
function buildWeeklyTrend(completed: RawReviewRequest[], now: number) {
  const week = 7 * 24 * 60 * 60 * 1000
  const buckets = new Map<string, { count: number; total: number }>()

  for (const r of completed) {
    const when = new Date(r.completed_at ?? r.created_at).getTime()
    const weeksAgo = Math.floor((now - when) / week)
    if (weeksAgo > 11) continue
    const weekStart = new Date(now - weeksAgo * week).toISOString().slice(0, 10)
    const bucket = buckets.get(weekStart) ?? { count: 0, total: 0 }
    bucket.count += 1
    bucket.total += r.rating ?? 0
    buckets.set(weekStart, bucket)
  }

  return Array.from(buckets.entries())
    .map(([weekStart, b]) => ({
      weekStart,
      count: b.count,
      avgRating: b.count ? Number((b.total / b.count).toFixed(1)) : null,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function buildInsights(m: {
  sent: number
  completed: number
  averageRating: number | null
  positiveCount: number
  negativeCount: number
  weeklyTrend: { count: number; avgRating: number | null }[]
}): string[] {
  const out: string[] = []

  if (m.sent > 0) {
    const completion = Math.round((m.completed / m.sent) * 100)
    out.push(`${m.completed} of ${m.sent} review requests were answered (${completion}%).`)
  }

  if (m.averageRating !== null) {
    out.push(`Average rating across ${m.completed} responses is ${m.averageRating} out of 5.`)
  }

  if (m.negativeCount > 0) {
    out.push(
      `${m.negativeCount} ${m.negativeCount === 1 ? 'guest rated' : 'guests rated'} below ${POSITIVE_THRESHOLD} stars and stayed private rather than going to Google.`
    )
  }

  // Compare the two most recent weeks that both have data.
  const withData = m.weeklyTrend.filter(w => w.avgRating !== null)
  if (withData.length >= 2) {
    const latest = withData[withData.length - 1]
    const prior  = withData[withData.length - 2]
    const delta  = Number(((latest.avgRating ?? 0) - (prior.avgRating ?? 0)).toFixed(1))
    if (Math.abs(delta) >= 0.3) {
      out.push(
        delta > 0
          ? `Ratings improved by ${delta} stars week on week.`
          : `Ratings dropped by ${Math.abs(delta)} stars week on week.`
      )
    }
  }

  return out
}
