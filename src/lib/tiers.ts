/**
 * Loyalty tiers — one definition, read by everything.
 *
 * There were three readers and two different keys before this existed:
 * `src/lib/loyalty.ts` and the daily cron read `settings.tier_thresholds`,
 * while the signup API read `settings.silver_threshold`. A venue that
 * configured one saw the other fall back to a hardcoded default, so the tier a
 * guest was awarded and the "points to your next tier" figure shown to that
 * same guest on the signup screen could disagree.
 *
 * The defaults were also miscalibrated. At the default 10 points per unit of
 * currency, a single table of two at a mid-range bistro earns well over 1,500
 * points — so every guest reached the top tier on their first visit. Seeding a
 * year of realistic trade produced 91 Gold members against 2 Silver, which
 * makes the tier meaningless as both a signal and a reward.
 *
 * The defaults below are set against roughly 600 points per cover: Silver at
 * about five covers, Gold at about fifteen. A venue whose average bill differs
 * should change them — which is now possible, in Settings.
 */

export type Tier = 'bronze' | 'silver' | 'gold'

export interface TierThresholds {
  silver: number
  gold: number
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = { silver: 3000, gold: 9000 }

/** Points awarded per unit of the venue's currency. */
export const DEFAULT_POINTS_PER_UNIT = 10

/**
 * Reads thresholds from venue settings.
 *
 * Accepts the legacy flat `silver_threshold` / `gold_threshold` keys so venues
 * configured before the two readers were unified keep the values they chose.
 */
export function tierThresholds(settings: unknown): TierThresholds {
  const s = (settings ?? {}) as Record<string, unknown>
  const nested = s.tier_thresholds as Partial<TierThresholds> | undefined

  const silver = numberOr(nested?.silver, numberOr(s.silver_threshold, DEFAULT_TIER_THRESHOLDS.silver))
  const gold   = numberOr(nested?.gold,   numberOr(s.gold_threshold,   DEFAULT_TIER_THRESHOLDS.gold))

  // A gold threshold at or below silver would make the middle tier
  // unreachable, so treat a misconfiguration as "no gold tier configured".
  return { silver, gold: gold > silver ? gold : Math.max(gold, silver * 3) }
}

/**
 * Points awarded per unit of the venue's own currency.
 *
 * The key used to be `points_per_euro`, which was shown verbatim to a venue
 * billing in Canadian dollars. `points_per_unit` replaces it; the old key is
 * still read so venues configured before the rename keep the value they chose.
 */
export function pointsPerUnit(settings: unknown): number {
  const s = (settings ?? {}) as Record<string, unknown>
  return numberOr(s.points_per_unit, numberOr(s.points_per_euro, DEFAULT_POINTS_PER_UNIT))
}

/** The tier a balance earns. Ordering matters — gold is checked first. */
export function tierFor(points: number, thresholds: TierThresholds): Tier {
  if (points >= thresholds.gold) return 'gold'
  if (points >= thresholds.silver) return 'silver'
  return 'bronze'
}

/** Points still needed for the next tier up, or null at the top. */
export function toNextTier(
  points: number,
  thresholds: TierThresholds
): { tier: Exclude<Tier, 'bronze'>; threshold: number; remaining: number } | null {
  if (points < thresholds.silver) {
    return { tier: 'silver', threshold: thresholds.silver, remaining: thresholds.silver - points }
  }
  if (points < thresholds.gold) {
    return { tier: 'gold', threshold: thresholds.gold, remaining: thresholds.gold - points }
  }
  return null
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}
