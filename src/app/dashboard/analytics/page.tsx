export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'

type Recommendation = {
  id: string
  title: string
  description: string | null
  priority: string | null
  status: string
  generated_at: string | null
  created_at: string
}

function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0
}

export default async function GrowthIntelligencePage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Growth Intelligence" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: recRows },
    { count: guestTotal },
    { count: guestNew30 },
    { count: memberTotal },
    { data: requestRows },
    { data: visitRows },
  ] = await Promise.all([
    supabase
      .from('ai_recommendations')
      .select('id, title, description, priority, status, generated_at, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).gte('created_at', since30),
    supabase.from('loyalty_members').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('review_requests').select('status, rating').eq('venue_id', venueId),
    supabase.from('visits').select('guest_id, spend_amount').eq('venue_id', venueId).gte('visited_at', since30),
  ])

  const recommendations = (recRows ?? []) as Recommendation[]
  const requests = (requestRows ?? []) as { status: string; rating: number | null }[]
  const visits   = (visitRows ?? []) as { guest_id: string | null; spend_amount: number | null }[]

  const sent      = requests.filter(r => ['sent', 'positive', 'negative'].includes(r.status)).length
  const responded = requests.filter(r => r.rating != null).length
  const positive  = requests.filter(r => (r.rating ?? 0) >= 4).length
  const responseRate = pct(responded, sent)
  const avgRating = responded
    ? (requests.reduce((s, r) => s + (r.rating ?? 0), 0) / responded).toFixed(1)
    : '—'

  // A guest with more than one visit in the window is a repeat guest.
  const visitsByGuest = new Map<string, number>()
  for (const v of visits) {
    if (!v.guest_id) continue
    visitsByGuest.set(v.guest_id, (visitsByGuest.get(v.guest_id) ?? 0) + 1)
  }
  const repeatGuests = Array.from(visitsByGuest.values()).filter(n => n > 1).length
  const repeatRate = pct(repeatGuests, visitsByGuest.size)

  const revenue30 = visits.reduce((s, v) => s + (v.spend_amount ?? 0), 0)
  const avgSpend = visits.length ? (revenue30 / visits.length).toFixed(0) : '0'

  const hasSignal = (guestTotal ?? 0) > 0 || visits.length > 0

  return (
    <>
      <Topbar title="Growth Intelligence" subtitle="What your guest data is telling you" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total guests" value={guestTotal ?? 0} />
          <KpiCard label="New (30 days)" value={guestNew30 ?? 0} accent="teal" />
          <KpiCard label="Loyalty members" value={memberTotal ?? 0} accent="gold" />
          <KpiCard label="Repeat rate" value={`${repeatRate}%`} accent="ember" />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Review performance</h2>
              <p className="text-xs text-mid mt-0.5">Across all requests sent</p>
            </CardHeader>
            <CardBody className="space-y-3">
              <Stat label="Requests sent" value={String(sent)} />
              <Stat label="Guests who responded" value={`${responded} (${responseRate}%)`} />
              <Stat label="Rated 4–5 stars" value={String(positive)} />
              <Stat label="Average rating" value={avgRating === '—' ? '—' : `${avgRating} ★`} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Last 30 days</h2>
              <p className="text-xs text-mid mt-0.5">Recorded visits and spend</p>
            </CardHeader>
            <CardBody className="space-y-3">
              <Stat label="Visits recorded" value={String(visits.length)} />
              <Stat label="Unique guests" value={String(visitsByGuest.size)} />
              <Stat label="Revenue recorded" value={`€${revenue30.toFixed(0)}`} />
              <Stat label="Average spend" value={`€${avgSpend}`} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Recommended actions</h2>
            <p className="text-xs text-mid mt-0.5">
              Generated weekly from your guest data.
            </p>
          </CardHeader>
          <CardBody className={recommendations.length ? 'space-y-2.5' : 'p-0'}>
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="font-display font-semibold text-ink mb-1">
                  {hasSignal ? 'No recommendations yet' : 'Not enough data yet'}
                </h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  {hasSignal
                    ? 'Recommendations appear once there is enough visit and review history to spot a pattern.'
                    : 'Start recording visits and enrolling guests — recommendations need real activity to work from.'}
                </p>
              </div>
            ) : (
              recommendations.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-paper border border-border">
                  <Badge variant={r.priority === 'high' ? 'ember' : r.priority === 'low' ? 'default' : 'gold'}>
                    {r.priority ?? 'medium'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{r.title}</p>
                    {r.description && <p className="text-xs text-mid mt-1 leading-relaxed">{r.description}</p>}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-mid">{label}</span>
      <span className="font-data text-[13px] font-semibold text-ink">{value}</span>
    </div>
  )
}
