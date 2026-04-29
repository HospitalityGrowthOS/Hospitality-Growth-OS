export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/ui/KpiCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-paper flex items-center justify-center text-xl mb-3">📭</div>
      <p className="text-[13px] text-mid">{message}</p>
    </div>
  )
}

export default async function DashboardHome() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Command Centre" subtitle="Welcome to Hospitality Growth OS" />
        <div className="flex-1 flex items-center justify-center p-7">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-4">🏪</div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">No venue found</h2>
            <p className="text-[13px] text-mid mb-5">Your account isn't linked to a venue yet. Contact support to get set up.</p>
            <Link href="/dashboard/onboarding">
              <Button>Go to onboarding</Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const [
    { count: totalMembers },
    { count: newMembersWeek },
    { data: reviewStats },
    { count: totalReviews },
    { count: respondedReviews },
    { count: totalGuests },
    { data: pendingReviews },
    { data: aiRecs },
    { data: recentGuests },
  ] = await Promise.all([
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).gte('enrolled_at', sevenDaysAgo),
    supabase.from('reviews').select('rating').eq('venue_id', venueId).gte('review_date', thirtyDaysAgo),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'responded'),
    supabase.from('guests').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('reviews').select('id, author_name, rating, content, status, review_date, platform').eq('venue_id', venueId).eq('status', 'pending').order('review_date', { ascending: false }).limit(3),
    supabase.from('ai_recommendations').select('*').eq('venue_id', venueId).eq('status', 'pending').order('generated_at', { ascending: false }).limit(3),
    supabase.from('guests').select('id, name, phone, loyalty_tier, total_visits, last_visit_at').eq('venue_id', venueId).order('created_at', { ascending: false }).limit(5),
  ])

  const avgRating = reviewStats?.length
    ? +(reviewStats.reduce((a, r) => a + r.rating, 0) / reviewStats.length).toFixed(1)
    : null

  const responseRate = (totalReviews ?? 0) > 0
    ? Math.round(((respondedReviews ?? 0) / (totalReviews ?? 1)) * 100)
    : null

  const tierColors: Record<string, string> = {
    gold: 'bg-gold/10 text-gold',
    silver: 'bg-mid/10 text-mid',
    bronze: 'bg-[#B3773A]/10 text-[#B3773A]',
    none: 'bg-paper text-mid',
  }

  return (
    <>
      <Topbar
        title="Command Centre"
        subtitle={`${today} · ${venue.name}`}
        actions={
          <Button size="sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Guest
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Loyalty Members"
            value={totalMembers?.toLocaleString() ?? '0'}
            change={newMembersWeek ? `+${newMembersWeek} this week` : 'No new this week'}
            changeUp={(newMembersWeek ?? 0) > 0}
            accent="ember"
          />
          <KpiCard
            label="Avg Google Rating"
            value={avgRating ? `${avgRating}★` : '—'}
            change={avgRating ? 'Last 30 days' : 'No reviews yet'}
            changeUp={avgRating !== null && avgRating >= 4}
            accent="gold"
          />
          <KpiCard
            label="Response Rate"
            value={responseRate !== null ? `${responseRate}%` : '—'}
            change={`${respondedReviews ?? 0} of ${totalReviews ?? 0} reviews`}
            changeUp={(responseRate ?? 0) >= 60}
            accent="teal"
          />
          <KpiCard
            label="Total Guests"
            value={totalGuests?.toLocaleString() ?? '0'}
            change="In CRM database"
            changeUp={(totalGuests ?? 0) > 0}
            accent="success"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: '🎁', label: 'Issue Points',  href: '/dashboard/loyalty' },
            { icon: '📣', label: 'New Campaign',  href: '/dashboard/campaigns' },
            { icon: '⭐', label: 'Reply Reviews', href: '/dashboard/reviews' },
            { icon: '👥', label: 'Guest CRM',     href: '/dashboard/guests' },
          ].map(({ icon, label, href }) => (
            <Link key={label} href={href} className="bg-white border border-[#E8E0D4] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-ember hover:shadow-[0_2px_12px_rgba(232,93,38,0.12)] transition-all">
              <div className="w-9 h-9 rounded-lg bg-paper flex items-center justify-center text-lg">{icon}</div>
              <span className="text-xs font-medium text-charcoal">{label}</span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-[1.5fr_1fr] gap-4 mb-4">
          {/* Pending reviews */}
          <Card>
            <CardHeader>
              <div>
                <div className="font-display font-semibold text-ink text-base">Pending Reviews</div>
                <div className="text-[11px] text-mid mt-0.5">Needs your response</div>
              </div>
              <Link href="/dashboard/reviews">
                <Button size="sm" variant="ghost">View all</Button>
              </Link>
            </CardHeader>
            <CardBody>
              {!pendingReviews?.length ? (
                <EmptyState message="No pending reviews — you're all caught up!" />
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingReviews.map(r => (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-paper border border-[#E8E0D4]">
                      <div className="w-8 h-8 rounded-lg bg-[#C0392B]/10 flex items-center justify-center text-sm flex-shrink-0">⚠️</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-medium text-ink">{r.author_name || 'Anonymous'}</span>
                          <span className="text-[11px] text-gold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          <span className="text-[10px] text-mid ml-auto">{new Date(r.review_date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[12px] text-mid line-clamp-2">{r.content || 'No review text'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI recommendations */}
          <Card>
            <CardHeader>
              <div className="font-display font-semibold text-ink text-base">AI Insights</div>
              <span className="w-2 h-2 bg-ember rounded-full animate-pulse"/>
            </CardHeader>
            <CardBody>
              {!aiRecs?.length ? (
                <EmptyState message="AI insights generate nightly. Check back tomorrow." />
              ) : (
                <div className="flex flex-col gap-3">
                  {aiRecs.map(rec => (
                    <div key={rec.id} className="p-3 rounded-lg border border-[#E8E0D4] hover:border-ember/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded ${rec.priority === 'high' ? 'bg-ember/10 text-ember' : 'bg-teal/10 text-teal'}`}>
                          {rec.priority}
                        </span>
                        <span className="text-[11px] text-mid">{rec.type}</span>
                      </div>
                      <p className="text-[12px] font-medium text-ink">{rec.title}</p>
                      <p className="text-[11px] text-mid mt-0.5 line-clamp-2">{rec.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Recent guests */}
        <Card>
          <CardHeader>
            <div className="font-display font-semibold text-ink text-base">Recent Guests</div>
            <Link href="/dashboard/guests">
              <Button size="sm" variant="ghost">View all {totalGuests ?? 0}</Button>
            </Link>
          </CardHeader>
          {!recentGuests?.length ? (
            <CardBody><EmptyState message="No guests yet. Share your QR code to start enrolling members." /></CardBody>
          ) : (
            <div>
              {recentGuests.map((g, i) => (
                <div key={g.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-cream transition-colors ${i < (recentGuests.length - 1) ? 'border-b border-[#E8E0D4]' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {(g.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-ink">{g.name || 'Unknown Guest'}</div>
                    <div className="text-[11px] text-mid">{g.phone} · {g.total_visits} visit{g.total_visits !== 1 ? 's' : ''}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${tierColors[g.loyalty_tier] || tierColors.none}`}>
                    {g.loyalty_tier === 'none' ? 'No tier' : g.loyalty_tier}
                  </span>
                  <span className="text-[11px] text-mid">
                    {g.last_visit_at ? new Date(g.last_visit_at).toLocaleDateString() : 'No visits'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
