export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { getIntelligence, POSITIVE_THRESHOLD } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import Badge from '@/components/ui/Badge'
import { Empty, Insights, Metric, RecommendationCard } from '../components'

export default async function ReviewIntelligencePage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const { reviews, recommendations } = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  const reviewRecommendations = recommendations.filter(r => r.category === 'reviews')
  const totalRated = reviews.positiveCount + reviews.negativeCount
  const maxWeek = Math.max(1, ...reviews.weeklyTrend.map(w => w.count))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Average rating"
          value={reviews.averageRating === null ? '—' : `${reviews.averageRating} ★`}
          accent="gold"
        />
        <KpiCard label="Requests sent" value={reviews.requestsSent} />
        <KpiCard
          label="Answered"
          value={reviews.completionRate === null ? '—' : `${Math.round(reviews.completionRate * 100)}%`}
          accent="teal"
        />
        <KpiCard label="Below 4 stars" value={reviews.negativeCount} accent="ember" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">What this means</h2>
        </CardHeader>
        <CardBody>
          <Insights items={reviews.insights} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Response funnel</h2>
            <p className="text-xs text-mid mt-0.5">From request sent to rating given</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="Requests sent" value={reviews.requestsSent} />
            <Metric label="Answered" value={reviews.requestsCompleted} />
            <Metric
              label="Completion rate"
              value={reviews.completionRate === null ? null : `${Math.round(reviews.completionRate * 100)}%`}
            />
            <Metric
              label={`Rated ${POSITIVE_THRESHOLD}+ stars`}
              value={totalRated ? `${reviews.positiveCount} of ${totalRated}` : null}
              note="These are the guests sent on to Google"
            />
            <Metric
              label="Kept private"
              value={reviews.negativeCount || null}
              note="Lower ratings reach you instead of appearing publicly"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Guest sentiment</h2>
            <p className="text-xs text-mid mt-0.5">
              How guests sounded in conversation — a separate signal from star ratings
            </p>
          </CardHeader>
          <CardBody className={reviews.sentimentDistribution.length ? 'space-y-2.5' : 'p-0'}>
            {reviews.sentimentDistribution.length === 0 ? (
              <Empty
                icon="💬"
                title="No conversations analysed yet"
                body="Sentiment appears once guests message your assistant."
              />
            ) : (
              reviews.sentimentDistribution.map(({ sentiment, count }) => {
                const total = reviews.sentimentDistribution.reduce((s, x) => s + x.count, 0)
                const share = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={sentiment} className="flex items-center gap-3">
                    <span className="w-20 shrink-0">
                      <Badge
                        variant={
                          sentiment === 'negative' ? 'danger'
                            : sentiment === 'positive' ? 'success'
                              : 'default'
                        }
                      >
                        {sentiment}
                      </Badge>
                    </span>
                    <div className="flex-1 h-1.5 bg-paper rounded-full overflow-hidden">
                      <div className="h-full bg-ember rounded-full" style={{ width: `${share}%` }} />
                    </div>
                    <span className="font-data text-[12px] text-mid w-14 text-right">{count} · {share}%</span>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Weekly trend</h2>
          <p className="text-xs text-mid mt-0.5">Responses received, last 12 weeks</p>
        </CardHeader>
        <CardBody className={reviews.weeklyTrend.length ? '' : 'p-0'}>
          {reviews.weeklyTrend.length === 0 ? (
            <Empty
              icon="📈"
              title="No responses yet"
              body="Once guests start answering review requests, the trend appears here."
            />
          ) : (
            <div className="flex items-end gap-2 h-32">
              {reviews.weeklyTrend.map(w => (
                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-data text-mid">
                    {w.avgRating === null ? '' : `${w.avgRating}★`}
                  </span>
                  <div
                    className="w-full bg-ember rounded-t"
                    style={{ height: `${(w.count / maxWeek) * 80}%`, minHeight: '4px' }}
                    title={`${w.count} responses`}
                  />
                  <span className="text-[10px] text-mid/70">
                    {new Date(w.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Recent criticism</h2>
          <p className="text-xs text-mid mt-0.5">
            Kept private rather than posted publicly — still worth answering
          </p>
        </CardHeader>
        <CardBody className={reviews.recentNegative.length ? 'space-y-2.5' : 'p-0'}>
          {reviews.recentNegative.length === 0 ? (
            <Empty icon="👍" title="No criticism to review" body="Nobody has rated you below 4 stars." />
          ) : (
            reviews.recentNegative.map((r, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-paper/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gold">
                    {'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}
                  </span>
                  <span className="text-[11px] text-mid">
                    {new Date(r.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="text-[13px] text-ink leading-relaxed">
                  {r.feedback ? `“${r.feedback}”` : 'No comment left.'}
                </p>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {reviewRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Review recommendations</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {reviewRecommendations.map(r => <RecommendationCard key={r.type} recommendation={r} />)}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
