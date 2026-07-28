export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import { isAiConfigured } from '@/lib/ai'
import { getIntelligence, persistRecommendations } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import Badge from '@/components/ui/Badge'
import AiSummary from './AiSummary'
import {
  Empty,
  HealthCard,
  IntegrationCard,
  Metric,
  RecommendationCard,
} from './components'

export default async function ExecutivePage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const snapshot = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  // Record anything new so status survives between visits. Non-blocking by
  // design — the page renders whether or not bookkeeping succeeds.
  await persistRecommendations(venue.id, snapshot.recommendations)

  const { health, customers, loyalty, reviews, recommendations, assistant } = snapshot
  const critical = recommendations.filter(r => r.priority === 'high')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Snapshot */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total guests" value={customers.totalGuests} />
        <KpiCard label="Loyalty members" value={loyalty.totalMembers} accent="gold" />
        <KpiCard
          label="Average rating"
          value={reviews.averageRating === null ? '—' : `${reviews.averageRating} ★`}
          accent="teal"
        />
        <KpiCard label="Open recommendations" value={recommendations.length} accent="ember" />
      </div>

      <HealthCard health={health} />

      {/* Critical alerts */}
      {critical.length > 0 && (
        <Card className="border-l-2 border-l-ember">
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">
              Needs your attention
            </h2>
            <p className="text-xs text-mid mt-0.5">
              {critical.length} {critical.length === 1 ? 'issue' : 'issues'} worth acting on this week.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {critical.map(r => <RecommendationCard key={r.type} recommendation={r} />)}
          </CardBody>
        </Card>
      )}

      <AiSummary configured={isAiConfigured()} />

      {/* All recommendations */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-ink">Recommendations</h2>
            <p className="text-xs text-mid mt-0.5">
              Generated from your data, with the figures that triggered each one.
            </p>
          </div>
          <Link href="/dashboard/intelligence/opportunities" className="text-[13px] text-teal hover:underline">
            See opportunities
          </Link>
        </CardHeader>
        <CardBody className={recommendations.length ? 'space-y-3' : 'p-0'}>
          {recommendations.length === 0 ? (
            <Empty
              icon="✅"
              title="Nothing needs attention"
              body="No rule found a problem worth raising. As more guests, visits and reviews come in, this becomes more useful."
            />
          ) : (
            recommendations.map(r => <RecommendationCard key={r.type} recommendation={r} />)
          )}
        </CardBody>
      </Card>

      {/* Business snapshot */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Business snapshot</h2>
            <p className="text-xs text-mid mt-0.5">Last 30 days</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="New guests" value={customers.newGuests30d} />
            <Metric label="Returning guests" value={customers.returningGuests30d} />
            <Metric label="New loyalty members" value={loyalty.newMembers30d} />
            <Metric label="Points issued" value={loyalty.pointsIssued.toLocaleString()} />
            <Metric
              label="Review requests answered"
              value={reviews.requestsSent ? `${reviews.requestsCompleted} of ${reviews.requestsSent}` : null}
            />
            <Metric label="Members needing attention" value={customers.inactiveGuests.length} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Assistant</h2>
            <p className="text-xs text-mid mt-0.5">Last 30 days</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="Conversations" value={assistant.conversations30d} />
            <Metric label="Handed to your team" value={assistant.escalations30d} />
            <Metric
              label="Escalation rate"
              value={assistant.escalationRate === null ? null : `${Math.round(assistant.escalationRate * 100)}%`}
            />
            <Metric label="Failed AI requests" value={assistant.aiFailures30d} />
            <Metric label="Pending reservation requests" value={assistant.pendingReservations} />
            <div className="flex items-start justify-between gap-4">
              <span className="text-[13px] text-mid">Topics it cannot answer</span>
              {assistant.unansweredTopics.length === 0 ? (
                <span className="font-data text-[13px] font-semibold text-ink">none</span>
              ) : (
                <Link href="/dashboard/ai/knowledge" className="shrink-0">
                  <Badge variant="warning">{assistant.unansweredTopics.length} to fill in</Badge>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Future integrations */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">
            Available once connected
          </h2>
          <p className="text-xs text-mid mt-0.5">
            These need data this platform does not hold yet. Nothing is estimated in the meantime.
          </p>
        </CardHeader>
        <CardBody className="grid grid-cols-3 gap-3">
          <IntegrationCard
            title="Revenue intelligence"
            description="Actual takings by day, service and channel, against guest behaviour."
            requires="a POS system"
          />
          <IntegrationCard
            title="POS analytics"
            description="Which dishes sell, at what margin, and to which guests."
            requires="a POS system"
          />
          <IntegrationCard
            title="Customer lifetime value"
            description="What a guest is worth over their relationship with you, by tier and source."
            requires="a POS system"
          />
          <IntegrationCard
            title="Churn prediction"
            description="Which guests are about to stop coming, before they do."
            requires="six months of visit history"
          />
          <IntegrationCard
            title="Revenue forecasting"
            description="Expected covers and takings for the weeks ahead."
            requires="a POS system"
          />
          <IntegrationCard
            title="Campaign performance"
            description="Which campaigns brought guests back, and what that was worth."
            requires="your first campaign"
          />
        </CardBody>
      </Card>
    </div>
  )
}
