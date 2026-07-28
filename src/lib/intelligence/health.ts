/**
 * Business Health Score.
 *
 * ── Algorithm ────────────────────────────────────────────────────────────────
 * Four components, each scored 0–100 from real platform data:
 *
 *   Reputation      30%  average rating mapped 1–5 → 0–100, blended 70/30 with
 *                        the share of review requests guests actually answered
 *   Guest momentum  25%  new guests in the last 30 days against the 30 before,
 *                        centred so "flat" scores 50 and ±50% change saturates
 *   Loyalty         25%  share of members active in 30 days, blended 70/30 with
 *                        whether issued points are being redeemed at all
 *   Operations      20%  inverse of the escalation rate, blended 60/40 with the
 *                        assistant's request success rate
 *
 * A component with no underlying data scores null and is excluded; the
 * remaining weights are renormalised so the score always means "out of the
 * things we can currently measure". With no data anywhere the overall score is
 * null and the UI shows a placeholder rather than a fabricated number.
 *
 * The score is deliberately not a revenue proxy. Nothing here reads financial
 * data, because the platform does not have any.
 */

import { rate, windowBounds, type RawData } from './gather'
import { POSITIVE_THRESHOLD } from './reviews'
import type { HealthComponent, HealthScore } from './types'

/** Below this many data points a component is treated as unmeasurable. */
const MIN_SAMPLES = 3

const WEIGHTS = {
  reputation: 0.30,
  momentum:   0.25,
  loyalty:    0.25,
  operations: 0.20,
} as const

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function computeHealthScore(raw: RawData, now = Date.now()): HealthScore {
  const { since30, since60 } = windowBounds(now)

  const components: HealthComponent[] = [
    reputation(raw),
    momentum(raw, since30, since60),
    loyalty(raw, since30),
    operations(raw),
  ]

  const measurable = components.filter(c => c.score !== null)
  const totalWeight = measurable.reduce((s, c) => s + c.weight, 0)

  const overall = measurable.length && totalWeight > 0
    ? clamp(measurable.reduce((s, c) => s + (c.score ?? 0) * (c.weight / totalWeight), 0))
    : null

  return { overall, components, verdict: verdictFor(overall, measurable.length) }
}

function reputation(raw: RawData): HealthComponent {
  const completed = raw.reviewRequests.filter(r => r.rating != null)
  const sent = raw.reviewRequests.filter(r => ['sent', 'positive', 'negative'].includes(r.status))

  if (completed.length < MIN_SAMPLES) {
    return {
      key: 'reputation', label: 'Reputation', score: null, weight: WEIGHTS.reputation,
      basis: `Needs at least ${MIN_SAMPLES} answered review requests; there ${completed.length === 1 ? 'is' : 'are'} ${completed.length}.`,
    }
  }

  const avg = completed.reduce((s, r) => s + (r.rating ?? 0), 0) / completed.length
  // 1 star → 0, 5 stars → 100.
  const ratingScore = ((avg - 1) / 4) * 100
  const responseScore = (rate(completed.length, sent.length) ?? 0) * 100

  return {
    key: 'reputation', label: 'Reputation', weight: WEIGHTS.reputation,
    score: clamp(ratingScore * 0.7 + responseScore * 0.3),
    basis: `${avg.toFixed(1)} average across ${completed.length} responses, ${Math.round(responseScore)}% of requests answered.`,
  }
}

function momentum(raw: RawData, since30: string, since60: string): HealthComponent {
  const current  = raw.guests.filter(g => g.created_at >= since30).length
  const previous = raw.guests.filter(g => g.created_at >= since60 && g.created_at < since30).length

  if (current + previous < MIN_SAMPLES) {
    return {
      key: 'momentum', label: 'Guest momentum', score: null, weight: WEIGHTS.momentum,
      basis: `Needs at least ${MIN_SAMPLES} new guests across the last two months; there are ${current + previous}.`,
    }
  }

  // Flat is 50. A 50% swing in either direction saturates the scale, so one
  // unusual month cannot dominate the overall score.
  const change = previous > 0 ? (current - previous) / previous : 1
  const score = 50 + Math.max(-1, Math.min(1, change / 0.5)) * 50

  return {
    key: 'momentum', label: 'Guest momentum', weight: WEIGHTS.momentum,
    score: clamp(score),
    basis: `${current} new guests in the last 30 days against ${previous} in the 30 before.`,
  }
}

function loyalty(raw: RawData, since30: string): HealthComponent {
  if (raw.members.length < MIN_SAMPLES) {
    return {
      key: 'loyalty', label: 'Loyalty engagement', score: null, weight: WEIGHTS.loyalty,
      basis: `Needs at least ${MIN_SAMPLES} loyalty members; there ${raw.members.length === 1 ? 'is' : 'are'} ${raw.members.length}.`,
    }
  }

  const active = raw.members.filter(m => (m.last_activity_at ?? '') >= since30).length
  const activeScore = (rate(active, raw.members.length) ?? 0) * 100

  const issued = raw.transactions
    .filter(t => t.type === 'earn' || t.type === 'bonus')
    .reduce((s, t) => s + t.points, 0)
  const redeemed = raw.transactions
    .filter(t => t.type === 'redeem')
    .reduce((s, t) => s + Math.abs(t.points), 0)

  // Points that are never spent mean the programme is not doing its job, but a
  // low redemption rate is normal — 25% redemption is treated as a full score.
  const redemptionScore = issued > 0 ? Math.min(1, (redeemed / issued) / 0.25) * 100 : 0

  return {
    key: 'loyalty', label: 'Loyalty engagement', weight: WEIGHTS.loyalty,
    score: clamp(activeScore * 0.7 + redemptionScore * 0.3),
    basis: `${active} of ${raw.members.length} members active in 30 days; ${redeemed.toLocaleString()} of ${issued.toLocaleString()} points redeemed.`,
  }
}

function operations(raw: RawData): HealthComponent {
  const conversations = raw.conversations.length
  const aiCalls = raw.aiCalls.length

  if (conversations < MIN_SAMPLES && aiCalls < MIN_SAMPLES) {
    return {
      key: 'operations', label: 'Operations', score: null, weight: WEIGHTS.operations,
      basis: 'Needs assistant activity before this can be measured.',
    }
  }

  const escalated = raw.conversations.filter(c => c.status === 'escalated').length
  const escalationRate = rate(escalated, conversations) ?? 0
  const handledScore = (1 - escalationRate) * 100

  const succeeded = raw.aiCalls.filter(c => c.success).length
  const successScore = (rate(succeeded, aiCalls) ?? 1) * 100

  return {
    key: 'operations', label: 'Operations', weight: WEIGHTS.operations,
    score: clamp(handledScore * 0.6 + successScore * 0.4),
    basis: `${escalated} of ${conversations} conversations needed a person; ${Math.round(successScore)}% of AI requests succeeded.`,
  }
}

function verdictFor(overall: number | null, measured: number): string {
  if (overall === null) {
    return 'Not enough activity yet to score. Record visits and collect a few reviews to get a reading.'
  }
  const caveat = measured < 4 ? ` Based on ${measured} of 4 areas — the rest need more data.` : ''
  if (overall >= 80) return `Strong across the board.${caveat}`
  if (overall >= 60) return `Healthy, with room to improve.${caveat}`
  if (overall >= 40) return `Mixed. Worth looking at the weakest area below.${caveat}`
  return `Needs attention. Start with the lowest-scoring area below.${caveat}`
}
