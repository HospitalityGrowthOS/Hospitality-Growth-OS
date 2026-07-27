export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'
import RecordVisitForm from './RecordVisitForm'

function fmtWhen(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function VisitsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Visits" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: visitRows }, { count: todayCount }, { count: queuedCount }] = await Promise.all([
    supabase
      .from('visits')
      .select('id, guest_id, visited_at, party_size, spend_amount, table_number')
      .eq('venue_id', venueId)
      .order('visited_at', { ascending: false })
      .limit(20),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .gte('visited_at', since24),
    supabase
      .from('review_requests')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .eq('status', 'pending'),
  ])

  const visits = visitRows ?? []

  // Resolve guest names in one batched lookup — there is no FK to join on.
  const guestIds = Array.from(new Set(visits.map(v => v.guest_id).filter(Boolean))) as string[]
  const { data: guestRows } = guestIds.length
    ? await supabase.from('guests').select('id, name, phone').in('id', guestIds)
    : { data: [] as { id: string; name?: string; phone?: string }[] }
  const guestsById = new Map((guestRows ?? []).map(g => [g.id, g]))

  const revenue24 = visits
    .filter(v => v.visited_at >= since24)
    .reduce((s, v) => s + (v.spend_amount ?? 0), 0)

  const settings = (venue.settings || {}) as Record<string, unknown>
  const delayMinutes = (settings.review_delay_minutes as number) ?? 45

  return (
    <>
      <Topbar title="Visits" subtitle="Record a visit to start the review flow" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Visits today" value={todayCount ?? 0} />
          <KpiCard label="Revenue today" value={`€${revenue24.toFixed(0)}`} accent="teal" />
          <KpiCard label="Review requests queued" value={queuedCount ?? 0} accent="gold" />
        </div>

        <RecordVisitForm delayMinutes={delayMinutes} />

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Recent visits</h2>
            <p className="text-xs text-mid mt-0.5">Last {visits.length} recorded</p>
          </CardHeader>
          <CardBody className="p-0">
            {visits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="text-4xl mb-3">🍽️</div>
                <h3 className="font-display font-semibold text-ink mb-1">No visits recorded yet</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  Record a visit above when a guest pays. That awards their loyalty points and
                  schedules the review request automatically.
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                    <th className="px-5 py-2.5 font-semibold">Guest</th>
                    <th className="px-5 py-2.5 font-semibold">Party</th>
                    <th className="px-5 py-2.5 font-semibold">Table</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Spend</th>
                    <th className="px-5 py-2.5 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(v => {
                    const guest = v.guest_id ? guestsById.get(v.guest_id) : undefined
                    return (
                      <tr key={v.id} className="border-b border-border/60 last:border-0">
                        <td className="px-5 py-3">
                          {v.guest_id ? (
                            <Link href={`/dashboard/guests/${v.guest_id}`} className="text-ink hover:text-teal">
                              {guest?.name || guest?.phone || 'Unknown guest'}
                            </Link>
                          ) : (
                            <span className="text-mid">Unknown guest</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-mid">{v.party_size ?? 1}</td>
                        <td className="px-5 py-3 text-mid">{v.table_number || '—'}</td>
                        <td className="px-5 py-3 text-right font-data font-semibold text-ink">
                          €{(v.spend_amount ?? 0).toFixed(0)}
                        </td>
                        <td className="px-5 py-3 text-mid">{fmtWhen(v.visited_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
