export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { getIntelligence } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Empty, OpportunityCard } from '../components'

export default async function OpportunitiesPage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const { opportunities } = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  const totalAudience = opportunities.reduce((s, o) => s + o.audienceSize, 0)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Opportunities</h2>
          <p className="text-xs text-mid mt-0.5">
            Audiences worth acting on. Nothing here sends anything — these are for you to decide on.
          </p>
        </CardHeader>
        <CardBody className={opportunities.length ? 'space-y-3' : 'p-0'}>
          {opportunities.length === 0 ? (
            <Empty
              icon="🎯"
              title="No opportunities yet"
              body="These appear as guests enrol, visit and leave feedback — there is nothing to act on with the data so far."
            />
          ) : (
            <>
              <p className="text-[13px] text-mid">
                {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'} covering{' '}
                {totalAudience} {totalAudience === 1 ? 'guest' : 'guest contacts'}.
              </p>
              {opportunities.map(o => <OpportunityCard key={o.kind} opportunity={o} />)}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="py-3.5">
          <p className="text-[13px] font-medium text-ink">Acting on these</p>
          <p className="text-xs text-mid mt-1 leading-relaxed">
            For now these are reviewed by hand — open Guest CRM to find the guests concerned. The
            Automation Engine will later turn an opportunity into a campaign directly.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
