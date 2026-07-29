export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentVenue } from '@/lib/venue'
import {
  getWorkflow, listExecutions, triggersByCategory, CONDITION_FIELDS, ACTIONS,
  describeSchedule, describeTrigger, workflowWarnings,
} from '@/lib/automation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Empty, ExecutionRow, WorkflowStatusBadge } from '../../components'
import WorkflowBuilder from '../../WorkflowBuilder'
import WorkflowControls from './WorkflowControls'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const venue = await getCurrentVenue()
  if (!venue) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-mid">No venue is linked to your account yet.</p></div>
  }

  const workflow = await getWorkflow(venue.id, params.id)
  if (!workflow) notFound()

  const executions = await listExecutions({ venueId: venue.id, workflowId: workflow.id, limit: 15 })
  const warnings = workflowWarnings(workflow)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[18px] font-semibold text-ink">{workflow.name}</h1>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
          <p className="text-[13px] text-mid mt-0.5">
            When {describeTrigger(workflow.triggerEvent)?.label ?? workflow.triggerEvent} · {describeSchedule(workflow.schedule).toLowerCase()}
          </p>
        </div>
        <WorkflowControls workflow={workflow} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-gold/40 bg-gold/[0.08] px-4 py-3 space-y-1">
          {warnings.map((w, i) => <p key={i} className="text-[12px] text-ink">{w}</p>)}
        </div>
      )}

      <WorkflowBuilder
        triggers={triggersByCategory()}
        fields={CONDITION_FIELDS}
        actions={ACTIONS}
        existing={workflow}
      />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-ink">Runs</h2>
            <p className="text-xs text-mid mt-0.5">{workflow.executionCount} total</p>
          </div>
          <Link href="/dashboard/automation/executions" className="text-[13px] text-teal hover:underline shrink-0">
            Full history
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {executions.length === 0 ? (
            <Empty icon="📋" title="No runs yet" body="Use Test run above to see what this would do without touching anything." />
          ) : (
            executions.map(e => <ExecutionRow key={e.id} execution={e} />)
          )}
        </CardBody>
      </Card>
    </div>
  )
}
