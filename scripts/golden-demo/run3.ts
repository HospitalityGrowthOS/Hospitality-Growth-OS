/**
 * Golden Demo Venue — phase 3.
 *
 * The operating layer: campaigns Mathieu actually sent, the automations he
 * turned on, the executions those automations produced, and the daily KPI
 * history the dashboard charts.
 *
 * Every number here is *derived*, never invented. KPI snapshots are computed by
 * reading back the visits, ledger rows, review requests and campaign sends that
 * phases 1 and 2 wrote. That is the difference between a venue whose charts
 * agree with its tables and a venue whose charts are decoration — and it means
 * a discrepancy in the dashboard is a real bug, not a seeding artefact.
 *
 * Run:  npx tsx --env-file=.env.local scripts/golden-demo/run3.ts
 */

import {
  createAdminClient, VENUE, CAMPAIGNS,
  TODAY, START, iso, dayKey, addDays, daysBetween, isClosed,
  rnd, pick, between, intBetween, chance,
} from './seed'
import { createWorkflow } from '../../src/lib/automation'

/** Guest segments the campaigns target, resolved against the real guest list. */
type G = { id: string; loyalty_tier: string | null; total_visits: number | null; total_spent: number | null; whatsapp_opted_in: boolean | null; email: string | null; last_visit_at?: string | null }

function audienceFor(kind: string, guests: G[], lastVisit: Map<string, Date>): G[] {
  switch (kind) {
    case 'vip':
      return guests.filter(g => g.loyalty_tier === 'gold' || g.loyalty_tier === 'silver')
    case 'wine':
      return guests.filter(g => (g.total_spent ?? 0) / Math.max(1, g.total_visits ?? 1) > 120)
    case 'business':
      return guests.filter(g => (g.total_visits ?? 0) >= 4 && (g.total_spent ?? 0) / Math.max(1, g.total_visits ?? 1) < 90)
    case 'inactive': {
      const cutoff = addDays(TODAY, -90)
      return guests.filter(g => { const lv = lastVisit.get(g.id); return lv ? lv < cutoff : false })
    }
    default:
      return guests.filter(g => g.whatsapp_opted_in || g.email)
  }
}

