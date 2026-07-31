/**
 * Golden Demo Venue — seed.
 *
 * Builds Bistro Saint-Laurent: one restaurant that behaves like a real
 * long-term customer. Purpose-built for this venue, deliberately. This is
 * Customer #0, not the Chapter 33 simulation platform — there is no generator,
 * no scenario engine and nothing reusable here by design.
 *
 * The data tells one story: a well-run bistro in Vieux-Québec with strong
 * regulars, a summer tourist peak, and three real problems for Growth
 * Intelligence to find —
 *
 *   1. Friday and Saturday 19:30–21:00 run past kitchen capacity, producing
 *      longer waits and a cluster of poor reviews.
 *   2. Points accumulate but redemption is low; the rewards exist and nobody
 *      mentions them.
 *   3. A cohort of regulars drifted away after a difficult March.
 *
 * Every number has a cause. Reviews come from visits, revenue comes from
 * visits, loyalty comes from visits, and the intelligence layer reads all of
 * it exactly as it would for a real venue.
 *
 * Run:  npx tsx --env-file=.env.local scripts/golden-demo/seed.ts
 */

import { createAdminClient } from '../../src/lib/supabase/server'
import {
  VENUE, MENU, REWARDS, FIRST_NAMES, LAST_NAMES, VISITOR_NAMES,
  REVIEWS_5, REVIEWS_4, REVIEWS_3, REVIEWS_2, REVIEWS_1,
  CONVERSATIONS, CAMPAIGNS,
} from './content'

// ── Deterministic randomness ─────────────────────────────────────────────────
// Seeded so the venue is identical on every rebuild: stable screenshots,
// reproducible QA, and a demo that looks the same in every sales meeting.

let seed = 20260730
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const between = (a: number, b: number) => a + rnd() * (b - a)
const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
const chance = (p: number) => rnd() < p

/** Log-normal-ish draw — real spend and frequency are skewed, never uniform. */
function skewed(median: number, spread = 0.45): number {
  const u1 = Math.max(rnd(), 1e-9), u2 = rnd()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return median * Math.exp(z * spread)
}

// ── Calendar ─────────────────────────────────────────────────────────────────

const TODAY = new Date('2026-07-30T12:00:00Z')
const START = new Date('2025-08-01T00:00:00Z')

const iso = (d: Date) => d.toISOString()
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000)

/**
 * Demand multiplier for a given day — the shape of a Québec City bistro's year.
 * Summer tourism, Carnaval in February, a dead January, a difficult March.
 */
function seasonFactor(d: Date): number {
  const m = d.getUTCMonth() // 0 = Jan
  const base = [0.55, 0.85, 0.72, 0.82, 0.95, 1.15, 1.35, 1.30, 1.05, 1.00, 0.75, 1.10][m]
  // Carnaval de Québec — early February spike.
  const day = d.getUTCDate()
  if (m === 1 && day >= 3 && day <= 16) return base * 1.45
  // Fêtes — late December.
  if (m === 11 && day >= 10 && day <= 23) return base * 1.30
  return base
}

/** Closed Mondays; Saturday dinner only; Sunday brunch and early dinner. */
function dayFactor(d: Date): number {
  return [0.80, 0, 0.62, 0.68, 0.85, 1.30, 1.45][d.getUTCDay()]
}

const isClosed = (d: Date) => d.getUTCDay() === 1

/** The March service crisis — two chefs left, quality dipped for five weeks. */
function inServiceCrisis(d: Date): boolean {
  return d >= new Date('2026-02-25T00:00:00Z') && d <= new Date('2026-04-02T00:00:00Z')
}

// ── Guest archetypes ─────────────────────────────────────────────────────────

type Archetype =
  | 'regular' | 'business' | 'couple' | 'family' | 'tourist'
  | 'wine' | 'vip' | 'lapsed' | 'occasional'

interface Persona {
  archetype: Archetype
  name: string
  phone: string
  email: string | null
  birthday: string | null
  /** Mean days between visits. */
  interval: number
  /** Median spend per cover. */
  spend: number
  partySize: () => number
  reviewProb: number
  /** Multiplies the chance of joining loyalty. */
  enrolProb: number
  /** How much a poor experience costs — regulars forgive, VIPs do not. */
  tolerance: number
  /** Which months this guest is even in town. */
  seasonal?: (d: Date) => boolean
  optIn: boolean
}

