/**
 * Golden Demo Venue — runner.
 *
 * Writes the venue in causal order: identity, then guests, then visits, then
 * everything that follows from visits. Nothing is inserted that a real venue
 * would not have produced by operating.
 *
 * Loyalty goes through the production path: a ledger row is written and the
 * `after_loyalty_transaction_insert` trigger maintains balances, exactly as it
 * does for a real guest. Tiers are computed from the venue's real thresholds.
 *
 * Run:  npx tsx --env-file=.env.local scripts/golden-demo/run.ts
 */

import {
  createAdminClient, VENUE, MENU, REWARDS, CONVERSATIONS, CAMPAIGNS,
  TODAY, START, iso, addDays, daysBetween,
  seasonFactor, dayFactor, isClosed, inServiceCrisis,
  serviceLoad, experienceScore, ratingFrom, reviewTextFor,
  makePersona, ARCHETYPE_MIX,
  rnd, pick, between, intBetween, chance, skewed,
  type Persona,
} from './seed'
import { tierFor, DEFAULT_TIER_THRESHOLDS } from '../../src/lib/tiers'

const CRISIS_END = new Date('2026-04-02T00:00:00Z')

interface SeededGuest {
  id: string
  memberId: string | null
  persona: Persona
  visits: { at: Date; spend: number; party: number; score: number; waitMin: number }[]
  points: number
  tier: string
}

