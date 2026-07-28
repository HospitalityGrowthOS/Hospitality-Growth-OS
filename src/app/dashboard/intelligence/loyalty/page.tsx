export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import { getIntelligence } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import { Insights, Metric, RecommendationCard, Empty } from '../components'

export default async function LoyaltyIntelligencePage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const { loyalty, recommendations } = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  const loyaltyRecommendations = recommendations.filter(r => r.category === 'loyalty')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Members" value={loyalty.totalMembers} />
        <KpiCard label="Points issued" value={loyalty.pointsIssued.toLocaleString()} accent="gold" />
        <KpiCard
          label="Redemption rate"
          value={loyalty.redemptionRate === null ? '—' : `${Math.round(loyalty.redemptionRate * 100)}%`}
          accent="teal"
        />
        <KpiCard
          label="Engagement"
          value={loyalty.engagementRate === null ? '—' : `${Math.round(loyalty.engagementRate * 100)}%`}
          accent="ember"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">What this means</h2>
        </CardHeader>
        <CardBody>
          <Insights items={loyalty.insights} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Points</h2>
            <p className="text-xs text-mid mt-0.5">From the transaction ledger</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="Issued" value={loyalty.pointsIssued.toLocaleString()} />
            <Metric label="Redeemed" value={loyalty.pointsRedeemed.toLocaleString()} />
            <Metric
              label="Redemption rate"
              value={loyalty.redemptionRate === null ? null : `${Math.round(loyalty.redemptionRate * 100)}%`}
              note="Points spent as a share of points given out"
            />
            <Metric label="Active rewards" value={loyalty.activeRewards} />
            <Metric label="Reward redemptions" value={loyalty.rewardRedemptions} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Membership</h2>
            <p className="text-xs text-mid mt-0.5">Last 30 days</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="Total members" value={loyalty.totalMembers} />
            <Metric label="Joined this month" value={loyalty.newMembers30d} />
            <Metric label="Previous 30 days" value={loyalty.newMembersPrev30d} />
            <Metric label="Tier upgrades" value={loyalty.tierUpgrades30d} />
            <Metric
              label="Active members"
              value={loyalty.engagementRate === null ? null : `${Math.round(loyalty.engagementRate * 100)}%`}
              note="Any loyalty activity in the last 30 days"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Loyalty recommendations</h2>
          <p className="text-xs text-mid mt-0.5">Raised when the numbers suggest something is off</p>
        </CardHeader>
        <CardBody className={loyaltyRecommendations.length ? 'space-y-3' : 'p-0'}>
          {loyaltyRecommendations.length === 0 ? (
            <Empty
              icon="🎁"
              title="Nothing to flag"
              body="No loyalty rule found a problem. This becomes more useful as points are issued and redeemed."
            />
          ) : (
            loyaltyRecommendations.map(r => <RecommendationCard key={r.type} recommendation={r} />)
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between py-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Manage the programme</p>
            <p className="text-xs text-mid mt-0.5">Tiers, points per euro and rewards live in Loyalty.</p>
          </div>
          <Link href="/dashboard/loyalty" className="text-[13px] text-teal hover:underline shrink-0">
            Open Loyalty
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}
