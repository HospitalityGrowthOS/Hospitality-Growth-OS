export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'
import { formatMoneyShort } from '@/lib/money'

const tierVariant: Record<string, 'gold' | 'silver' | 'bronze' | 'default'> = {
  gold: 'gold', silver: 'silver', bronze: 'bronze', none: 'default',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function GuestProfilePage({ params }: { params: { guestId: string } }) {
  const venue = await getCurrentVenue()
  if (!venue) notFound()

  const supabase = await createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select('*')
    .eq('id', params.guestId)
    .eq('venue_id', venue.id)   // scope to the owner's venue — never leak across tenants
    .single()

  if (!guest) notFound()

  const [{ data: visits }, { data: reviews }, { data: messages }, { data: member }] =
    await Promise.all([
      supabase
        .from('visits')
        .select('id, visited_at, party_size, spend_amount, source, table_number')
        .eq('guest_id', guest.id)
        .order('visited_at', { ascending: false })
        .limit(20),
      supabase
        .from('review_requests')
        .select('id, status, rating, feedback, created_at, completed_at')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('whatsapp_messages')
        .select('id, message_type, status, body, created_at')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('loyalty_members')
        .select('id, qr_code, tier, points_balance, points_earned_total, enrolled_at')
        .eq('guest_id', guest.id)
        .maybeSingle(),
    ])

  const visitList   = visits ?? []
  const reviewList  = reviews ?? []
  const messageList = messages ?? []

  const rated = reviewList.filter(r => r.rating != null)
  const avgRating = rated.length
    ? (rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length).toFixed(1)
    : '—'

  const initials = (guest.name || '?')
    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <Topbar title={guest.name || 'Guest'} subtitle="Guest profile" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <Link href="/dashboard/guests" className="inline-block text-[13px] text-teal hover:underline">
          ← All guests
        </Link>

        {/* Identity */}
        <Card>
          <CardBody className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center text-white text-lg font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-lg font-semibold text-ink">{guest.name || 'Unknown guest'}</h2>
                <Badge variant={tierVariant[guest.loyalty_tier] || 'default'} className="capitalize">
                  {guest.loyalty_tier === 'none' ? 'No tier' : guest.loyalty_tier}
                </Badge>
                {guest.whatsapp_opted_in
                  ? <Badge variant="success">WhatsApp opted in</Badge>
                  : <Badge variant="default">No WhatsApp consent</Badge>}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[13px] text-mid flex-wrap">
                <span>{guest.phone || 'No phone'}</span>
                <span>{guest.email || 'No email'}</span>
                <span>Guest since {fmtDate(guest.created_at)}</span>
              </div>
              {guest.notes && (
                <p className="text-[13px] text-charcoal mt-3 p-2.5 bg-paper rounded-lg border border-border">
                  {guest.notes}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Numbers */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total visits" value={guest.total_visits ?? 0} />
          <KpiCard label="Lifetime spend" value={formatMoneyShort(guest.total_spent ?? 0, venue.settings)} accent="teal" />
          <KpiCard label="Loyalty points" value={member?.points_balance ?? guest.loyalty_points ?? 0} accent="gold" />
          <KpiCard label="Avg rating given" value={avgRating === '—' ? '—' : `${avgRating} ★`} accent="ember" />
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Visits */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-[15px] font-semibold text-ink">Visit history</h3>
              <p className="text-xs text-mid mt-0.5">Last visit {fmtDate(guest.last_visit_at)}</p>
            </CardHeader>
            <CardBody className={visitList.length ? 'space-y-2' : ''}>
              {visitList.length === 0 ? (
                <p className="text-[13px] text-mid py-6 text-center">No visits recorded yet.</p>
              ) : (
                visitList.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <div>
                      <p className="text-[13px] text-ink">{fmtDate(v.visited_at)}</p>
                      <p className="text-xs text-mid mt-0.5">
                        {v.party_size ?? 1} {v.party_size === 1 ? 'guest' : 'guests'}
                        {v.table_number ? ` · Table ${v.table_number}` : ''}
                        {v.source ? ` · ${v.source}` : ''}
                      </p>
                    </div>
                    <span className="font-data text-[13px] font-semibold text-ink">
                      {formatMoneyShort(v.spend_amount ?? 0, venue.settings)}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Feedback */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-[15px] font-semibold text-ink">Feedback</h3>
              <p className="text-xs text-mid mt-0.5">{reviewList.length} review requests</p>
            </CardHeader>
            <CardBody className={reviewList.length ? 'space-y-2.5' : ''}>
              {reviewList.length === 0 ? (
                <p className="text-[13px] text-mid py-6 text-center">No review requests sent yet.</p>
              ) : (
                reviewList.map(r => (
                  <div key={r.id} className="py-2 border-b border-border/60 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-ink">
                        {r.rating ? `${r.rating} ★` : 'Awaiting response'}
                      </span>
                      <Badge
                        variant={
                          r.status === 'positive' ? 'success'
                          : r.status === 'negative' ? 'danger'
                          : r.status === 'sent' ? 'teal'
                          : 'default'
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    {r.feedback && (
                      <p className="text-xs text-mid mt-1.5 leading-relaxed">&ldquo;{r.feedback}&rdquo;</p>
                    )}
                    <p className="text-[11px] text-mid/70 mt-1">{fmtDate(r.completed_at ?? r.created_at)}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Messages */}
        <Card>
          <CardHeader>
            <h3 className="font-display text-[15px] font-semibold text-ink">WhatsApp history</h3>
            <p className="text-xs text-mid mt-0.5">Messages sent to this guest</p>
          </CardHeader>
          <CardBody className={messageList.length ? 'space-y-2' : ''}>
            {messageList.length === 0 ? (
              <p className="text-[13px] text-mid py-6 text-center">No messages sent to this guest yet.</p>
            ) : (
              messageList.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink capitalize">{m.message_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-mid mt-0.5 line-clamp-2">{m.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={m.status === 'failed' ? 'danger' : m.status === 'read' ? 'success' : 'default'}>
                      {m.status}
                    </Badge>
                    <span className="text-[11px] text-mid">{fmtDateTime(m.created_at)}</span>
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
