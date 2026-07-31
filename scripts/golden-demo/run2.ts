/**
 * Golden Demo Venue — phase 2.
 *
 * Everything that follows from visits: review requests and their outcomes,
 * public reviews, reservations, and the assistant's conversation history.
 *
 * Reads the visits phase 1 created rather than inventing new ones, so a poor
 * rating always traces back to a specific slow Friday service that is visible
 * in the same data. That traceability is the whole point — it is what lets
 * Growth Intelligence find a cause rather than a coincidence.
 *
 * Run:  npx tsx --env-file=.env.local scripts/golden-demo/run2.ts
 */

import {
  createAdminClient, VENUE, CONVERSATIONS,
  TODAY, iso, addDays,
  serviceLoad, experienceScore, ratingFrom, reviewTextFor, inServiceCrisis,
  rnd, pick, between, intBetween, chance,
} from './seed'

async function main() {
  const db = await createAdminClient()
  const { data: v } = await db.from('venues').select('id, settings').eq('slug', VENUE.slug).single()
  if (!v) throw new Error('demo venue missing')
  const venueId = v.id
  const stats: Record<string, number> = {}

  // Re-runnable: clear what this phase creates before creating it again.
  const { data: oldConvos } = await db.from('conversations').select('id').eq('venue_id', venueId)
  if (oldConvos?.length) await db.from('messages').delete().in('conversation_id', oldConvos.map(c => c.id))
  await db.from('conversations').delete().eq('venue_id', venueId)
  await db.from('review_requests').delete().eq('venue_id', venueId)
  await db.from('reviews').delete().eq('venue_id', venueId)
  await db.from('reservation_requests').delete().eq('venue_id', venueId)
  await db.from('action_items').delete().eq('venue_id', venueId)

  const { data: visits } = await db.from('visits')
    .select('id, guest_id, visited_at, spend_amount, party_size')
    .eq('venue_id', venueId).order('visited_at')
  const { data: guests } = await db.from('guests')
    .select('id, name, phone, email, loyalty_tier, total_visits, whatsapp_opted_in')
    .eq('venue_id', venueId)
  const guestById = new Map((guests ?? []).map(g => [g.id, g]))
  if (!visits?.length) throw new Error('no visits — run phase 1 first')

  // ── 1. Review requests, and the ratings that follow ───────────────────────
  // Requests go out after most visits. Whether a guest answers depends on how
  // the visit went and who they are — extremes respond, mediocrity does not.

  let sent = 0, answered = 0, positive = 0, negative = 0
  let crisisLow = 0, peakLow = 0
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const negativeVisits: { guestId: string; at: Date; rating: number; text: string }[] = []

  for (const visit of visits) {
    const at = new Date(visit.visited_at)
    const guest = guestById.get(visit.guest_id!)
    if (!guest) continue
    // Requests only go to guests reachable on a channel.
    if (!guest.whatsapp_opted_in && !guest.email) continue
    if (!chance(0.86)) continue

    const hour = at.getUTCHours()
    const load = serviceLoad(at, hour)
    const { score } = experienceScore(load, inServiceCrisis(at), at)
    const tolerance = guest.total_visits > 6 ? 0.7 : guest.total_visits > 2 ? 0.5 : 0.35

    const requestedAt = new Date(at.getTime() + 45 * 60000)
    if (requestedAt > TODAY) continue

    // Response probability rises with the strength of the experience in either
    // direction — a J-shaped outcome, which is how real review sets look.
    const rating = ratingFrom(score, tolerance)
    const strength = Math.abs(rating - 3.4) / 1.6
    const responds = chance(0.07 + strength * 0.30)

    // Delivered but unanswered is 'sent'. This needs supabase/review_request_status.sql
    // applied — before that migration the constraint rejected 'sent' outright.
    const status = responds ? (rating >= 4 ? 'positive' : 'negative') : 'sent'
    const completedAt = responds ? new Date(requestedAt.getTime() + between(0.4, 30) * 3600000) : null
    const text = responds && chance(0.62) ? reviewTextFor(rating) : null

    const { error: reqErr } = await db.from('review_requests').insert({
      venue_id: venueId, guest_id: guest.id, visit_id: visit.id,
      guest_name: guest.name, guest_phone: guest.phone,
      channel: guest.whatsapp_opted_in ? 'whatsapp' : 'email',
      status, rating: responds ? rating : null, feedback: text,
      scheduled_for: iso(requestedAt), sent_at: iso(requestedAt),
      completed_at: completedAt ? iso(completedAt) : null,
      created_at: iso(requestedAt),
    } as never)
    if (reqErr) { console.error('  review request failed:', reqErr.message); continue }
    sent++

    if (responds) {
      answered++
      ratingCounts[rating]++
      if (rating >= 4) positive++
      else {
        negative++
        if (inServiceCrisis(at)) crisisLow++
        if ((at.getUTCDay() === 5 || at.getUTCDay() === 6) && hour >= 19 && hour <= 21) peakLow++
        negativeVisits.push({ guestId: guest.id, at, rating, text: text ?? reviewTextFor(rating) })
      }
    }
  }
  stats.reviewRequests = sent
  stats.reviewsAnswered = answered
  console.log(`✅ ${sent} review requests · ${answered} answered (${Math.round(answered / sent * 100)}%)`)
  console.log(`   ratings — 5★:${ratingCounts[5]} 4★:${ratingCounts[4]} 3★:${ratingCounts[3]} 2★:${ratingCounts[2]} 1★:${ratingCounts[1]}`)
  const avg = (5*ratingCounts[5]+4*ratingCounts[4]+3*ratingCounts[3]+2*ratingCounts[2]+ratingCounts[1]) / answered
  console.log(`   average ${avg.toFixed(2)} — of ${negative} poor ratings, ${crisisLow} fall in the March crisis and ${peakLow} on a saturated Fri/Sat peak`)

  // ── 2. Public reviews — the positive ones that reached Google ─────────────
  let publicReviews = 0
  for (const visit of visits) {
    if (!chance(0.09)) continue
    const guest = guestById.get(visit.guest_id!)
    if (!guest) continue
    const at = new Date(visit.visited_at)
    const load = serviceLoad(at, at.getUTCHours())
    const { score } = experienceScore(load, inServiceCrisis(at), at)
    const rating = ratingFrom(score, 0.55)
    if (rating < 4) continue
    const reviewedAt = new Date(at.getTime() + between(2, 96) * 3600000)
    if (reviewedAt > TODAY) continue

    const { error: revErr } = await db.from('reviews').insert({
      venue_id: venueId, guest_id: guest.id, platform: 'google',
      rating, content: reviewTextFor(rating), author_name: guest.name,
      review_date: iso(reviewedAt),
      status: chance(0.55) ? 'responded' : 'pending',
      owner_response: chance(0.55)
        ? "Merci beaucoup pour ces mots ! Toute l'équipe est ravie. Au plaisir de vous revoir bientôt au bistro. — Mathieu"
        : null,
      created_at: iso(reviewedAt),
    } as never)
    if (revErr) { console.error('  public review failed:', revErr.message); continue }
    publicReviews++
  }
  stats.publicReviews = publicReviews
  console.log(`✅ ${publicReviews} public Google reviews`)

  // ── 3. Action items from the criticism that stayed private ───────────────
  let actionItems = 0
  for (const n of negativeVisits.slice(-9)) {
    const guest = guestById.get(n.guestId)
    await db.from('action_items').insert({
      venue_id: venueId,
      title: `Avis ${n.rating}★ — suivi requis`,
      description: `${guest?.name ?? 'Un client'} a noté ${n.rating}/5 : « ${n.text.slice(0, 220)} »`,
      type: 'negative_feedback',
      priority: n.rating <= 2 ? 'high' : 'medium',
      status: chance(0.55) ? 'done' : 'pending',
      created_at: iso(addDays(n.at, 1)),
    } as never)
    actionItems++
  }
  stats.actionItems = actionItems
  console.log(`✅ ${actionItems} action items from private criticism`)

  // ── 4. Reservations ───────────────────────────────────────────────────────
  // A booking that produced a visit was honoured; a booking that was cancelled,
  // declined or no-showed produced no visit at all. So the two kinds are
  // generated separately rather than by relabelling the same rows — otherwise
  // the venue would contain guests who failed to turn up and dined anyway.
  // Weighted by repetition rather than picked uniformly. A uniform list gave the
  // venue as many engagements as birthdays, which no bistro sees, and put a
  // special occasion on two thirds of its bookings — most tables are just
  // dinner.
  const OCCASIONS = [
    'Anniversaire', 'Anniversaire', 'Anniversaire', 'Anniversaire',
    "Souper d'affaires", "Souper d'affaires", "Souper d'affaires",
    'Anniversaire de mariage', 'Anniversaire de mariage',
    'Retrouvailles', 'Retrouvailles',
    'Fiançailles',
    ...Array(28).fill(null),
  ]
  let resTotal = 0, resCancelled = 0, resDeclined = 0, resNoShow = 0

  const timeOf = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

  async function addReservation(fields: Record<string, unknown>): Promise<boolean> {
    const { error } = await db.from('reservation_requests').insert({
      venue_id: venueId, ...fields,
    } as never)
    if (error) { console.error('  reservation failed:', error.message); return false }
    resTotal++
    return true
  }

  // Honoured bookings — one behind roughly a third of the visits that happened.
  for (const visit of visits.filter(() => chance(0.32))) {
    const guest = guestById.get(visit.guest_id!)
    if (!guest) continue
    const at = new Date(visit.visited_at)
    const requestedAt = addDays(at, -intBetween(1, 21))
    await addReservation({
      guest_id: guest.id, guest_name: guest.name, guest_phone: guest.phone,
      requested_date: iso(at).slice(0, 10),
      requested_time: timeOf(at),
      party_size: visit.party_size,
      notes: pick(OCCASIONS),
      channel: chance(0.45) ? 'whatsapp' : 'phone',
      status: 'completed',
      handled_at: iso(requestedAt),
      created_at: iso(requestedAt),
    })
  }

  // Bookings that never became a visit. Dated on evenings the bistro was open,
  // and deliberately not tied to any visit row.
  const openEvening = (): Date => {
    for (;;) {
      const d = addDays(TODAY, -intBetween(3, 330))
      if (d.getUTCDay() === 1) continue
      d.setUTCHours(intBetween(18, 20), pick([0, 15, 30, 45]), 0, 0)
      return d
    }
  }

  for (let i = 0; i < 46; i++) {
    const guest = pick(guests ?? [])
    const when = openEvening()
    const requestedAt = addDays(when, -intBetween(1, 18))
    const roll = rnd()
    // No-shows cluster on the busy nights, which is when they hurt.
    const busy = when.getUTCDay() === 5 || when.getUTCDay() === 6
    const status = roll < 0.42 ? 'cancelled'
      : roll < 0.58 ? 'declined'
      : (busy || chance(0.5)) ? 'no_show' : 'cancelled'

    const ok = await addReservation({
      guest_id: guest.id, guest_name: guest.name, guest_phone: guest.phone,
      requested_date: iso(when).slice(0, 10),
      requested_time: timeOf(when),
      party_size: intBetween(2, 7),
      notes: status === 'declined' ? 'Complet — proposé une autre date' : pick(OCCASIONS),
      channel: chance(0.5) ? 'whatsapp' : 'phone',
      status,
      handled_at: iso(requestedAt),
      created_at: iso(requestedAt),
    })
    if (!ok) continue
    if (status === 'cancelled') resCancelled++
    if (status === 'declined') resDeclined++
    if (status === 'no_show') resNoShow++
  }

  // Bookings still ahead — some confirmed, some the owner has not answered yet.
  let upcoming = 0, awaiting = 0
  for (let i = 0; i < 18; i++) {
    const g = pick(guests ?? [])
    const when = addDays(TODAY, intBetween(1, 18))
    if (when.getUTCDay() === 1) continue
    const status = chance(0.68) ? 'confirmed' : 'pending'
    const ok = await addReservation({
      guest_id: g.id, guest_name: g.name, guest_phone: g.phone,
      requested_date: iso(when).slice(0, 10),
      requested_time: pick(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30']),
      party_size: intBetween(2, 8), notes: pick(OCCASIONS),
      channel: chance(0.5) ? 'whatsapp' : 'phone', status,
      handled_at: status === 'confirmed' ? iso(addDays(TODAY, -intBetween(0, 3))) : null,
      created_at: iso(addDays(TODAY, -intBetween(0, 5))),
    })
    if (!ok) continue
    upcoming++
    if (status === 'pending') awaiting++
  }
  stats.reservations = resTotal
  console.log(`✅ ${resTotal} reservations (${resCancelled} cancelled · ${resDeclined} declined · ${resNoShow} no-shows · ${upcoming} upcoming, ${awaiting} awaiting reply)`)

  // ── 5. AI conversations ───────────────────────────────────────────────────
  let convos = 0, msgs = 0
  const conversationGuests = (guests ?? []).filter(() => chance(0.3)).slice(0, 34)

  for (let i = 0; i < conversationGuests.length; i++) {
    const guest = conversationGuests[i]
    const script = CONVERSATIONS[i % CONVERSATIONS.length]
    const startedAt = addDays(TODAY, -intBetween(1, 260))
    const escalated = script.topic === 'complaint' || script.topic === 'private_event'

    const { data: conv, error: convErr } = await db.from('conversations').insert({
      venue_id: venueId, guest_id: guest.id, channel: 'whatsapp',
      status: escalated ? 'escalated' : 'resolved',
      ai_handled: !escalated, context: { topic: script.topic } as never,
      created_at: iso(startedAt),
    }).select('id').single()
    if (convErr || !conv) {
      console.error('  conversation insert failed:', convErr?.message)
      continue
    }
    convos++

    let t = startedAt.getTime()
    for (const turn of script.turns) {
      t += intBetween(30, 240) * 1000
      await db.from('messages').insert({
        conversation_id: conv.id, venue_id: venueId,
        role: turn.role, content: turn.content,
        sent_at: iso(new Date(t)),
        intent: turn.role === 'user' ? script.topic : null,
        sentiment: script.topic === 'complaint' ? 'negative' : 'neutral',
        metadata: {} as never,
      } as never)
      msgs++
    }
  }
  stats.conversations = convos
  stats.messages = msgs
  console.log(`✅ ${convos} AI conversations · ${msgs} messages`)

  console.log('\n— phase 2 complete —')
  console.log('   run3.ts must follow: the KPI snapshots roll up what this phase just rewrote.')
}

main().then(() => process.exit(0)).catch(e => { console.error('FAILED:', e); process.exit(1) })
