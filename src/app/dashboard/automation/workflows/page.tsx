export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import { listWorkflows, describeSchedule, describeTrigger } from '@/lib/automation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Empty, WorkflowRow } from '../components'

export default async function WorkflowsPage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-mid">No venue is linked to your account yet.</p></div>
  }

  const workflows = await listWorkflows(venue.id)
  const groups = [
    { label: 'Active',   items: workflows.filter(w => w.status === 'active') },
    { label: 'Draft',    items: workflows.filter(w => w.status === 'draft') },
    { label: 'Disabled', items: workflows.filter(w => w.status === 'disabled') },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[18px] font-semibold text-ink">Workflows</h1>
          <p className="text-[13px] text-mid mt-0.5">{workflows.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/automation/templates" className="px-3.5 py-2 rounded-lg border border-border text-[13px] text-ink hover:bg-paper transition-colors">
            Templates
          </Link>
          <Link href="/dashboard/automation/new" className="px-3.5 py-2 rounded-lg bg-ember text-white text-[13px] font-medium hover:bg-ember/90 transition-colors">
            New workflow
          </Link>
        </div>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <Empty
              icon="⚡"
              title="No workflows yet"
              body="A workflow listens for something that happens, checks a few conditions, and acts. Start from a template — every one installs as a draft you can edit before switching it on."
              action={{ href: '/dashboard/automation/templates', label: 'Browse templates' }}
            />
          </CardBody>
        </Card>
      ) : (
        groups.filter(g => g.items.length > 0).map(group => (
          <Card key={group.label}>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">{group.label}</h2>
            </CardHeader>
            <CardBody className="p-0">
              {group.items.map(w => (
                <WorkflowRow
                  key={w.id}
                  workflow={w}
                  scheduleLabel={describeSchedule(w.schedule)}
                  triggerLabel={describeTrigger(w.triggerEvent)?.label ?? w.triggerEvent}
                />
              ))}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  )
}
