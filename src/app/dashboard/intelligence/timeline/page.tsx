export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { getIntelligence, type TimelineEventKind } from '@/lib/intelligence'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Empty } from '../components'

const KIND_LABEL: Record<TimelineEventKind, string> = {
  member_enrolled:     'Loyalty',
  tier_upgrade:        'Tier upgrade',
  negative_feedback:   'Criticism',
  escalation:          'Escalation',
  recommendation:      'Recommendation',
  reservation_request: 'Reservation',
  review_received:     'Review',
}

const KIND_VARIANT: Record<TimelineEventKind, 'default' | 'gold' | 'danger' | 'teal' | 'success'> = {
  member_enrolled:     'teal',
  tier_upgrade:        'gold',
  negative_feedback:   'danger',
  escalation:          'danger',
  recommendation:      'default',
  reservation_request: 'teal',
  review_received:     'success',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function TimelinePage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const { timeline } = await getIntelligence({
    id: venue.id, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Business timeline</h2>
          <p className="text-xs text-mid mt-0.5">
            Everything worth knowing about, newest first
          </p>
        </CardHeader>
        <CardBody className={timeline.length ? '' : 'p-0'}>
          {timeline.length === 0 ? (
            <Empty
              icon="🕒"
              title="Nothing has happened yet"
              body="Enrolments, reviews, escalations and recommendations all appear here as they occur."
            />
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {timeline.map((e, i) => (
                  <div key={i} className="flex gap-4 relative">
                    <div className="w-[15px] shrink-0 flex justify-center pt-1.5">
                      <span className="w-[7px] h-[7px] rounded-full bg-ember ring-4 ring-white" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] text-ink">{e.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={KIND_VARIANT[e.kind]}>{KIND_LABEL[e.kind]}</Badge>
                          <span className="text-[11px] text-mid">{fmt(e.at)}</span>
                        </div>
                      </div>
                      {e.detail && <p className="text-xs text-mid mt-0.5">{e.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
