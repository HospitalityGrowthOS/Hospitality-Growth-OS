export const dynamic = 'force-dynamic'

/**
 * Reservations.
 *
 * This screen did not exist. The AI assistant captured booking requests into
 * `reservation_requests` and the only trace of them in the product was a
 * "pending reservations" number on the AI page — no list, no detail, no way to
 * confirm or decline. A guest could ask for a table over WhatsApp and have the
 * request sit unread indefinitely.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import ReservationRow, { type ReservationView, type ReservationStatus } from './ReservationRow'

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-3xl mb-3">📅</div>
      <h3 className="font-display font-semibold text-ink mb-1">{title}</h3>
      <p className="text-[13px] text-mid max-w-xs">{hint}</p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`font-display text-[22px] font-semibold tabular-nums ${tone ?? 'text-ink'}`}>{value}</div>
      <div className="text-[11px] text-mid uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  )
}

export default async function ReservationsPage() {
  const venue = await getCurrentVenue()
  if (!venue) return null

  const supabase = await createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('reservation_requests')
    .select('id, guest_name, guest_phone, requested_date, requested_time, party_size, notes, channel, status, created_at')
    .eq('venue_id', venue.id)
    .order('requested_date', { ascending: false })
    .order('requested_time', { ascending: true })
    .limit(400)

  const all = (data ?? []) as ReservationView[]

  const needsAction = all.filter(r => r.status === 'pending')
  const upcoming = all
    .filter(r => r.requested_date >= today && r.status !== 'pending')
    .sort((a, b) => a.requested_date.localeCompare(b.requested_date)
      || (a.requested_time ?? '').localeCompare(b.requested_time ?? ''))
  const past = all.filter(r => r.requested_date < today && r.status !== 'pending')

  // A no-show rate is only meaningful against bookings that were actually
  // committed to and have already happened — counting future confirmations in
  // the denominator would make the figure drift down on its own.
  const settled = past.filter(r =>
    (['seated', 'completed', 'no_show', 'confirmed'] as ReservationStatus[]).includes(r.status))
  const noShows = settled.filter(r => r.status === 'no_show').length
  const noShowRate = settled.length ? Math.round((noShows / settled.length) * 100) : null

  const covers = upcoming.reduce((s, r) => s + (r.party_size ?? 0), 0)

  return (
    <>
      <Topbar title="Reservations" subtitle="Requests, bookings and no-shows" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        <Card>
          <CardBody className="flex items-center gap-10">
            <Stat label="Awaiting reply" value={String(needsAction.length)}
              tone={needsAction.length ? 'text-ember' : undefined} />
            <Stat label="Upcoming" value={String(upcoming.length)} />
            <Stat label="Covers booked" value={String(covers)} />
            <Stat label="No-show rate"
              value={noShowRate === null ? '—' : `${noShowRate}%`}
              tone={noShowRate !== null && noShowRate > 10 ? 'text-ember' : undefined} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">
              Awaiting your reply
              {needsAction.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-ember">
                  {needsAction.length} {needsAction.length === 1 ? 'request' : 'requests'}
                </span>
              )}
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {needsAction.length === 0
              ? <Empty title="Nothing waiting" hint="Requests captured by the assistant appear here until you confirm or decline them." />
              : needsAction.map(r => <ReservationRow key={r.id} r={r} />)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Upcoming</h2>
          </CardHeader>
          <CardBody className="p-0">
            {upcoming.length === 0
              ? <Empty title="No bookings ahead" hint="Confirmed bookings for today and later will show here." />
              : upcoming.map(r => <ReservationRow key={r.id} r={r} />)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Past services</h2>
          </CardHeader>
          <CardBody className="p-0">
            {past.length === 0
              ? <Empty title="No history yet" hint="Bookings move here once their service date has passed." />
              : past.slice(0, 60).map(r => <ReservationRow key={r.id} r={r} />)}
          </CardBody>
        </Card>

      </div>
    </>
  )
}
