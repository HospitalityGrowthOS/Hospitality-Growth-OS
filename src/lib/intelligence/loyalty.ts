/**
 * Loyalty intelligence — is the programme actually being used.
 */

import { growth, pct, rate, windowBounds, type RawData } from './gather'
import type { LoyaltyIntelligence } from './types'

/** A member counts as engaged if they have any activity inside the window. */
const ENGAGED_WITHIN_DAYS = 30

export function computeLoyaltyIntelligence(raw: RawData, now = Date.now()): LoyaltyIntelligence {
  const { since30, since60 } = windowBounds(now)

  const totalMembers = raw.members.length

  // Ledger totals rather than member counters: the ledger is the record of what
  // actually happened, and cannot drift from a stale denormalised column.
  const pointsIssued = raw.transactions
    .filter(t => t.type === 'earn' || t.type === 'bonus')
    .reduce((s, t) => s + t.points, 0)
  const pointsRedeemed = raw.transactions
    .filter(t => t.type === 'redeem')
    .reduce((s, t) => s + Math.abs(t.points), 0)

  const newMembers30d     = raw.members.filter(m => (m.enrolled_at ?? '') >= since30).length
  const newMembersPrev30d = raw.members.filter(m => (m.enrolled_at ?? '') >= since60 && (m.enrolled_at ?? '') < since30).length
  const tierUpgrades30d   = raw.members.filter(m => (m.tier_upgraded_at ?? '') >= since30).length

  const activeRewards     = raw.rewards.filter(r => r.is_active).length
  const rewardRedemptions = raw.rewards.reduce((s, r) => s + (r.redemption_count ?? 0), 0)

  const engagedMembers = raw.members.filter(m => (m.last_activity_at ?? '') >= since30).length

  return {
    totalMembers,
    pointsIssued,
    pointsRedeemed,
    redemptionRate: rate(pointsRedeemed, pointsIssued),
    newMembers30d,
    newMembersPrev30d,
    tierUpgrades30d,
    activeRewards,
    rewardRedemptions,
    engagementRate: rate(engagedMembers, totalMembers),
    insights: buildInsights({
      totalMembers, pointsIssued, pointsRedeemed,
      newMembers30d, newMembersPrev30d, tierUpgrades30d,
      activeRewards, rewardRedemptions, engagedMembers,
    }),
  }
}

function buildInsights(m: {
  totalMembers: number
  pointsIssued: number
  pointsRedeemed: number
  newMembers30d: number
  newMembersPrev30d: number
  tierUpgrades30d: number
  activeRewards: number
  rewardRedemptions: number
  engagedMembers: number
}): string[] {
  const out: string[] = []

  const change = growth(m.newMembers30d, m.newMembersPrev30d)
  if (change !== null && Math.abs(change) >= 10) {
    out.push(
      change > 0
        ? `Loyalty sign-ups are up ${change}% on the previous 30 days.`
        : `Loyalty sign-ups are down ${Math.abs(change)}% on the previous 30 days.`
    )
  }

  if (m.pointsIssued > 0) {
    const redemption = pct(m.pointsRedeemed / m.pointsIssued)
    out.push(
      m.pointsRedeemed === 0
        ? `${m.pointsIssued.toLocaleString()} points issued and none redeemed yet — guests are collecting but not spending.`
        : `${redemption}% of issued points have been redeemed (${m.pointsRedeemed.toLocaleString()} of ${m.pointsIssued.toLocaleString()}).`
    )
  }

  if (m.totalMembers > 0) {
    const engaged = pct(m.engagedMembers / m.totalMembers)
    out.push(`${m.engagedMembers} of ${m.totalMembers} members were active in the last ${ENGAGED_WITHIN_DAYS} days (${engaged}%).`)
  }

  if (m.tierUpgrades30d > 0) {
    out.push(`${m.tierUpgrades30d} ${m.tierUpgrades30d === 1 ? 'member moved' : 'members moved'} up a tier this month.`)
  }

  if (m.activeRewards === 0 && m.totalMembers > 0) {
    out.push('No rewards are currently active, so points cannot be spent on anything.')
  }

  return out
}