async function main() {
  const db = await createAdminClient()
  const stats: Record<string, number> = {}

  // ── 0. Locate and reset the venue ──────────────────────────────────────────
  const { data: venueRow } = await db.from('venues').select('id, owner_id').eq('slug', VENUE.slug).single()
  if (!venueRow) throw new Error('Demo venue not found — expected slug "demo"')
  const venueId = venueRow.id
  console.log(`Golden Demo Venue → ${VENUE.name}, ${VENUE.city}\n`)

  console.log('Clearing previous demo data…')
  const { data: oldGuests } = await db.from('guests').select('id').eq('venue_id', venueId)
  const oldIds = (oldGuests ?? []).map(g => g.id)
  const { data: oldMembers } = await db.from('loyalty_members').select('id').eq('venue_id', venueId)
  const oldMemberIds = (oldMembers ?? []).map(m => m.id)
  if (oldMemberIds.length) await db.from('loyalty_transactions').delete().in('member_id', oldMemberIds)
  await db.from('loyalty_members').delete().eq('venue_id', venueId)
  await db.from('campaign_sends').delete().eq('venue_id', venueId)
  await db.from('campaigns').delete().eq('venue_id', venueId)
  await db.from('whatsapp_messages').delete().eq('venue_id', venueId)
  await db.from('messages').delete().eq('venue_id', venueId)
  await db.from('conversations').delete().eq('venue_id', venueId)
  await db.from('reviews').delete().eq('venue_id', venueId)
  await db.from('review_requests').delete().eq('venue_id', venueId)
  await db.from('reservation_requests').delete().eq('venue_id', venueId)
  await db.from('visits').delete().eq('venue_id', venueId)
  await db.from('analytics_events').delete().eq('venue_id', venueId)
  await db.from('action_items').delete().eq('venue_id', venueId)
  await db.from('notifications').delete().eq('venue_id', venueId)
  await db.from('kpi_snapshots').delete().eq('venue_id', venueId)
  await db.from('loyalty_rewards').delete().eq('venue_id', venueId)
  await db.from('ai_recommendations').delete().eq('venue_id', venueId)
  if (oldIds.length) await db.from('guests').delete().in('id', oldIds)

  // ── 1. Identity, knowledge base, settings ─────────────────────────────────
  const menuByCategory = MENU.reduce<Record<string, typeof MENU>>((acc, m) => {
    (acc[m.category] ??= []).push(m); return acc
  }, {})
  const menuText = Object.entries(menuByCategory).map(([cat, items]) =>
    `${cat.toUpperCase()}\n` + items.map(i => `• ${i.name} — ${i.price} $\n  ${i.description}`).join('\n')
  ).join('\n\n')

  const settings = {
    currency: 'CAD',
    locale: 'fr-CA',
    is_demo: true,
    points_per_unit: 10,
    welcome_bonus_points: 50,
    birthday_bonus_points: 250,
    winback_voucher: 15,
    tier_thresholds: DEFAULT_TIER_THRESHOLDS,
    review_delay_minutes: 45,
    google_review_url: 'https://search.google.com/local/writereview?placeid=DEMO_BISTRO_SAINT_LAURENT',
    brand: VENUE.brand,
    story: VENUE.story,
    team: [VENUE.owner, VENUE.chef, ...VENUE.team],
    hours: VENUE.hours,
    social: VENUE.social,
    capacity: VENUE.capacity,
    faq: {
      restaurant_info: `${VENUE.name} — ${VENUE.cuisine}. ${VENUE.story}`,
      opening_hours: "Fermé le lundi. Midi du mardi au vendredi (11h30–14h) et dimanche (10h30–14h30). Soir du mardi au dimanche à partir de 17h30 (17h le week-end).",
      address: `${VENUE.address}. Dans le Vieux-Québec, à cinq minutes à pied de la Porte Saint-Jean.`,
      parking: "Stationnement d'Youville à cinq minutes à pied. Places sur rue Saint-Jean après 18h. Prévoyez un peu de temps les vendredis et samedis soirs.",
      reservations: "Réservations par téléphone au +1 418 555 0142 ou par message. Nous conseillons de réserver une semaine à l'avance pour les vendredis et samedis.",
      menu: menuText,
      allergens: "Nous prenons les allergies au sérieux. Nous n'avons pas encore publié la liste complète des allergènes par plat, alors nous ne pouvons pas confirmer ici si un plat contient un allergène précis. Mentionnez toute allergie à votre serveur : il vérifiera directement avec la cuisine avant préparation. Nos plats sont préparés dans une cuisine commune, nous ne pouvons donc garantir l'absence de traces.",
      payment: 'Comptant, débit, Visa, Mastercard et American Express.',
      accessibility: "Le rez-de-chaussée est accessible. Une marche à l'entrée principale ; notre équipe peut vous aider.",
      wifi: 'Wi-Fi gratuit — demandez le code à votre serveur.',
      delivery: "Nous ne faisons ni livraison ni commandes pour emporter. La cuisine est pensée pour être servie à table.",
      events: "Privatisation possible pour 20 à 48 personnes. Écrivez-nous et Sophie vous proposera les formules.",
      custom: "Table du chef : huit places, quelques soirs par saison, menu surprise. Annoncée d'abord aux membres du programme de fidélité.",
    },
  }

  await db.from('venues').update({
    name: VENUE.name, city: VENUE.city, address: VENUE.address,
    type: 'restaurant', status: 'active', settings: settings as never,
  }).eq('id', venueId)
  console.log('✅ identity, hours, brand and knowledge base')

  for (const r of REWARDS) {
    await db.from('loyalty_rewards').insert({
      venue_id: venueId, name: r.name, description: r.description,
      points_cost: r.points_cost, type: r.type, is_active: true,
    })
  }
  stats.rewards = REWARDS.length
  console.log(`✅ ${REWARDS.length} loyalty rewards`)

  // ── 2. Guests ──────────────────────────────────────────────────────────────
  const personas: Persona[] = []
  let idx = 0
  for (const { type, count } of ARCHETYPE_MIX) {
    for (let i = 0; i < count; i++) personas.push(makePersona(type, idx++))
  }

  const guests: SeededGuest[] = []
  for (const p of personas) {
    const { data: g } = await db.from('guests').insert({
      venue_id: venueId, name: p.name, phone: p.phone, email: p.email,
      language: 'fr', whatsapp_opted_in: p.optIn, loyalty_tier: 'none',
      loyalty_points: 0, total_visits: 0, total_spent: 0,
    }).select('id').single()
    if (g) guests.push({ id: g.id, memberId: null, persona: p, visits: [], points: 0, tier: 'none' })
  }
  stats.guests = guests.length
  console.log(`✅ ${guests.length} guests across ${ARCHETYPE_MIX.length} archetypes`)

  // ── 3. Visits — the causal spine ──────────────────────────────────────────
  const totalDays = daysBetween(START, TODAY)

  for (const g of guests) {
    const p = g.persona
    // Tourists visit once (occasionally twice on the same trip).
    if (p.archetype === 'tourist') {
      const tries = chance(0.22) ? 2 : 1
      let day = new Date(START.getTime() + rnd() * totalDays * 86400000)
      for (let t = 0; t < tries; t++) {
        if (p.seasonal && !p.seasonal(day)) { day = addDays(day, intBetween(30, 120)); if (day > TODAY) break }
        if (!isClosed(day) && day <= TODAY && (!p.seasonal || p.seasonal(day))) addVisit(g, day)
        day = addDays(day, intBetween(1, 3))
      }
      continue
    }

    let cursor = acquisitionDay(p)
    while (isClosed(cursor)) cursor = addDays(cursor, 1)
    // The visit that created the record. Without this the first visit is left
    // to the propensity roll below, which pushes every guest's start earlier.
    addVisit(g, cursor)
    cursor = addDays(cursor, Math.max(4, Math.round(skewed(p.interval, 0.42))))

    while (cursor <= TODAY) {
      if (!isClosed(cursor)) {
        // Demand-weighted attendance: a guest is likelier to come on a night
        // the restaurant is busy, which is what produces the peak pattern.
        const propensity = Math.min(1, 0.55 * seasonFactor(cursor) * dayFactor(cursor))
        if (chance(propensity)) addVisit(g, cursor)
      }
      cursor = addDays(cursor, Math.max(4, Math.round(skewed(p.interval, 0.42))))

      // The lapsed cohort stops after the March crisis and does not return.
      if (p.archetype === 'lapsed' && cursor > CRISIS_END) break
    }
  }

  /**
   * The day this guest first became a customer.
   *
   * A venue that puts a QR code on its tables captures a burst of the regulars
   * it already had in the first few weeks, and then a steady stream that
   * follows how busy the room is. Acquisition that decays month after month to
   * nothing is the signature of generated data — it says every customer the
   * venue will ever have arrived on day one.
   */
  function acquisitionDay(p: Persona): Date {
    // Long-standing faces: the lapsed cohort needs a year of history behind it
    // for its disappearance in March to read as a loss rather than a gap.
    const founding = p.archetype === 'lapsed' || p.archetype === 'vip' || chance(0.28)
    if (founding) return addDays(START, intBetween(0, 45))

    for (let i = 0; i < 60; i++) {
      const d = addDays(START, intBetween(0, totalDays - 14))
      if (isClosed(d)) continue
      if (chance(Math.min(1, seasonFactor(d) * dayFactor(d) / 1.9))) return d
    }
    return addDays(START, intBetween(0, totalDays - 14))
  }

  function addVisit(g: SeededGuest, day: Date) {
    const p = g.persona
    const dow = day.getUTCDay()
    const isWeekend = dow === 5 || dow === 6 || dow === 0
    const lunch = !isWeekend && p.archetype === 'business' ? true : chance(isWeekend ? 0.12 : 0.28)
    const hour = lunch ? intBetween(11, 13) : (isWeekend ? intBetween(18, 21) : intBetween(18, 20))
    const at = new Date(day); at.setUTCHours(hour, intBetween(0, 59), 0, 0)
    if (at > TODAY) return

    const party = p.partySize()
    const load = serviceLoad(day, hour)
    const { score, waitMin } = experienceScore(load, inServiceCrisis(day), at)
    const perCover = skewed(p.spend, 0.24) * (lunch ? 0.62 : 1)
    const spend = Math.round(perCover * party * 100) / 100
    g.visits.push({ at, spend, party, score, waitMin })
  }

  // Write visits, and the loyalty ledger that follows from them.
  // The venue's own thresholds, via the same module the product reads, so the
  // tiers in the demo are the tiers the product would have awarded.
  const thresholds = DEFAULT_TIER_THRESHOLDS
  let visitRows = 0, ledgerRows = 0

  for (let gi = 0; gi < guests.length; gi++) {
    const g = guests[gi]
    g.visits.sort((a, b) => a.at.getTime() - b.at.getTime())

    // A guest record comes into existence when they first walk in, not when
    // this script runs. Without this every guest reads as acquired today, and
    // "new guests this month" — a headline number — becomes the entire book.
    //
    // The handful with no recorded visit are the contacts every venue has:
    // a QR scan, a phone enquiry, a name taken at the door. They are dated
    // from their position rather than the RNG so this stays reproducible.
    const bornAt = g.visits.length ? g.visits[0].at : addDays(TODAY, -(45 + (gi * 37) % 300))
    await db.from('guests').update({ created_at: iso(bornAt) }).eq('id', g.id)

    if (!g.visits.length) continue

    // Enrolment: most guests who join do so on their first or second visit.
    const enrols = chance(g.persona.enrolProb)
    if (enrols) {
      const enrolAt = g.visits[Math.min(g.visits.length - 1, chance(0.7) ? 0 : 1)].at
      const { data: m } = await db.from('loyalty_members').insert({
        venue_id: venueId, guest_id: g.id,
        qr_code: `HGOS-DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        tier: 'bronze', points_balance: 0, points_earned_total: 0,
        enrolled_at: iso(enrolAt), birthday: g.persona.birthday,
      }).select('id').single()
      if (m) {
        g.memberId = m.id
        await db.from('loyalty_transactions').insert({
          venue_id: venueId, member_id: m.id, type: 'bonus', points: 50,
          balance_after: 50, description: 'Bonus de bienvenue', created_at: iso(enrolAt),
        })
        g.points = 50; ledgerRows++
      }
    }

    let totalSpent = 0
    for (const v of g.visits) {
      const { data: visit } = await db.from('visits').insert({
        venue_id: venueId, guest_id: g.id, visited_at: iso(v.at),
        party_size: v.party, spend_amount: v.spend, source: 'walkin',
      }).select('id').single()
      visitRows++
      totalSpent += v.spend

      if (g.memberId && v.at >= new Date(g.visits[0].at)) {
        const earned = Math.floor(v.spend * 10)
        g.points += earned
        await db.from('loyalty_transactions').insert({
          venue_id: venueId, member_id: g.memberId, type: 'earn', points: earned,
          balance_after: g.points, description: `Visite — ${v.spend.toFixed(2)} $`,
          reference_id: visit?.id ?? null, created_at: iso(v.at),
        })
        ledgerRows++
      }
    }

    // Tier from the real thresholds, and guest totals from the real visits.
    const tier = g.memberId ? tierFor(g.points, thresholds) : 'none'
    g.tier = tier
    const last = g.visits[g.visits.length - 1]
    await db.from('guests').update({
      total_visits: g.visits.length,
      total_spent: Math.round(totalSpent * 100) / 100,
      first_visit_at: iso(g.visits[0].at),
      last_visit_at: iso(last.at),
      loyalty_tier: tier as never,
    }).eq('id', g.id)
    if (g.memberId) {
      await db.from('loyalty_members').update({ tier: tier === 'none' ? 'bronze' : tier as never, last_activity_at: iso(last.at) }).eq('id', g.memberId)
    }
  }
  stats.visits = visitRows
  stats.ledger = ledgerRows
  console.log(`✅ ${visitRows} visits · ${ledgerRows} loyalty ledger rows`)

  // ── 4. Redemptions — deliberately low, one of the venue's real problems ────
  let redemptions = 0
  for (const g of guests) {
    if (!g.memberId || g.points < 400) continue
    if (!chance(0.12)) continue
    const reward = REWARDS.filter(r => r.points_cost <= g.points)[0]
    if (!reward) continue
    const at = addDays(g.visits[g.visits.length - 1].at, -intBetween(0, 40))
    g.points -= reward.points_cost
    await db.from('loyalty_transactions').insert({
      venue_id: venueId, member_id: g.memberId, type: 'redeem', points: -reward.points_cost,
      balance_after: g.points, description: `Récompense — ${reward.name}`, created_at: iso(at),
    })
    redemptions++
  }
  stats.redemptions = redemptions
  console.log(`✅ ${redemptions} reward redemptions (deliberately low — a real finding)`)

  // ── 5. Birthday bonuses ───────────────────────────────────────────────────
  let birthdayBonuses = 0
  for (const g of guests) {
    if (!g.memberId || !g.persona.birthday) continue
    const [, mm, dd] = g.persona.birthday.split('-')
    for (const year of [2025, 2026]) {
      const bday = new Date(`${year}-${mm}-${dd}T10:00:00Z`)
      if (bday < START || bday > TODAY) continue
      g.points += 250
      await db.from('loyalty_transactions').insert({
        venue_id: venueId, member_id: g.memberId, type: 'bonus', points: 250,
        balance_after: g.points, description: "Bonus d'anniversaire", created_at: iso(bday),
      })
      birthdayBonuses++
    }
  }
  stats.birthdayBonuses = birthdayBonuses
  console.log(`✅ ${birthdayBonuses} birthday bonuses`)

  console.log('\n— phase 1 complete —')
  return { db, venueId, guests, stats }
}

main().then(() => process.exit(0)).catch(e => { console.error('FAILED:', e); process.exit(1) })
