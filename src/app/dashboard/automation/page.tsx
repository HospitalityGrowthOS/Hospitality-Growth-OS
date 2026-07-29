export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import {
  automationStats, listExecutions, listWorkflows, recentEvents,
  describeSchedule, describeTrigger,
} from '@/lib/automation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import Badge from '@/components/ui/Badge'
import { Empty, ExecutionRow, WorkflowRow } from './components'

export default async function AutomationOverviewPage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const [stats, workflows, executions, events] = await Promise.all([
    automationStats(venue.id),
    listWorkflows(venue.id),
    listExecutions({ venueId: venue.id, limit: 8 }),
    recentEvents(venue.id, 8),
  ])

  const needsApproval = executions.filter(e => e.status === 'awaiting_approval')
  const active = workflows.filter(w => w.status === 'active')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Active workflows" value={stats.activeWorkflows} />
        <KpiCard label="Runs today" value={stats.executionsToday} accent="teal" />
        <KpiCard
          label="Success rate"
          value={stats.successRate === null ? '—' : `${stats.successRate}%`}
          accent="gold"
        />
        <KpiCard label="Failed today" value={stats.failedToday} accent="ember" />
      </div>

      {/* Anything held for a person comes first — it is the only thing here
          that is actually waiting on the owner. */}
      {needsApproval.length > 0 && (
        <Card className="border-l-2 border-l-gold">
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Waiting for your approval</h2>
            <p className="text-xs text-mid mt-0.5">
              {needsApproval.length} run{needsApproval.length === 1 ? '' : 's'} evaluated and held. Nothing has reached a guest.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {needsApproval.map(e => <ExecutionRow key={e.id} execution={e} />)}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">Workflows</h2>
              <p className="text-xs text-mid mt-0.5">
                {stats.activeWorkflows} active · {stats.draftWorkflows} draft · {stats.disabledWorkflows} disabled
              </p>
            </div>
            <Link href="/dashboard/automation/workflows" className="text-[13px] text-teal hover:underline shrink-0">
              Manage
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {active.length === 0 ? (
              <Empty
                icon="⚡"
                title="Nothing is running yet"
                body="Install a template to get a workflow you can review, edit and switch on."
                action={{ href: '/dashboard/automation/templates', label: 'Browse templates' }}
              />
            ) : (
              active.slice(0, 5).map(w => (
                <WorkflowRow
                  key={w.id}
                  workflow={w}
                  scheduleLabel={describeSchedule(w.schedule)}
                  triggerLabel={describeTrigger(w.triggerEvent)?.label ?? w.triggerEvent}
                />
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">Recent runs</h2>
              <p className="text-xs text-mid mt-0.5">Every execution is recorded, including the ones that did nothing</p>
            </div>
            <Link href="/dashboard/automation/executions" className="text-[13px] text-teal hover:underline shrink-0">
              Full history
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {executions.length === 0 ? (
              <Empty icon="📋" title="No runs yet" body="Executions appear here as soon as a workflow reacts to an event." />
            ) : (
              executions.map(e => <ExecutionRow key={e.id} execution={e} />)
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Recent events</h2>
          <p className="text-xs text-mid mt-0.5">
            What the platform is emitting. Workflows react to these — an event with no workflow simply passes by.
          </p>
        </CardHeader>
        <CardBody className={events.length ? 'space-y-2' : 'p-0'}>
          {events.length === 0 ? (
            <Empty
              icon="📡"
              title="No events yet"
              body="Events appear when guests enrol, visit, or leave feedback."
            />
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-4 text-[12px]">
                <span className="font-data text-ink truncate">{e.event_type}</span>
                <span className="text-mid shrink-0">
                  {new Date(e.occurred_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">System health</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[12px] text-mid mb-1">Scheduled and waiting</p>
            <p className="font-data text-[18px] text-ink">{stats.pending}</p>
          </div>
          <div>
            <p className="text-[12px] text-mid mb-1">Held for approval</p>
            <p className="font-data text-[18px] text-ink">{stats.awaitingApproval}</p>
          </div>
          <div>
            <p className="text-[12px] text-mid mb-1">Delivery channel</p>
            <Badge variant={venue.whatsapp_phone_number_id ? 'success' : 'warning'}>
              {venue.whatsapp_phone_number_id ? 'WhatsApp connected' : 'WhatsApp not configured'}
            </Badge>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
