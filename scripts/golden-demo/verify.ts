/**
 * Golden Demo Venue — coherence audit.
 *
 * Reads the venue back and checks that every dataset agrees with every other
 * one. This is the test that protects the demo: if a seeding change quietly
 * breaks the causal chain — reviews that trace to no visit, points that do not
 * match the ledger, a chart that disagrees with its table — this fails loudly
 * instead of the venue merely looking slightly wrong in a sales meeting.
 *
 * It also reports coverage: every dashboard surface must have something real to
 * show, because an empty page in a demo reads as a broken product.
 *
 * Run:  npx tsx --env-file=.env.local scripts/golden-demo/verify.ts
 */

import { createAdminClient, VENUE, TODAY, addDays, dayKey, iso, inServiceCrisis } from './seed'
import { isDemoSettings } from '../../src/lib/demo'

let passed = 0
const failures: string[] = []

function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  const db = await createAdminClient()
  const { data: v } = await db.from('venues').select('id, name, city, settings').eq('slug', VENUE.slug).single()
  if (!v) throw new Error('demo venue missing')
  const venueId = v.id

  const all = async <T,>(table: string, cols: string) => {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table as never).select(cols).eq('venue_id', venueId).range(from, from + 999)
      if (error) throw new Error(`${table}: ${error.message}`)
      out.push(...(data as T[]))
      if (!data || data.length < 1000) break
    }
    return out
  }

  const guests = await all<{ id: string; name: string; loyalty_points: number; total_visits: number; total_spent: number; loyalty_tier: string; created_at: string }>('guests', 'id, name, loyalty_points, total_visits, total_spent, loyalty_tier, created_at')
  const visits = await all<{ id: string; guest_id: string; visited_at: string; spend_amount: number }>('visits', 'id, guest_id, visited_at, spend_amount')
  const members = await all<{ id: string; guest_id: string; points_balance: number; points_earned_total: number; points_redeemed_total: number; tier: string }>('loyalty_members', 'id, guest_id, points_balance, points_earned_total, points_redeemed_total, tier')
  const ledger = await all<{ member_id: string; points: number; type: string; created_at: string }>('loyalty_transactions', 'member_id, points, type, created_at')
  const requests = await all<{ guest_id: string; visit_id: string; rating: number | null; sent_at: string; completed_at: string | null }>('review_requests', 'guest_id, visit_id, rating, sent_at, completed_at')
  const reviews = await all<{ guest_id: string; rating: number; review_date: string }>('reviews', 'guest_id, rating, review_date')
  const snapshots = await all<Record<string, number | string | null>>('kpi_snapshots', '*')
  const sends = await all<{ campaign_id: string; guest_id: string; status: string; conversion_amount: number | null }>('campaign_sends', 'campaign_id, guest_id, status, conversion_amount')
  const campaigns = await all<{ id: string; name: string; sent_count: number; converted_count: number; revenue_attributed: number }>('campaigns', 'id, name, sent_count, converted_count, revenue_attributed')
  const execs = await all<{ workflow_id: string; status: string; event_name: string }>('automation_executions', 'workflow_id, status, event_name')
  const workflows = await all<{ id: string; name: string; status: string; execution_count: number }>('automation_workflows', 'id, name, status, execution_count')
  const convos = await all<{ id: string; status: string }>('conversations', 'id, status')
  const reservations = await all<{ guest_id: string; status: string; requested_date: string; handled_at: string | null }>('reservation_requests', 'guest_id, status, requested_date, handled_at')
  const actions = await all<{ id: string; status: string }>('action_items', 'id, status')
  const notifs = await all<{ id: string }>('notifications', 'id')
  const rewards = await all<{ id: string; name: string }>('loyalty_rewards', 'id, name')
  const events = await all<{ event_type: string }>('analytics_events', 'event_type')

  const guestIds = new Set(guests.map(g => g.id))
  const visitById = new Map(visits.map(x => [x.id, x]))

  // ── Referential integrity ────────────────────────────────────────────────
  console.log('\nReferential integrity')
  check('every visit belongs to a real guest',
    visits.every(x => guestIds.has(x.guest_id)))
  check('every review request traces to a real visit',
    requests.every(r => !r.visit_id || visitById.has(r.visit_id)),
    `${requests.length} requests`)
  check('every public review belongs to a real guest',
    reviews.every(r => guestIds.has(r.guest_id)))
  check('every loyalty member is a real guest',
    members.every(m => guestIds.has(m.guest_id)))
  check('every campaign send targets a real guest',
    sends.every(s => guestIds.has(s.guest_id)))
  check('every reservation belongs to a real guest',
    reservations.every(r => guestIds.has(r.guest_id)))

  // ── Loyalty arithmetic — the class of bug that shipped silently before ───
  console.log('\nLoyalty arithmetic')
  const ledgerByMember = new Map<string, { points: number }[]>()
  for (const t of ledger) {
    const arr = ledgerByMember.get(t.member_id) ?? []
    arr.push(t); ledgerByMember.set(t.member_id, arr)
  }
  const noLedger = members.filter(m => !ledgerByMember.has(m.id))
  check('no member holds points with an empty ledger', noLedger.length === 0,
    noLedger.length ? `${noLedger.length} members` : `${members.length} members all have history`)

  const balanceMismatch = members.filter(m => {
    const sum = (ledgerByMember.get(m.id) ?? []).reduce((s, t) => s + t.points, 0)
    return Math.abs(sum - m.points_balance) > 0
  })
  check('points_balance equals the sum of its ledger', balanceMismatch.length === 0,
    balanceMismatch.length ? `${balanceMismatch.length} mismatched` : 'trigger-maintained, verified')

  const earnedMismatch = members.filter(m => {
    const earned = (ledgerByMember.get(m.id) ?? []).filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
    return Math.abs(earned - m.points_earned_total) > 0
  })
  check('points_earned_total is not double-counted', earnedMismatch.length === 0,
    earnedMismatch.length ? `${earnedMismatch.length} inflated` : 'matches positive ledger rows')

  const guestSync = members.filter(m => {
    const g = guests.find(x => x.id === m.guest_id)
    return g && g.loyalty_points !== m.points_balance
  })
  check('guests.loyalty_points is in sync with the member row', guestSync.length === 0,
    guestSync.length ? `${guestSync.length} out of sync` : '')

  // ── Guest rollups match their visits ─────────────────────────────────────
  console.log('\nGuest rollups')
  const visitAgg = new Map<string, { n: number; spend: number }>()
  for (const x of visits) {
    const a = visitAgg.get(x.guest_id) ?? { n: 0, spend: 0 }
    a.n++; a.spend += Number(x.spend_amount ?? 0)
    visitAgg.set(x.guest_id, a)
  }
  const countMismatch = guests.filter(g => (visitAgg.get(g.id)?.n ?? 0) !== g.total_visits)
  check('total_visits matches the visits table', countMismatch.length === 0,
    countMismatch.length ? `${countMismatch.length} guests off` : `${guests.length} guests`)
  const spendMismatch = guests.filter(g =>
    Math.abs((visitAgg.get(g.id)?.spend ?? 0) - Number(g.total_spent)) > 0.02)
  check('total_spent matches the visits table', spendMismatch.length === 0,
    spendMismatch.length ? `${spendMismatch.length} guests off` : '')

  // ── KPI snapshots agree with the tables they summarise ───────────────────
  //
  // These are a materialised rollup, so they go stale the moment a later run of
  // phase 2 changes the source rows without phase 3 recomputing them. A failure
  // here usually means exactly that rather than a coherence bug — but it is
  // still a failure, because a dashboard that disagrees with its own tables is
  // the thing this venue exists to rule out.
  const STALE = 'KPI snapshots are stale — re-run scripts/golden-demo/run3.ts'
  console.log('\nKPI snapshots vs source tables')
  const snapRevenue = snapshots.reduce((s, r) => s + Number(r.estimated_revenue ?? 0), 0)
  const realRevenue = visits.reduce((s, x) => s + Number(x.spend_amount ?? 0), 0)
  check('charted revenue equals the sum of visits',
    Math.abs(snapRevenue - realRevenue) < 1,
    `${Math.round(snapRevenue).toLocaleString('fr-CA')} $ vs ${Math.round(realRevenue).toLocaleString('fr-CA')} $` +
    (Math.abs(snapRevenue - realRevenue) < 1 ? '' : ` — ${STALE}`))

  const snapVisits = snapshots.reduce((s, r) => s + Number(r.total_visits ?? 0), 0)
  check('charted visit count equals the visits table',
    snapVisits === visits.length, `${snapVisits} vs ${visits.length}` +
    (snapVisits === visits.length ? '' : ` — ${STALE}`))

  const snapReviews = snapshots.reduce((s, r) => s + Number(r.reviews_received ?? 0), 0)
  const realAnswered = requests.filter(r => r.completed_at).length
  check('charted reviews received equals answered requests',
    snapReviews === realAnswered, `${snapReviews} vs ${realAnswered}` +
    (snapReviews === realAnswered ? '' : ` — ${STALE}`))

  const snapRedeemed = snapshots.reduce((s, r) => s + Number(r.points_redeemed ?? 0), 0)
  const realRedeemed = Math.abs(ledger.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0))
  check('charted points redeemed equals the ledger',
    snapRedeemed === realRedeemed, `${snapRedeemed} vs ${realRedeemed}` +
    (snapRedeemed === realRedeemed ? '' : ` — ${STALE}`))

  // ── Campaign attribution is checkable by hand ────────────────────────────
  console.log('\nCampaign attribution')
  const sendsByCampaign = new Map<string, typeof sends>()
  for (const s of sends) {
    const arr = sendsByCampaign.get(s.campaign_id) ?? []
    arr.push(s); sendsByCampaign.set(s.campaign_id, arr)
  }
  const campMismatch = campaigns.filter(c => {
    const rows = sendsByCampaign.get(c.id) ?? []
    const rev = rows.reduce((s, r) => s + Number(r.conversion_amount ?? 0), 0)
    return Math.abs(rev - Number(c.revenue_attributed)) > 0.02
      || rows.filter(r => r.status === 'converted').length !== c.converted_count
  })
  check('campaign totals equal the sum of their sends', campMismatch.length === 0,
    campMismatch.length ? `${campMismatch.length} campaigns off` : `${campaigns.length} campaigns`)

  const attributedVisits = sends.filter(s => s.status === 'converted').length
  check('attributed conversions correspond to real follow-up visits',
    attributedVisits > 0 && attributedVisits < visits.length,
    `${attributedVisits} conversions, never more than the ${visits.length} visits that exist`)

  // ── Automation history matches what triggered it ─────────────────────────
  console.log('\nAutomation history')
  const execByWorkflow = new Map<string, number>()
  for (const e of execs) execByWorkflow.set(e.workflow_id, (execByWorkflow.get(e.workflow_id) ?? 0) + 1)
  const wfMismatch = workflows.filter(w => (execByWorkflow.get(w.id) ?? 0) !== w.execution_count)
  check('workflow execution_count matches its execution rows', wfMismatch.length === 0,
    wfMismatch.length ? `${wfMismatch.length} off` : `${workflows.length} workflows`)

  const negExecs = execs.filter(e => e.event_name === 'review.negative').length
  const negRatings = requests.filter(r => r.rating !== null && r.rating <= 3 && r.completed_at
    && new Date(r.completed_at) >= addDays(TODAY, -150)).length
  check('a recovery run exists for every poor rating since automation went live',
    negExecs === negRatings, `${negExecs} runs vs ${negRatings} ratings ≤3`)

  const inactiveWf = workflows.filter(w => w.status !== 'active')
  check('inactive workflows have no execution history',
    inactiveWf.every(w => (execByWorkflow.get(w.id) ?? 0) === 0),
    `${inactiveWf.length} draft/disabled`)

  // ── The three findings are actually discoverable ─────────────────────────
  console.log('\nThe three findings Growth Intelligence should surface')
  const answered = requests.filter(r => r.rating !== null)
  const poor = answered.filter(r => (r.rating as number) <= 3)
  const poorOnPeak = poor.filter(r => {
    const vis = visitById.get(r.visit_id); if (!vis) return false
    const d = new Date(vis.visited_at); const h = d.getUTCHours()
    return (d.getUTCDay() === 5 || d.getUTCDay() === 6) && h >= 19 && h <= 21
  }).length
  const peakShare = poor.length ? poorOnPeak / poor.length : 0
  const allOnPeak = visits.filter(x => {
    const d = new Date(x.visited_at); const h = d.getUTCHours()
    return (d.getUTCDay() === 5 || d.getUTCDay() === 6) && h >= 19 && h <= 21
  }).length / visits.length
  check('1 — poor ratings concentrate on Fri/Sat peak service',
    peakShare > allOnPeak * 1.6,
    `${Math.round(peakShare * 100)}% of poor ratings vs ${Math.round(allOnPeak * 100)}% of all visits`)

  const redemptions = ledger.filter(t => t.points < 0).length
  const totalEarned = ledger.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
  const totalRedeemed = Math.abs(ledger.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0))
  check('2 — points accumulate but are rarely redeemed',
    totalRedeemed / totalEarned < 0.12,
    `${redemptions} redemptions, ${(totalRedeemed / totalEarned * 100).toFixed(1)}% of points earned`)

  const crisisEnd = new Date('2026-04-02T00:00:00Z')
  const lapsed = guests.filter(g => {
    const gv = visits.filter(x => x.guest_id === g.id)
    if (gv.length < 4) return false
    const last = gv.reduce((a, b) => new Date(a.visited_at) > new Date(b.visited_at) ? a : b)
    return new Date(last.visited_at) < crisisEnd
  })
  check('3 — a cohort of established regulars stopped after March',
    lapsed.length >= 8, `${lapsed.length} guests with 4+ visits and nothing since`)

  const crisisRatings = answered.filter(r => {
    const vis = visitById.get(r.visit_id); return vis && inServiceCrisis(new Date(vis.visited_at))
  })
  const crisisAvg = crisisRatings.length
    ? crisisRatings.reduce((s, r) => s + (r.rating as number), 0) / crisisRatings.length : 0
  const normalRatings = answered.filter(r => {
    const vis = visitById.get(r.visit_id); return vis && !inServiceCrisis(new Date(vis.visited_at))
  })
  const normalAvg = normalRatings.reduce((s, r) => s + (r.rating as number), 0) / normalRatings.length
  check('   the March dip is visible in ratings, not just in churn',
    crisisRatings.length > 0 && crisisAvg < normalAvg,
    `${crisisAvg.toFixed(2)} during the crisis vs ${normalAvg.toFixed(2)} otherwise`)

  // ── Plausibility ─────────────────────────────────────────────────────────
  console.log('\nPlausibility')
  const hist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of answered) hist[r.rating as number]++
  const monotone = hist[5] >= hist[4] && hist[4] >= hist[3] && hist[3] >= hist[2] && hist[2] >= hist[1]
  check('rating distribution decreases monotonically', monotone,
    `5★:${hist[5]} 4★:${hist[4]} 3★:${hist[3]} 2★:${hist[2]} 1★:${hist[1]}`)

  const avgRating = answered.reduce((s, r) => s + (r.rating as number), 0) / answered.length
  check('average rating is in the range a good bistro earns',
    avgRating > 4.0 && avgRating < 4.6, avgRating.toFixed(2))

  const responseRate = answered.length / requests.length
  check('review response rate is realistic',
    responseRate > 0.12 && responseRate < 0.40, `${Math.round(responseRate * 100)}%`)

  const mondays = visits.filter(x => new Date(x.visited_at).getUTCDay() === 1).length
  check('no visits on a Monday — the bistro is closed', mondays === 0)

  const future = visits.filter(x => new Date(x.visited_at) > TODAY).length
  check('no visit is dated in the future', future === 0)

  const spends = visits.map(x => Number(x.spend_amount)).sort((a, b) => a - b)
  const median = spends[Math.floor(spends.length / 2)]
  const mean = spends.reduce((a, b) => a + b, 0) / spends.length
  check('spend is right-skewed, as real bills are', mean > median,
    `median ${median.toFixed(0)} $, mean ${mean.toFixed(0)} $`)

  const acquiredToday = guests.filter(g => dayKey(new Date(g.created_at)) === dayKey(TODAY)).length
  check('guests were acquired over time, not all today', acquiredToday < guests.length * 0.1,
    `${acquiredToday} of ${guests.length} created today`)
  const firstVisitBefore = guests.filter(g => {
    const gv = visits.filter(x => x.guest_id === g.id)
    if (!gv.length) return false
    const first = gv.reduce((a, b) => new Date(a.visited_at) < new Date(b.visited_at) ? a : b)
    return new Date(g.created_at) > new Date(new Date(first.visited_at).getTime() + 60000)
  })
  check('no guest record postdates their own first visit', firstVisitBefore.length === 0,
    firstVisitBefore.length ? `${firstVisitBefore.length} guests` : '')

  // Acquisition that decays month after month to nothing is the clearest tell
  // that a dataset was generated rather than accumulated.
  const recentlyAcquired = guests.filter(g => new Date(g.created_at) >= addDays(TODAY, -90)).length
  check('guest acquisition has not decayed to nothing',
    recentlyAcquired >= guests.length * 0.08,
    `${recentlyAcquired} acquired in the last 90 days of ${guests.length}`)

  const uniqueNames = new Set(guests.map(g => g.name)).size
  check('no duplicated guest identities', uniqueNames === guests.length,
    `${uniqueNames} distinct names`)

  // ── Reservations ─────────────────────────────────────────────────────────
  console.log('\nReservations')
  const visitDays = new Set(visits.map(x => `${x.guest_id}|${dayKey(new Date(x.visited_at))}`))

  // The point of a no-show is that nobody arrived. If the same guest has a
  // visit that evening the two datasets contradict each other, and any
  // no-show rate computed from them is fiction.
  const noShows = reservations.filter(r => r.status === 'no_show')
  const ghostVisits = noShows.filter(r => visitDays.has(`${r.guest_id}|${r.requested_date}`))
  check('no guest both no-showed and dined the same evening', ghostVisits.length === 0,
    ghostVisits.length ? `${ghostVisits.length} contradictions` : `${noShows.length} no-shows`)

  const completed = reservations.filter(r => r.status === 'completed')
  const withoutVisit = completed.filter(r => !visitDays.has(`${r.guest_id}|${r.requested_date}`))
  check('every completed booking has the visit it produced', withoutVisit.length === 0,
    withoutVisit.length ? `${withoutVisit.length} without a visit` : `${completed.length} bookings`)

  const settled = reservations.filter(r =>
    ['completed', 'seated', 'no_show'].includes(r.status))
  const rate = settled.length ? noShows.length / settled.length : 0
  check('the no-show rate is in a believable range', rate > 0.01 && rate < 0.12,
    `${(rate * 100).toFixed(1)}% of ${settled.length} settled bookings`)

  check('answered requests record when they were handled',
    reservations.filter(r => r.status !== 'pending').every(r => r.handled_at !== null),
    `${reservations.filter(r => r.status === 'pending').length} still awaiting a reply`)

  // ── Outbound safety ──────────────────────────────────────────────────────
  // The demo's guests are invented. If the platform ever messages them it is
  // spending real quota on fiction, and on a verified sender it would reach
  // whoever actually owns those numbers and addresses.
  console.log('\nOutbound safety')
  check('the venue is flagged as a demo',
    isDemoSettings(v.settings), 'settings.is_demo')

  const { count: waCount } = await db.from('whatsapp_messages')
    .select('*', { count: 'exact', head: true }).eq('venue_id', venueId)
  check('no WhatsApp message was ever sent for this venue', (waCount ?? 0) === 0,
    `${waCount ?? 0} rows`)

  // Every status the product writes must be one the database accepts. Two
  // separate bugs shipped because it wasn't: 'sent'/'failed' from the review
  // dispatcher, and 'clicked' from the WhatsApp webhook — all silently dropped.
  const WRITTEN_STATUSES = ['pending', 'sent', 'failed', 'clicked', 'positive', 'negative']
  const rejected: string[] = []
  for (const status of WRITTEN_STATUSES) {
    const { error } = await db.from('review_requests').insert({
      venue_id: venueId, guest_name: '__audit__', guest_phone: '+10000000000',
      channel: 'whatsapp', status, created_at: iso(TODAY),
    } as never).select('id').single()
    if (error) rejected.push(status)
  }
  await db.from('review_requests').delete().eq('venue_id', venueId).eq('guest_name', '__audit__')
  check('the database accepts every review status the product writes',
    rejected.length === 0,
    rejected.length ? `rejected: ${rejected.join(', ')} — run supabase/review_request_status.sql` : WRITTEN_STATUSES.join(', '))

  // ── Dashboard coverage ───────────────────────────────────────────────────
  console.log('\nDashboard coverage — every page has something real to show')
  const upcoming = reservations.filter(r => new Date(r.requested_date) >= addDays(TODAY, -1)).length
  const pages: [string, number][] = [
    ['Overview (KPI snapshots)', snapshots.length],
    ['Guests', guests.length],
    ['Loyalty members', members.length],
    ['Loyalty rewards', rewards.length],
    ['Loyalty ledger', ledger.length],
    ['Visits', visits.length],
    ['Review requests', requests.length],
    ['Public reviews', reviews.length],
    ['Reservations (upcoming)', upcoming],
    ['Campaigns', campaigns.length],
    ['Campaign sends', sends.length],
    ['Automations', workflows.length],
    ['Automation history', execs.length],
    ['AI conversations', convos.length],
    ['Action items', actions.length],
    ['Notifications', notifs.length],
    ['Analytics funnel', events.length],
  ]
  for (const [name, count] of pages) check(name, count > 0, `${count} rows`)

  // ── Result ───────────────────────────────────────────────────────────────
  console.log(`\n${failures.length === 0 ? '✅' : '❌'} ${passed} checks passed, ${failures.length} failed`)
  if (failures.length) { failures.forEach(f => console.log(`   ✗ ${f}`)); process.exit(1) }
}

main().then(() => process.exit(0)).catch(e => { console.error('FAILED:', e); process.exit(1) })