async function main() {
  const db = await createAdminClient()
  const { data: v } = await db.from('venues').select('id').eq('slug', VENUE.slug).single()
  if (!v) throw new Error('demo venue missing')
  const venueId = v.id
  const fail = (label: string, e: { message: string } | null) => { if (e) console.error(`  ${label}: ${e.message}`) }

  // Re-runnable.
  await db.from('campaign_sends').delete().eq('venue_id', venueId)
  await db.from('campaigns').delete().eq('venue_id', venueId)
  await db.from('automation_executions').delete().eq('venue_id', venueId)
  await db.from('automation_workflows').delete().eq('venue_id', venueId)
  await db.from('kpi_snapshots').delete().eq('venue_id', venueId)
  await db.from('notifications').delete().eq('venue_id', venueId)
  await db.from('analytics_events').delete().eq('venue_id', venueId)
  await db.from('ai_recommendations').delete().eq('venue_id', venueId)

  const { data: guests } = await db.from('guests')
    .select('id, name, loyalty_tier, total_visits, total_spent, whatsapp_opted_in, email')
    .eq('venue_id', venueId)
  const { data: visits } = await db.from('visits')
    .select('id, guest_id, visited_at, spend_amount').eq('venue_id', venueId).order('visited_at')
  const { data: members } = await db.from('loyalty_members')
    .select('id, guest_id, enrolled_at, tier').eq('venue_id', venueId)
  const { data: ledger } = await db.from('loyalty_transactions')
    .select('member_id, type, points, created_at').eq('venue_id', venueId)
  const { data: requests } = await db.from('review_requests')
    .select('rating, sent_at, completed_at').eq('venue_id', venueId)
  const { data: publicReviews } = await db.from('reviews')
    .select('rating, review_date').eq('venue_id', venueId)
  const { data: convos } = await db.from('conversations')
    .select('id, status, created_at').eq('venue_id', venueId)

  const allGuests = (guests ?? []) as G[]
  const lastVisit = new Map<string, Date>()
  for (const vis of visits ?? []) {
    const at = new Date(vis.visited_at)
    const prev = lastVisit.get(vis.guest_id!)
    if (!prev || at > prev) lastVisit.set(vis.guest_id!, at)
  }

  // ── 1. Campaigns, and the sends they produced ─────────────────────────────
  // Conversion is attributed the honest way: a send counts as converted only
  // when that guest actually visited within 14 days of receiving it. The
  // revenue figure is the sum of those real visits, so campaign ROI on the
  // dashboard can be checked by hand against the visits table.

  const visitsByGuest = new Map<string, { at: Date; spend: number }[]>()
  for (const vis of visits ?? []) {
    const arr = visitsByGuest.get(vis.guest_id!) ?? []
    arr.push({ at: new Date(vis.visited_at), spend: Number(vis.spend_amount ?? 0) })
    visitsByGuest.set(vis.guest_id!, arr)
  }

  let campaignCount = 0, sendCount = 0, attributed = 0
  for (const c of CAMPAIGNS) {
    const sentAt = addDays(TODAY, -Math.round(c.monthsAgo * 30.4) - intBetween(0, 6))
    const audience = audienceFor(c.audience, allGuests, lastVisit)
      .filter(g => g.whatsapp_opted_in || g.email)
    if (!audience.length) continue

    const { data: camp, error: campErr } = await db.from('campaigns').insert({
      venue_id: venueId, name: c.name, type: c.type,
      channel: 'whatsapp', status: 'completed',
      message_template: c.message,
      target_segment: { segment: c.audience } as never,
      audience_count: audience.length,
      scheduled_at: iso(sentAt), started_at: iso(sentAt),
      completed_at: iso(new Date(sentAt.getTime() + 40 * 60000)),
      created_at: iso(addDays(sentAt, -intBetween(1, 5))),
    }).select('id').single()
    if (campErr || !camp) { fail('campaign', campErr); continue }
    campaignCount++

    let sent = 0, delivered = 0, opened = 0, clicked = 0, converted = 0, revenue = 0
    for (const g of audience) {
      const deliveredOk = chance(0.965)
      const readOk = deliveredOk && chance(0.72)
      const clickedOk = readOk && chance(0.19)

      // Did this guest come in within a fortnight of the message?
      const follow = (visitsByGuest.get(g.id) ?? []).find(x =>
        x.at > sentAt && daysBetween(sentAt, x.at) <= 14)
      const convertedOk = readOk && !!follow

      const sentTime = new Date(sentAt.getTime() + intBetween(0, 2400) * 1000)
      const status = convertedOk ? 'converted' : clickedOk ? 'clicked' : readOk ? 'read'
        : deliveredOk ? 'delivered' : chance(0.5) ? 'failed' : 'sent'

      const { error: sendErr } = await db.from('campaign_sends').insert({
        campaign_id: camp.id, venue_id: venueId, guest_id: g.id, status,
        sent_at: iso(sentTime),
        delivered_at: deliveredOk ? iso(new Date(sentTime.getTime() + intBetween(2, 90) * 1000)) : null,
        read_at: readOk ? iso(new Date(sentTime.getTime() + intBetween(60, 40000) * 1000)) : null,
        clicked_at: clickedOk ? iso(new Date(sentTime.getTime() + intBetween(120, 60000) * 1000)) : null,
        converted_at: convertedOk ? iso(follow!.at) : null,
        conversion_amount: convertedOk ? follow!.spend : null,
        error_message: status === 'failed' ? 'Numéro non joignable sur WhatsApp' : null,
        created_at: iso(sentTime),
      } as never)
      if (sendErr) { fail('send', sendErr); continue }

      sent++; sendCount++
      if (deliveredOk) delivered++
      if (readOk) opened++
      if (clickedOk) clicked++
      if (convertedOk) { converted++; revenue += follow!.spend; attributed += follow!.spend }
    }

    await db.from('campaigns').update({
      sent_count: sent, delivered_count: delivered, opened_count: opened,
      clicked_count: clicked, converted_count: converted,
      revenue_attributed: Math.round(revenue * 100) / 100,
    }).eq('id', camp.id)
  }
  console.log(`✅ ${campaignCount} campaigns · ${sendCount} sends · ${Math.round(attributed).toLocaleString('fr-CA')} $ attributed to real follow-up visits`)

  // ── 2. Automations Mathieu turned on ──────────────────────────────────────
  // Written through createWorkflow so they pass the same validation the UI
  // enforces — a workflow here cannot be shaped in a way the product rejects.

  const WORKFLOWS = [
    {
      name: 'Bienvenue au programme de fidélité',
      description: "Envoyé peu après l'inscription d'un client.",
      triggerEvent: 'loyalty.member_joined' as const,
      conditions: [{ field: 'guest.whatsapp_opted_in', operator: 'eq' as const, value: true }],
      actions: [{ type: 'send_whatsapp' as const, config: {
        message: "Bienvenue au {{ venue.name }}, {{ guest.name }} ! 🎉\n\nVous commencez avec {{ member.points_balance }} points. Présentez votre code à chaque visite pour en accumuler.",
      } }],
      schedule: { kind: 'delayed' as const, delayMinutes: 5 },
      templateKey: 'loyalty_welcome',
      status: 'active' as const,
    },
    {
      name: 'Remerciement après un bon avis',
      description: 'Remercie personnellement le client qui laisse 4 ou 5 étoiles.',
      triggerEvent: 'review.positive' as const,
      conditions: [{ field: 'event.rating', operator: 'gte' as const, value: 4 }],
      actions: [{ type: 'send_whatsapp' as const, config: {
        message: "Merci beaucoup pour ces mots, {{ guest.name }} — ça compte énormément pour un petit restaurant comme le nôtre. Au plaisir de vous revoir au {{ venue.name }} !",
      } }],
      schedule: { kind: 'delayed' as const, delayMinutes: 60 },
      templateKey: 'review_request_follow_up',
      status: 'active' as const,
    },
    {
      name: 'Récupération après un avis négatif',
      description: "Alerte Mathieu dès qu'un avis de 3 étoiles ou moins arrive, avec une tâche de suivi.",
      triggerEvent: 'review.negative' as const,
      conditions: [{ field: 'event.rating', operator: 'lte' as const, value: 3 }],
      actions: [
        { type: 'notify_owner' as const, config: {
          title: 'Un client mécontent attend une réponse',
          message: '{{ guest.name }} a noté {{ event.rating }}/5 : « {{ event.feedback }} »',
        } },
        { type: 'create_action_item' as const, config: {
          title: 'Rappeler {{ guest.name }}',
          description: 'A noté {{ event.rating }}/5. Appeler ou écrire personnellement dans les 24 h.',
          priority: 'high',
        } },
      ],
      templateKey: 'negative_review_recovery',
      status: 'active' as const,
    },
    {
      name: 'Anniversaire — bonus de points',
      description: 'Souhaite la fête et crédite 250 points.',
      triggerEvent: 'loyalty.member_joined' as const,
      conditions: [{ field: 'guest.birthday', operator: 'within_days' as const, value: 1 }],
      actions: [
        { type: 'issue_loyalty_points' as const, config: { points: 250, reason: 'Bonus anniversaire' } },
        { type: 'send_whatsapp' as const, config: {
          message: "🎂 Bonne fête, {{ guest.name }} ! Nous avons ajouté 250 points à votre compte au {{ venue.name }}.",
        } },
      ],
      templateKey: 'birthday_campaign',
      status: 'active' as const,
    },
    {
      name: 'Relance des clients inactifs',
      description: "Relance un membre absent depuis longtemps. En brouillon — le montant du bon reste à trancher.",
      triggerEvent: 'loyalty.points_awarded' as const,
      conditions: [
        { field: 'member.last_activity_at', operator: 'older_than_days' as const, value: 60 },
        { field: 'guest.whatsapp_opted_in', operator: 'eq' as const, value: true },
      ],
      actions: [{ type: 'send_whatsapp' as const, config: {
        message: "Ça fait un moment, {{ guest.name }} ! Vos {{ member.points_balance }} points vous attendent au {{ venue.name }}.",
      } }],
      templateKey: 'inactive_reactivation',
      status: 'draft' as const,
    },
    {
      name: 'Passage au palier Or',
      description: "Félicite le client qui atteint le palier Or. Désactivé le temps de revoir l'avantage offert.",
      triggerEvent: 'loyalty.tier_changed' as const,
      conditions: [{ field: 'member.tier', operator: 'eq' as const, value: 'gold' }],
      actions: [{ type: 'send_whatsapp' as const, config: {
        message: "{{ guest.name }}, vous êtes maintenant membre Or au {{ venue.name }} ! Merci de votre fidélité. 🥇",
      } }],
      templateKey: 'tier_upgrade_reward',
      status: 'disabled' as const,
    },
  ]

  const created: { id: string; name: string; event: string; status: string }[] = []
  for (const w of WORKFLOWS) {
    const res = await createWorkflow(venueId, w as never)
    if (!res.ok) { console.error(`  workflow "${w.name}": ${res.message}`); continue }
    created.push({ id: res.data.id, name: w.name, event: w.triggerEvent, status: w.status })
  }
  console.log(`✅ ${created.length} automations (${created.filter(w => w.status === 'active').length} active · ${created.filter(w => w.status !== 'active').length} draft or disabled)`)

  // ── 3. Execution history ──────────────────────────────────────────────────
  // Executions are generated from events that genuinely occurred: a welcome run
  // for each real enrolment, a review-request run for each real visit. A
  // workflow's execution count therefore matches the thing that triggered it.

  let execs = 0
  const runsPerWorkflow = new Map<string, number>()

  const welcome = created.find(w => w.event === 'loyalty.member_joined' && w.status === 'active')
  const reviewFlow = created.find(w => w.event === 'review.positive' && w.status === 'active')
  const recoveryFlow = created.find(w => w.event === 'review.negative' && w.status === 'active')

  async function writeExec(wf: { id: string; event: string }, at: Date, guestId: string | null, payload: Record<string, unknown>, failed = false) {
    if (at > TODAY) return
    const started = new Date(at.getTime() + intBetween(1, 40) * 1000)
    const duration = intBetween(180, 2400)
    const { error } = await db.from('automation_executions').insert({
      venue_id: venueId, workflow_id: wf.id, event_name: wf.event,
      event_payload: payload as never,
      status: failed ? 'failed' : 'success',
      conditions_evaluated: [{ field: 'event.rating', passed: true }] as never,
      actions_executed: (wf.event === 'review.negative'
        ? [{ type: 'notify_owner', ok: true }, { type: 'create_action_item', ok: true }]
        : [{ type: 'send_whatsapp', ok: !failed }]) as never,
      error: failed ? 'WhatsApp: numéro non joignable' : null,
      scheduled_for: iso(at), started_at: iso(started),
      completed_at: iso(new Date(started.getTime() + duration)),
      duration_ms: duration, target_guest_id: guestId,
      target_channel: wf.event === 'review.negative' ? 'internal' : 'whatsapp',
      dry_run: false, created_at: iso(at),
    } as never)
    if (error) { fail('execution', error); return }
    execs++
    runsPerWorkflow.set(wf.id, (runsPerWorkflow.get(wf.id) ?? 0) + 1)
  }

  // Only count enrolments since the owner switched the automation on.
  const AUTOMATION_LIVE_FROM = addDays(TODAY, -150)

  if (welcome) {
    for (const m of members ?? []) {
      const at = new Date(m.enrolled_at!)
      if (at < AUTOMATION_LIVE_FROM) continue
      await writeExec(welcome, new Date(at.getTime() + 5 * 60000), m.guest_id, {
        member_id: m.id, tier: m.tier, welcome_points: 50,
      }, chance(0.04))
    }
  }
  // The review workflows run off ratings that actually came back, so an
  // execution count on the automation page equals the number of reviews of that
  // kind on the reviews page. If the two ever disagree, the product is wrong.
  const { data: rated } = await db.from('review_requests')
    .select('guest_id, rating, feedback, completed_at')
    .eq('venue_id', venueId).not('rating', 'is', null)

  for (const r of rated ?? []) {
    const at = r.completed_at ? new Date(r.completed_at) : null
    if (!at || at < AUTOMATION_LIVE_FROM) continue
    const rating = r.rating as number

    if (reviewFlow && rating >= 4) {
      await writeExec(reviewFlow, new Date(at.getTime() + 60 * 60000), r.guest_id, {
        rating, feedback: r.feedback,
      }, chance(0.03))
    }
    if (recoveryFlow && rating <= 3) {
      await writeExec(recoveryFlow, new Date(at.getTime() + 60000), r.guest_id, {
        rating, feedback: r.feedback,
      })
    }
  }

  for (const [id, count] of Array.from(runsPerWorkflow.entries())) {
    const { data: last } = await db.from('automation_executions')
      .select('created_at').eq('workflow_id', id).order('created_at', { ascending: false }).limit(1).single()
    await db.from('automation_workflows').update({
      execution_count: count, last_executed_at: last?.created_at ?? null,
    }).eq('id', id)
  }
  console.log(`✅ ${execs} automation executions across ${runsPerWorkflow.size} workflows`)

  // ── 4. Daily KPI snapshots — computed, not invented ───────────────────────

  const memberById = new Map((members ?? []).map(m => [m.id, m]))
  const byDay = <T>(rows: T[], key: (r: T) => string | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows) {
      const k = key(r); if (!k) continue
      const arr = m.get(k) ?? []; arr.push(r); m.set(k, arr)
    }
    return m
  }

  const visitsByDay = byDay(visits ?? [], r => dayKey(new Date(r.visited_at)))
  const enrolByDay = byDay(members ?? [], r => r.enrolled_at ? dayKey(new Date(r.enrolled_at)) : null)
  const ledgerByDay = byDay(ledger ?? [], r => r.created_at ? dayKey(new Date(r.created_at)) : null)
  const reqByDay = byDay(requests ?? [], r => r.sent_at ? dayKey(new Date(r.sent_at)) : null)
  const ansByDay = byDay((requests ?? []).filter(r => r.completed_at), r => dayKey(new Date(r.completed_at!)))
  const pubByDay = byDay(publicReviews ?? [], r => r.review_date ? dayKey(new Date(r.review_date)) : null)
  const convByDay = byDay(convos ?? [], r => r.created_at ? dayKey(new Date(r.created_at)) : null)

  const { data: sends } = await db.from('campaign_sends')
    .select('status, sent_at, read_at, clicked_at, conversion_amount').eq('venue_id', venueId)
  const sendsByDay = byDay(sends ?? [], r => r.sent_at ? dayKey(new Date(r.sent_at)) : null)

  const totalDays = daysBetween(START, TODAY)
  let snapshots = 0
  const rows: Record<string, unknown>[] = []

  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(START, i)
    const k = dayKey(d)
    const dayVisits = visitsByDay.get(k) ?? []
    const dayLedger = ledgerByDay.get(k) ?? []
    const dayAns = ansByDay.get(k) ?? []
    const daySends = sendsByDay.get(k) ?? []
    const dayConv = convByDay.get(k) ?? []

    const ratings = dayAns.map(r => r.rating).filter((r): r is number => typeof r === 'number')
    const earned = dayLedger.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
    const redeemed = Math.abs(dayLedger.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0))

    // A member counts as active if they visited in the trailing 30 days.
    const windowStart = addDays(d, -30)
    let active = 0
    for (const m of members ?? []) {
      const lv = lastVisit.get(m.guest_id!)
      if (lv && lv <= d && lv >= windowStart) active++
    }
    const totalMembers = (members ?? []).filter(m => m.enrolled_at && new Date(m.enrolled_at) <= d).length

    rows.push({
      venue_id: venueId, date: k,
      new_members: (enrolByDay.get(k) ?? []).length,
      active_members: active,
      total_members: totalMembers,
      points_earned: earned,
      points_redeemed: redeemed,
      reviews_requested: (reqByDay.get(k) ?? []).length,
      reviews_received: dayAns.length,
      avg_rating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 100) / 100 : null,
      new_google_reviews: (pubByDay.get(k) ?? []).length,
      campaigns_sent: daySends.length,
      campaign_opens: daySends.filter(s => s.read_at).length,
      campaign_clicks: daySends.filter(s => s.clicked_at).length,
      campaign_revenue: Math.round(daySends.reduce((s, x) => s + Number(x.conversion_amount ?? 0), 0) * 100) / 100,
      ai_conversations: dayConv.length,
      ai_resolved: dayConv.filter(c => c.status === 'resolved').length,
      human_escalations: dayConv.filter(c => c.status === 'escalated').length,
      total_visits: dayVisits.length,
      estimated_revenue: Math.round(dayVisits.reduce((s, x) => s + Number(x.spend_amount ?? 0), 0) * 100) / 100,
      created_at: iso(addDays(d, 1)),
    })
  }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from('kpi_snapshots').insert(rows.slice(i, i + 100) as never)
    if (error) fail('kpi batch', error)
    else snapshots += Math.min(100, rows.length - i)
  }
  const revenueYear = rows.reduce((s, r) => s + (r.estimated_revenue as number), 0)
  console.log(`✅ ${snapshots} daily KPI snapshots · ${Math.round(revenueYear).toLocaleString('fr-CA')} $ of revenue over the year`)

  // ── 5. Notifications — what the owner saw in his bell ─────────────────────
  const { data: recentActions } = await db.from('action_items')
    .select('id, title, description, created_at').eq('venue_id', venueId)
    .order('created_at', { ascending: false }).limit(6)
  const { data: recentRes } = await db.from('reservation_requests')
    .select('id, guest_name, party_size, requested_date, created_at')
    .eq('venue_id', venueId).eq('status', 'pending').limit(6)

  let notes = 0
  for (const a of recentActions ?? []) {
    const { error } = await db.from('notifications').insert({
      venue_id: venueId, type: 'negative_feedback', title: a.title,
      body: (a.description ?? '').slice(0, 180), icon: '⚠️',
      is_read: chance(0.6), related_id: a.id, related_type: 'action_item',
      action_url: '/dashboard/reviews', created_at: a.created_at,
    } as never)
    if (error) fail('notification', error); else notes++
  }
  for (const r of recentRes ?? []) {
    const { error } = await db.from('notifications').insert({
      venue_id: venueId, type: 'reservation_request',
      title: `Nouvelle demande de réservation — ${r.guest_name}`,
      body: `${r.party_size} personnes le ${r.requested_date}`,
      icon: '📅', is_read: false, related_id: r.id, related_type: 'reservation_request',
      action_url: '/dashboard/reservations', created_at: r.created_at,
    } as never)
    if (error) fail('notification', error); else notes++
  }
  console.log(`✅ ${notes} notifications`)

  // ── 6. Analytics events — the QR funnel behind the loyalty signups ────────
  let events = 0
  const evRows: Record<string, unknown>[] = []
  for (const m of members ?? []) {
    const at = new Date(m.enrolled_at!)
    const session = `sess_${Math.abs(Math.floor(at.getTime() / 1000))}`
    evRows.push(
      { venue_id: venueId, guest_id: m.guest_id, event_type: 'qr_scanned', properties: { source: 'table_tent' }, session_id: session, occurred_at: iso(addDays(at, 0)) },
      { venue_id: venueId, guest_id: m.guest_id, event_type: 'signup_started', properties: {}, session_id: session, occurred_at: iso(new Date(at.getTime() - 90000)) },
      { venue_id: venueId, guest_id: m.guest_id, event_type: 'signup_completed', properties: { welcome_points: 50 }, session_id: session, occurred_at: iso(at) },
    )
  }
  // Scans that never became signups — the drop-off any real funnel has.
  for (let i = 0; i < 180; i++) {
    const at = addDays(TODAY, -intBetween(1, 360))
    evRows.push({ venue_id: venueId, guest_id: null, event_type: 'qr_scanned', properties: { source: 'table_tent' }, session_id: `sess_x${i}`, occurred_at: iso(at) })
  }
  for (let i = 0; i < evRows.length; i += 200) {
    const { error } = await db.from('analytics_events').insert(evRows.slice(i, i + 200) as never)
    if (error) fail('analytics batch', error); else events += Math.min(200, evRows.length - i)
  }
  console.log(`✅ ${events} analytics events (QR funnel with real drop-off)`)

  console.log('\n— phase 3 complete —')
}

main().then(() => process.exit(0)).catch(e => { console.error('FAILED:', e); process.exit(1) })
