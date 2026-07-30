export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import { getIntelligence, INACTIVE_AFTER_DAYS } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import Badge from '@/components/ui/Badge'
import { Empty, Insights, Metric } from '../components'
import { formatMoneyShort } from '@/lib/money'

const TIER_VARIANT: Record<string, 'gold' | 'silver' | 'bronze' | 'default'> = {
  gold: 'gold', silver: 'silver', bronze: 'bronze', none: 'default',
}

export default async function CustomerIntelligencePage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const { customers } = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  const returningShare = customers.uniqueVisitors30d
    ? Math.round((customers.returningGuests30d / customers.uniqueVisitors30d) * 100)
    : null

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total guests" value={customers.totalGuests} />
        <KpiCard label="New (30 days)" value={customers.newGuests30d} accent="teal" />
        <KpiCard
          label="Returning rate"
          value={returningShare === null ? '—' : `${returningShare}%`}
          accent="gold"
        />
        <KpiCard label="Needing attention" value={customers.inactiveGuests.length} accent="ember" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">What this means</h2>
        </CardHeader>
        <CardBody>
          <Insights items={customers.insights} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Growth</h2>
            <p className="text-xs text-mid mt-0.5">Last 30 days against the 30 before</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Metric label="New guests" value={customers.newGuests30d} />
            <Metric label="Previous 30 days" value={customers.newGuestsPrev30d} />
            <Metric label="Guests who visited" value={customers.uniqueVisitors30d} />
            <Metric label="Came more than once" value={customers.returningGuests30d} />
            <Metric label="New loyalty members" value={customers.newMembers30d} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Tier distribution</h2>
            <p className="text-xs text-mid mt-0.5">{customers.loyaltyMembers} members</p>
          </CardHeader>
          <CardBody className={customers.tierDistribution.length ? 'space-y-2.5' : 'p-0'}>
            {customers.tierDistribution.length === 0 ? (
              <Empty icon="🎁" title="No members yet" body="Tiers appear once guests enrol through your QR code." />
            ) : (
              customers.tierDistribution.map(({ tier, count }) => {
                const share = customers.loyaltyMembers
                  ? Math.round((count / customers.loyaltyMembers) * 100)
                  : 0
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="w-20 shrink-0">
                      <Badge variant={TIER_VARIANT[tier] ?? 'default'} className="capitalize">{tier}</Badge>
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
          <h2 className="font-display text-[15px] font-semibold text-ink">Guests needing attention</h2>
          <p className="text-xs text-mid mt-0.5">
            Members with no visit in over {INACTIVE_AFTER_DAYS} days, longest gap first
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {customers.inactiveGuests.length === 0 ? (
            <Empty icon="👍" title="Nobody has drifted away" body="Every loyalty member has visited recently." />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Guest</th>
                  <th className="px-5 py-2.5 font-semibold">Tier</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Points</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Days away</th>
                </tr>
              </thead>
              <tbody>
                {customers.inactiveGuests.slice(0, 15).map(g => (
                  <tr key={g.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/guests/${g.id}`} className="text-ink hover:text-teal">
                        {g.name || 'Unnamed guest'}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={TIER_VARIANT[g.tier] ?? 'default'} className="capitalize">{g.tier}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-data text-mid">{g.points}</td>
                    <td className="px-5 py-3 text-right font-data text-ink">{g.daysInactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Most valuable guests</h2>
          <p className="text-xs text-mid mt-0.5">By recorded spend</p>
        </CardHeader>
        <CardBody className="p-0">
          {customers.topGuests.length === 0 ? (
            <Empty
              icon="⭐"
              title="No visits recorded yet"
              body="Record visits when guests pay and your regulars will surface here."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Guest</th>
                  <th className="px-5 py-2.5 font-semibold">Tier</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Visits</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Spend</th>
                </tr>
              </thead>
              <tbody>
                {customers.topGuests.map(g => (
                  <tr key={g.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/guests/${g.id}`} className="text-ink hover:text-teal">
                        {g.name || 'Unnamed guest'}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={TIER_VARIANT[g.tier] ?? 'default'} className="capitalize">{g.tier}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-data text-mid">{g.visits}</td>
                    <td className="px-5 py-3 text-right font-data font-semibold text-ink">
                      {formatMoneyShort(g.totalSpent, venue.settings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
