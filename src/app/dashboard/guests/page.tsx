export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'
import type { Guest } from '@/types/database'

const tierVariant: Record<string, 'gold' | 'silver' | 'bronze' | 'default'> = {
  gold: 'gold', silver: 'silver', bronze: 'bronze', none: 'default',
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">👥</div>
      <h3 className="font-display font-semibold text-ink mb-1">No guests yet</h3>
      <p className="text-[13px] text-mid max-w-xs mb-4">Guests appear here when they enrol via your QR code or visit your venue.</p>
      <Link href="/dashboard/onboarding"><Button size="sm">Get your QR code</Button></Link>
    </div>
  )
}

export default async function GuestsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Guest CRM" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center"><EmptyState /></div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id

  const [
    { data: guests, error },
    { count: totalGuests },
    { count: activeGuests },
    { count: atRiskGuests },
  ] = await Promise.all([
    supabase.from('guests').select('*').eq('venue_id', venueId).order('created_at', { ascending: false }).limit(50),
    supabase.from('guests').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('guests').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).gte('last_visit_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('guests').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).lt('last_visit_at', new Date(Date.now() - 60 * 86400000).toISOString()),
  ])

  const avgLifetimeValue = guests?.length
    ? Math.round(guests.reduce((a, g) => a + (g.total_spent || 0), 0) / guests.length)
    : 0

  return (
    <>
      <Topbar
        title="Guest CRM"
        subtitle="Full guest profiles, history, and communication"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary">Export</Button>
            <Button size="sm">Add Guest</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Guests',      value: String(totalGuests ?? 0),             sub: 'In CRM database',        color: 'border-t-ember' },
            { label: 'Active (30d)',       value: String(activeGuests ?? 0),            sub: `${totalGuests ? Math.round(((activeGuests ?? 0) / totalGuests) * 100) : 0}% of database`, color: 'border-t-teal' },
            { label: 'Avg Lifetime Value', value: `€${avgLifetimeValue.toLocaleString()}`, sub: 'Per returning guest',  color: 'border-t-gold' },
            { label: 'At Risk (60d+)',    value: String(atRiskGuests ?? 0),            sub: 'Win-back recommended',   color: 'border-t-[#C0392B]' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className={`bg-white border border-[#E8E0D4] border-t-2 ${color} rounded-xl p-5`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mid mb-2">{label}</div>
              <div className="font-data text-3xl font-bold text-ink leading-none">{value}</div>
              <div className="text-[11px] text-mid mt-2">{sub}</div>
            </div>
          ))}
        </div>

        {error ? (
          <div className="bg-[#C0392B]/5 border border-[#C0392B]/20 rounded-xl p-5 text-[13px] text-[#C0392B]">
            Failed to load guests. Please refresh the page.
          </div>
        ) : !guests?.length ? (
          <Card><EmptyState /></Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="font-display font-semibold text-ink text-base">All Guests</div>
              <span className="text-[12px] text-mid">Showing {guests.length} of {totalGuests ?? 0}</span>
            </CardHeader>
            {/* Table header */}
            <div className="grid grid-cols-[1.5fr_1fr_80px_80px_100px_80px_auto] gap-3 px-5 py-2.5 border-b border-[#E8E0D4] bg-paper/60">
              {['Guest', 'Contact', 'Tier', 'Visits', 'Last Visit', 'Spend', ''].map(h => (
                <div key={h} className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mid">{h}</div>
              ))}
            </div>
            {(guests as Guest[]).map((g, i) => (
              <div key={g.id} className={`grid grid-cols-[1.5fr_1fr_80px_80px_100px_80px_auto] gap-3 items-center px-5 py-3.5 hover:bg-cream transition-colors ${i < guests.length - 1 ? 'border-b border-[#E8E0D4]' : ''}`}>
                {/* Name */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {(g.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-medium text-ink">{g.name || 'Unknown'}</span>
                </div>

                {/* Contact */}
                <div>
                  <div className="text-[12px] text-charcoal">{g.phone || '—'}</div>
                  <div className="text-[11px] text-mid">{g.email || '—'}</div>
                </div>

                <Badge variant={tierVariant[g.loyalty_tier] || 'default'} className="capitalize">{g.loyalty_tier === 'none' ? 'No tier' : g.loyalty_tier}</Badge>

                <div className="font-data text-[13px] text-charcoal">{g.total_visits}×</div>

                <div className="text-[12px] text-mid">
                  {g.last_visit_at ? new Date(g.last_visit_at).toLocaleDateString() : 'Never'}
                </div>

                <div className="font-data text-[13px] font-semibold text-ink">€{(g.total_spent || 0).toFixed(0)}</div>

                <Button size="sm" variant="ghost" className="text-[11px] px-2">View</Button>
              </div>
            ))}
            {(totalGuests ?? 0) > 50 && (
              <div className="px-5 py-3 border-t border-[#E8E0D4] bg-paper/40 flex items-center justify-between">
                <span className="text-[12px] text-mid">Showing 50 of {totalGuests} guests</span>
                <Button size="sm" variant="ghost">Load more</Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