const ARCHETYPE_MIX: { type: Archetype; count: number }[] = [
  { type: 'regular',    count: 26 },
  { type: 'business',   count: 19 },
  { type: 'couple',     count: 24 },
  { type: 'family',     count: 16 },
  { type: 'tourist',    count: 32 },
  { type: 'wine',       count: 9 },
  { type: 'vip',        count: 6 },
  { type: 'lapsed',     count: 14 },
  { type: 'occasional', count: 18 },
]

/** Two guests sharing a name is realistic; two guests sharing an identity is a bug. */
const usedNames = new Set<string>()

function makePersona(type: Archetype, i: number): Persona {
  let first = '', last = '', name = ''
  for (let attempt = 0; attempt < 60; attempt++) {
    const useVisitorName = type === 'tourist' && chance(0.55)
    const parts = useVisitorName ? pick(VISITOR_NAMES) : [pick(FIRST_NAMES), pick(LAST_NAMES)]
    first = parts[0]; last = parts[1]; name = `${first} ${last}`
    if (!usedNames.has(name)) break
  }
  usedNames.add(name)
  const phone = `+1418${String(5550000 + i * 7 + intBetween(0, 6)).slice(-7)}`
  const emailUser = `${first}.${last}`.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z.]/g, '')
  const domain = pick(['gmail.com', 'videotron.ca', 'hotmail.com', 'outlook.com', 'sympatico.ca'])

  const birthday = chance(0.62)
    ? `19${intBetween(60, 99)}-${String(intBetween(1, 12)).padStart(2, '0')}-${String(intBetween(1, 28)).padStart(2, '0')}`
    : null

  const base = {
    name, phone,
    email: chance(0.78) ? `${emailUser}@${domain}` : null,
    birthday,
    optIn: chance(0.86),
  }

  switch (type) {
    case 'regular':
      return { ...base, archetype: type, interval: between(11, 24), spend: skewed(62, 0.28),
        partySize: () => (chance(0.55) ? 2 : intBetween(2, 4)), reviewProb: 0.10,
        enrolProb: 0.92, tolerance: 0.75 }
    case 'business':
      return { ...base, archetype: type, interval: between(16, 34), spend: skewed(48, 0.30),
        partySize: () => intBetween(2, 4), reviewProb: 0.06, enrolProb: 0.55, tolerance: 0.5 }
    case 'couple':
      return { ...base, archetype: type, interval: between(38, 80), spend: skewed(96, 0.32),
        partySize: () => 2, reviewProb: 0.16, enrolProb: 0.62, tolerance: 0.45 }
    case 'family':
      return { ...base, archetype: type, interval: between(45, 95), spend: skewed(132, 0.30),
        partySize: () => intBetween(3, 6), reviewProb: 0.12, enrolProb: 0.58, tolerance: 0.4 }
    case 'tourist':
      return { ...base, archetype: type, interval: 9999, spend: skewed(88, 0.38),
        partySize: () => intBetween(2, 4), reviewProb: 0.34, enrolProb: 0.18, tolerance: 0.35,
        seasonal: d => [5, 6, 7, 8].includes(d.getUTCMonth()) || (d.getUTCMonth() === 1 && d.getUTCDate() < 17) }
    case 'wine':
      return { ...base, archetype: type, interval: between(26, 52), spend: skewed(148, 0.30),
        partySize: () => 2, reviewProb: 0.22, enrolProb: 0.80, tolerance: 0.5 }
    case 'vip':
      return { ...base, archetype: type, interval: between(20, 40), spend: skewed(215, 0.28),
        partySize: () => intBetween(2, 6), reviewProb: 0.18, enrolProb: 1.0, tolerance: 0.25 }
    case 'lapsed':
      // Was a regular. Stops after the March crisis — see visit generation.
      return { ...base, archetype: type, interval: between(14, 28), spend: skewed(58, 0.28),
        partySize: () => intBetween(2, 4), reviewProb: 0.12, enrolProb: 0.88, tolerance: 0.35 }
    case 'occasional':
      return { ...base, archetype: type, interval: between(70, 150), spend: skewed(74, 0.34),
        partySize: () => 2, reviewProb: 0.14, enrolProb: 0.40, tolerance: 0.5 }
  }
}

// ── Service quality ──────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random in [0,1) derived from a timestamp.
 *
 * Load must be a property of the *service*, not of when the code happens to
 * run. Drawing it from the global generator meant phase 1 and phase 2 computed
 * different loads for the same visit — so a poor review had no traceable cause
 * in the data, which defeats the entire purpose of the venue.
 */
function hashUnit(n: number): number {
  let x = Math.floor(n) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296
}

/**
 * Load for a given service, as a share of capacity. Friday and Saturday
 * dinner regularly run at or past what the kitchen can plate well — the fact
 * the intelligence layer is meant to discover.
 *
 * Deterministic for a given date and hour, so every consumer of this visit
 * agrees about how busy it was.
 */
