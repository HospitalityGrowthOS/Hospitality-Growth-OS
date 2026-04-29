export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'
import IssuePointsModal from './IssuePointsModal'
import type { LoyaltyMember } from '@/types/database'

type MemberWithGuest = LoyaltyMember & {
  guests: { name: string | null; phone: string | null; total_visits: number; total_spent: number } | null
}

const tierVariant: Record<string, 'gold' | 'silver' | 'bronze' | 'default'> = {
  gold: 'gold', silver: 'silver', bronze: 'bronze', none: 'default',
}

function EmptyState({ venueId }: { venueId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">🎁</div>
      <h3 className="font-display font-semibold text-ink mb-1">No loyalty members yet</h3>
      <p className="text-[13px] text-mid max-w-xs mb-5">
        Share your QR code with guests to start building your loyalty programme.
      </p>
      <Link
        href="/dashboard/loyalty/qr-code"
        className="px-5 py-2.5 bg-ember text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Get Signup QR Code →
      </Link>
    </div>
  )
}

export default async function LoyaltyPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Loyalty Members" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState venueId="" />
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id

  const [
    { data: members, error },
    { count: goldCount },
    { count: silverCount },
    { count: bronzeCount },
    { count: totalCount },
    { data: recentTx },
  ] = await Promise.all([
    supabase
      .from('loyalty_members')
      .select('*, guests(name, phone, total_visits, total_spent)')
      .eq('venue_id', venueId)
      .order('points_balance', { ascending: false })
      .limit(50),
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('tier', 'gold'),
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('tier', 'silver'),
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('tier', 'bronze'),
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase
      .from('loyalty_transactions')
      .select('id, type, points, description, created_at, member_id')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const memberList = (members ?? []) as MemberWithGuest[]

  const totalPointsIssued = memberList.reduce((a, m) => a + (m.points_earned_total || 0), 0)
  const avgPoints = (totalCount ?? 0) > 0 ? Math.round(totalPointsIssued / (totalCount ?? 1)) : 0
  const settings = venue.settings as Record<string, unknown>
  const pointsPerEuro = (settings?.points_per_euro as number) || 10

  // Shape data for IssuePointsModal (client component needs plain data)
  const modalMembers = memberList.map(m => ({
    id:             m.id,
    qr_code:        m.qr_code,
    tier:           m.tier,
    points_balance: m.points_balance,
    guest_name:     m.guests?.name ?? null,
  }))

  return (
    <>
      <Topbar
        title="Loyalty Members"
        subtitle={`${totalCount ?? 0} enrolled · Bronze / Silver / Gold`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/loyalty/qr-code"
              className="px-4 py-2 border border-[#E8E0D4] rounded-lg text-sm font-medium text-ink hover:bg-paper transition-colors"
            >
              📱 QR Code
            </Link>
            {memberList.length > 0 && (
              <IssuePointsModal venueId={venueId} members={modalMembers} />
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Members',   value: String(totalCount ?? 0),   sub: 'All tiers',          color: 'border-t-ember' },
            { label: 'Gold Members',    value: String(goldCount ?? 0),    sub: `${totalCount ? Math.round(((goldCount ?? 0) / totalCount) * 100) : 0}% of total`, color: 'border-t-gold' },
            { label: 'Avg Points Held', value: avgPoints.toLocaleString(), sub: 'Per active member',  color: 'border-t-teal' },
            { label: 'Points per €',    value: `${pointsPerEuro}pt`,      sub: 'Earn rate',           color: 'border-t-[#2A9D5C]' },
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
            Failed to load loyalty members. Please refresh.
          </div>
        ) : !memberList.length ? (
          <Card><EmptyState venueId={venueId} /></Card>
        ) : (
          <div className="grid grid-cols-[1fr_280px] gap-4">

            {/* Members table */}
            <Card>
              <CardHeader>
                <div className="font-display font-semibold text-ink text-base">All Members</div>
                <span className="text-[11px] text-mid">{memberList.length} shown</span>
              </CardHeader>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_90px_70px_100px_auto] gap-3 px-5 py-2 border-b border-[#E8E0D4] bg-paper/60">
                {['Member', 'Tier', 'Points', 'Visits', 'Last Active', ''].map(h => (
                  <div key={h} className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mid">{h}</div>
                ))}
              </div>

              {memberList.map((m, i) => (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_80px_90px_70px_100px_auto] gap-3 items-center px-5 py-3 hover:bg-cream transition-colors ${i < memberList.length - 1 ? 'border-b border-[#E8E0D4]' : ''}`}
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink">{m.guests?.name || 'Unknown'}</div>
                    <div className="text-[11px] text-mid font-data">{m.qr_code}</div>
                  </div>
                  <Badge variant={tierVariant[m.tier] || 'default'} className="capitalize">{m.tier}</Badge>
                  <div className="font-data text-[13px] font-semibold text-ink">{m.points_balance.toLocaleString()}</div>
                  <div className="font-data text-[13px] text-charcoal">{m.guests?.total_visits ?? 0}</div>
                  <div className="text-[12px] text-mid">
                    {m.last_activity_at
                      ? new Date(m.last_activity_at).toLocaleDateString()
                      : new Date(m.enrolled_at).toLocaleDateString()}
                  </div>
                  <Link
                    href={`/loyalty/${m.id}`}
                    target="_blank"
                    className="text-[11px] text-ember hover:underline font-medium whitespace-nowrap"
                  >
                    View →
                  </Link>
                </div>
              ))}
            </Card>

            {/* Right panel */}
            <div className="flex flex-col gap-4">

              {/* Tier breakdown */}
              <Card>
                <CardHeader>
                  <div className="font-display font-semibold text-ink text-base">Tier Breakdown</div>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                  {[
                    { tier: 'Gold',   count: goldCount ?? 0,   color: 'bg-gold',       min: '1,500+ pts' },
                    { tier: 'Silver', count: silverCount ?? 0, color: 'bg-mid',        min: '500–1,499' },
                    { tier: 'Bronze', count: bronzeCount ?? 0, color: 'bg-[#B3773A]',  min: '0–499' },
                  ].map(({ tier, count, color, min }) => (
                    <div key={tier} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${color}`}/>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[12px] font-medium text-ink">{tier} <span className="text-mid font-normal">({min})</span></span>
                          <span className="font-data text-[12px] text-mid">{count}</span>
                        </div>
                        <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{ width: (totalCount ?? 0) > 0 ? `${(count / (totalCount ?? 1)) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Recent activity */}
              {recentTx && recentTx.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="font-display font-semibold text-ink text-base">Recent Activity</div>
                  </CardHeader>
                  <div className="flex flex-col">
                    {recentTx.map((tx, i) => {
                      const member = memberList.find(m => m.id === tx.member_id)
                      const isDeduct = tx.type === 'redeem' || tx.type === 'expire'
                      return (
                        <div key={tx.id} className={`px-5 py-2.5 flex items-center justify-between ${i < recentTx.length - 1 ? 'border-b border-[#E8E0D4]' : ''}`}>
                          <div>
                            <div className="text-[12px] text-ink">{member?.guests?.name ?? 'Member'}</div>
                            <div className="text-[10px] text-mid">{tx.description || tx.type}</div>
                          </div>
                          <div className={`font-data text-[12px] font-semibold ${isDeduct ? 'text-[#C0392B]' : 'text-[#2A9D5C]'}`}>
                            {isDeduct ? '−' : '+'}{tx.points} pts
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Tier rules */}
              <Card>
                <CardHeader>
                  <div className="font-display font-semibold text-ink text-base">Tier Rules</div>
                </CardHeader>
                <CardBody className="flex flex-col gap-2">
                  {[
                    { emoji: '🥇', tier: 'Gold',   min: '1,500+ pts', perks: 'Free dessert + 2× points' },
                    { emoji: '🥈', tier: 'Silver', min: '500–1,499',  perks: '10% discount + priority' },
                    { emoji: '🥉', tier: 'Bronze', min: '0–499 pts',  perks: 'Welcome bonus + QR access' },
                  ].map(({ emoji, tier, min, perks }) => (
                    <div key={tier} className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{emoji}</span>
                      <div>
                        <div className="text-[12px] font-medium text-ink">{tier} <span className="font-data font-normal text-mid">({min})</span></div>
                        <div className="text-[11px] text-mid">{perks}</div>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

            </div>
          </div>
        )}
      </div>
    </>
  )
}
