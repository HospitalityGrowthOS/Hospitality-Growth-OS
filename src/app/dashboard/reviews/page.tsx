export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { Review } from '@/types/database'
import CreateReviewRequestButton from './CreateReviewRequestButton'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="12" height="12" viewBox="0 0 24 24"
          fill={s <= rating ? '#C8A45A' : 'none'}
          stroke={s <= rating ? '#C8A45A' : '#D4C9BE'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </div>
  )
}

function EmptyReviews() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">⭐</div>
      <h3 className="font-display font-semibold text-ink mb-1">No reviews yet</h3>
      <p className="text-[13px] text-mid max-w-xs">Reviews will appear here once guests leave feedback.</p>
    </div>
  )
}

function EmptyRequests() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-3xl mb-3">📨</div>
      <h3 className="font-display font-semibold text-ink mb-1">No requests sent yet</h3>
      <p className="text-[13px] text-mid max-w-xs">Create your first review request above to start collecting feedback.</p>
    </div>
  )
}

type ReviewRequest = {
  id: string
  status: string
  rating: number | null
  feedback: string | null
  guest_name: string | null
  guest_phone: string | null
  created_at: string
  completed_at: string | null
}

export default async function ReviewsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Reviews" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center"><EmptyReviews /></div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: allReviews, error: reviewsError },
    { count: totalReviews },
    { count: respondedReviews },
    { data: ratingData },
    { data: reviewRequests, error: requestsError },
  ] = await Promise.all([
    supabase.from('reviews').select('*').eq('venue_id', venueId).order('review_date', { ascending: false }).limit(50),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'responded'),
    supabase.from('reviews').select('rating').eq('venue_id', venueId).gte('review_date', thirtyDaysAgo),
    supabase.from('review_requests').select('*').eq('venue_id', venueId).order('created_at', { ascending: false }).limit(50),
  ])

  const avgRating = ratingData?.length
    ? +(ratingData.reduce((a, r) => a + r.rating, 0) / ratingData.length).toFixed(1)
    : null

  const responseRate = (totalReviews ?? 0) > 0
    ? Math.round(((respondedReviews ?? 0) / (totalReviews ?? 1)) * 100)
    : 0

  const pending = (allReviews ?? []).filter((r: Review) => r.status === 'pending')
  const responded = (allReviews ?? []).filter((r: Review) => r.status !== 'pending')

  // Review request stats
  const requests = (reviewRequests ?? []) as ReviewRequest[]
  const totalRequests = requests.length
  const completedRequests = requests.filter(r => r.status !== 'pending').length
  const positiveRequests = requests.filter(r => r.status === 'positive').length
  const negativeRequests = requests.filter(r => r.status === 'negative').length
  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0

  return (
    <>
      <Topbar
        title="Reviews"
        subtitle="Collect and manage guest feedback"
        actions={
          <div className="flex items-center gap-2">
            {pending.length > 0 && <Badge variant="danger">{pending.length} pending</Badge>}
            <Button size="sm">Auto-respond all</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-7 space-y-8">

        {/* ── Review Requests Section ───────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-ink text-lg">Review Requests</h2>
              <p className="text-[12px] text-mid">Send feedback links to guests after their visit</p>
            </div>
            <CreateReviewRequestButton venueId={venueId} />
          </div>

          {/* Request KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Sent',      value: String(totalRequests),    sub: 'All time',           color: 'border-t-ember' },
              { label: 'Completed',       value: `${completionRate}%`,     sub: `${completedRequests} responses`, color: 'border-t-teal' },
              { label: 'Positive (≥4★)', value: String(positiveRequests), sub: completedRequests > 0 ? `${Math.round(positiveRequests/Math.max(completedRequests,1)*100)}% of completed` : '—', color: 'border-t-[#2A9D5C]' },
              { label: 'Negative (≤3★)', value: String(negativeRequests), sub: 'Private feedback',   color: 'border-t-[#C0392B]' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`bg-white border border-[#E8E0D4] border-t-2 ${color} rounded-xl p-5`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mid mb-2">{label}</div>
                <div className="font-data text-3xl font-bold text-ink leading-none">{value}</div>
                <div className="text-[11px] text-mid mt-2">{sub}</div>
              </div>
            ))}
          </div>

          {/* Requests table */}
          <Card>
            {requestsError ? (
              <div className="p-5 text-[13px] text-[#C0392B]">Failed to load requests.</div>
            ) : !requests.length ? (
              <EmptyRequests />
            ) : (
              <div>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-4 py-2.5 border-b border-[#E8E0D4] bg-paper/60 rounded-t-xl">
                  {['Guest', 'Phone', 'Rating', 'Status', 'Sent'].map(h => (
                    <div key={h} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mid">{h}</div>
                  ))}
                </div>
                {requests.map((req, i) => (
                  <div
                    key={req.id}
                    className={`grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-4 py-3 items-center ${i < requests.length - 1 ? 'border-b border-[#E8E0D4]' : ''} hover:bg-paper/40 transition-colors`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-ember/10 flex items-center justify-center text-xs font-bold text-ember flex-shrink-0">
                        {(req.guest_name || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-[13px] text-ink font-medium truncate">{req.guest_name || 'Unknown'}</span>
                    </div>
                    <span className="text-[12px] text-mid font-data">{req.guest_phone || '—'}</span>
                    <div>
                      {req.rating ? (
                        <span className="flex items-center gap-1 text-[12px] font-data font-semibold text-ink">
                          <span className="text-gold">★</span>{req.rating}
                        </span>
                      ) : (
                        <span className="text-[12px] text-mid">—</span>
                      )}
                    </div>
                    <div>
                      {req.status === 'pending' && <Badge variant="warning">Pending</Badge>}
                      {req.status === 'positive' && <Badge variant="success">Positive</Badge>}
                      {req.status === 'negative' && <Badge variant="danger">Negative</Badge>}
                      {req.status === 'completed' && <Badge variant="teal">Completed</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-mid">{new Date(req.created_at).toLocaleDateString()}</span>
                      {req.status === 'pending' && (
                        <a
                          href={`/feedback/${req.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-ember hover:underline"
                        >
                          link ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ── Existing Reviews Section ──────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="font-display font-semibold text-ink text-lg">Google / Platform Reviews</h2>
            <p className="text-[12px] text-mid">Reviews imported from your connected platforms</p>
          </div>

          {/* Platform review KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Avg Rating',       value: avgRating ? `${avgRating}★` : '—', sub: 'Last 30 days',  color: 'border-t-gold' },
              { label: 'Total Reviews',    value: String(totalReviews ?? 0),          sub: 'All time',      color: 'border-t-ember' },
              { label: 'Needs Response',   value: String(pending.length),             sub: pending.length > 0 ? 'Action needed' : 'All caught up', color: 'border-t-[#C0392B]' },
              { label: 'Response Rate',    value: `${responseRate}%`,                 sub: 'Target: 60%',   color: 'border-t-teal' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`bg-white border border-[#E8E0D4] border-t-2 ${color} rounded-xl p-5`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mid mb-2">{label}</div>
                <div className="font-data text-3xl font-bold text-ink leading-none">{value}</div>
                <div className="text-[11px] text-mid mt-2">{sub}</div>
              </div>
            ))}
          </div>

          {reviewsError ? (
            <div className="bg-[#C0392B]/5 border border-[#C0392B]/20 rounded-xl p-5 text-[13px] text-[#C0392B]">
              Failed to load reviews.
            </div>
          ) : !allReviews?.length ? (
            <Card><EmptyReviews /></Card>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-ink text-sm">Needs Response</h3>
                    <span className="bg-[#C0392B]/10 text-[#C0392B] text-[10px] font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {pending.map((review: Review) => (
                      <Card key={review.id}>
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#C0392B]/10 flex items-center justify-center text-sm flex-shrink-0">⚠️</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-[13px] text-ink">{review.author_name || 'Anonymous'}</span>
                                <StarRating rating={review.rating} />
                                <Badge variant="teal" className="text-[10px]">{review.platform}</Badge>
                                <span className="text-[11px] text-mid ml-auto">{new Date(review.review_date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[13px] text-charcoal leading-relaxed mb-3">{review.content || 'No review text'}</p>
                              {review.ai_response_draft && (
                                <div className="bg-paper rounded-lg p-3 border border-[#E8E0D4] mb-3">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ember">AI Draft</span>
                                    <span className="w-1.5 h-1.5 bg-ember rounded-full"/>
                                  </div>
                                  <p className="text-[12px] text-mid leading-relaxed italic">{review.ai_response_draft}</p>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button size="sm">Send Response</Button>
                                <Button size="sm" variant="secondary">Edit Draft</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {responded.length > 0 && (
                <div>
                  <h3 className="font-semibold text-ink text-sm mb-3">Responded</h3>
                  <Card>
                    {responded.map((review: Review, i: number) => (
                      <div key={review.id} className={`flex items-start gap-3 p-4 ${i < responded.length - 1 ? 'border-b border-[#E8E0D4]' : ''}`}>
                        <div className="w-8 h-8 rounded-lg bg-[#2A9D5C]/10 flex items-center justify-center text-sm flex-shrink-0">⭐</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-[13px] text-ink">{review.author_name || 'Anonymous'}</span>
                            <StarRating rating={review.rating} />
                            <Badge variant="teal" className="text-[10px]">{review.platform}</Badge>
                            <span className="text-[11px] text-mid ml-auto">{new Date(review.review_date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[12px] text-mid leading-relaxed">{review.content || 'No review text'}</p>
                        </div>
                        <Badge variant="success">Responded</Badge>
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