function serviceLoad(d: Date, hour: number): number {
  const key = Math.floor(d.getTime() / 3600000) + hour * 7919
  const u = hashUnit(key)
  const peak = (d.getUTCDay() === 5 || d.getUTCDay() === 6) && hour >= 19 && hour <= 21
  const base = peak ? 0.78 + u * 0.40 : 0.38 + u * 0.42
  return base * Math.min(1.28, seasonFactor(d))
}

/**
 * An individual service failure: a wrong order, a missed allergy note, a table
 * left waiting for a card machine. Independent of how full the room is, which
 * is why it is the only source of one-star ratings here — a real one-star comes
 * from something going wrong, not from a slow night. A busy kitchen produces
 * threes.
 *
 * Roughly five times more likely during the crisis. That is what losing two
 * chefs looks like on the floor: not a slower room, a less reliable one.
 */
function serviceIncident(at: Date, crisis: boolean): boolean {
  const u = hashUnit(Math.floor(at.getTime() / 60000) ^ 0x5bf03635)
  return u < (crisis ? 0.055 : 0.009)
}

/**
 * Experience score 0–1 from load, plus the March crisis. Degradation past
 * capacity is sharp rather than gradual — real kitchens fall over.
 */
function experienceScore(load: number, crisis: boolean, at?: Date): { score: number; waitMin: number } {
  // Deterministic jitter tied to the service, for the same reason serviceLoad is.
  const j = at ? hashUnit(Math.floor(at.getTime() / 60000)) : rnd()
  let score: number
  if (load < 0.72)      score = 0.86 + j * 0.13
  else if (load < 0.92) score = 0.72 + j * 0.18
  else if (load < 1.06) score = 0.52 + j * 0.22
  else                  score = 0.46 + j * 0.26
  // The crisis bites hard, but is floored above the incident band: five weeks of
  // shaky service turns fives into threes, it does not invent one-star nights.
  if (crisis) score = Math.max(0.38, score * (0.68 + j * 0.14))
  // An incident overrides the room: the night can be calm and still go wrong.
  if (at && serviceIncident(at, crisis)) score = Math.min(score, 0.08 + j * 0.14)
  const waitMin = Math.round(load < 0.8 ? 6 + j * 12 : load < 1.0 ? 18 + j * 17 : 35 + j * 35)
  return { score: Math.max(0.05, Math.min(1, score)), waitMin }
}

/**
 * Rating from experience and personality. Tolerant guests forgive an off night.
 *
 * Calibrated against the venue's real visits until it landed near 49% five-star,
 * 31% four, 16% three and 5% one-or-two, averaging 4.2. An earlier pass produced
 * 187 fives against 16 fours, which is J-shaped to the point of being
 * implausible — a real venue has a substantial four-star band, and the
 * distribution falls away monotonically rather than spiking at the bottom.
 */
function ratingFrom(score: number, tolerance: number): number {
  const adjusted = score + tolerance * 0.10 + between(-0.05, 0.05)
  if (adjusted > 1.04) return 5
  if (adjusted > 0.92) return chance(0.63) ? 5 : 4
  if (adjusted > 0.83) return chance(0.24) ? 5 : chance(0.84) ? 4 : 3
  if (adjusted > 0.70) return chance(0.55) ? 4 : 3
  if (adjusted > 0.58) return chance(0.22) ? 4 : chance(0.84) ? 3 : 2
  if (adjusted > 0.46) return chance(0.72) ? 3 : 2
  // Below here means an incident occurred — a busy room alone cannot reach this
  // band, which is what makes "one star" mean something specific in this venue.
  if (adjusted > 0.34) return 2
  return chance(0.78) ? 1 : 2
}

function reviewTextFor(rating: number): string {
  if (rating === 5) return pick(REVIEWS_5)
  if (rating === 4) return pick(REVIEWS_4)
  if (rating === 3) return pick(REVIEWS_3)
  if (rating === 2) return pick(REVIEWS_2)
  return pick(REVIEWS_1)
}

export {
  rnd, pick, between, intBetween, chance, skewed,
  TODAY, START, iso, dayKey, addDays, daysBetween,
  seasonFactor, dayFactor, isClosed, inServiceCrisis,
  serviceLoad, experienceScore, ratingFrom, reviewTextFor,
  makePersona, ARCHETYPE_MIX,
  createAdminClient, VENUE, MENU, REWARDS, CONVERSATIONS, CAMPAIGNS,
}
export type { Persona, Archetype }
