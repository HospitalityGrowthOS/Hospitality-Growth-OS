export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { getExecution, listExecutions } from '@/lib/automation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ActionTrace, ConditionTrace, Empty, ExecutionRow, ExecutionStatusBadge } from '../components'
import ApprovalControls from './ApprovalControls'

export default async function ExecutionsPage({
  searchParams,
}: { searchParams: { id?: string } }) {
  const venue = await getCurrentVenue()
  if (!venue) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-mid">No venue is linked to your account yet.</p></div>
  }

  const [executions, selected] = await Promise.all([
    listExecutions({ venueId: venue.id, limit: 60 }),
    searchParams.id ? getExecution(venue.id, searchParams.id) : Promise.resolve(null),
  ])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {selected && (
        <Card className="border-l-2 border-l-ember">
          <CardHeader className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-[15px] font-semibold text-ink">
                  {selected.workflowName ?? 'Workflow run'}
                </h2>
                <ExecutionStatusBadge status={selected.status} />
              </div>
              <p className="text-xs text-mid mt-0.5 font-data">
                {selected.eventName} · {new Date(selected.createdAt).toLocaleString('en-GB')}
                {selected.durationMs !== null && <> · {selected.durationMs}ms</>}
              </p>
            </div>
            {selected.status === 'awaiting_approval' && <ApprovalControls executionId={selected.id} />}
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-mid mb-2">Conditions</p>
              <ConditionTrace conditions={selected.conditionsEvaluated} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-mid mb-2">Actions</p>
              <ActionTrace actions={selected.actionsExecuted} />
            </div>
            {selected.error && (
              <div className="col-span-2 text-[12px] text-[#C0392B] bg-[#FEF2F2] rounded-lg p-3">
                {selected.error}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Execution history</h2>
          <p className="text-xs text-mid mt-0.5">
            The permanent audit log. Skipped runs are kept too — knowing why a workflow did nothing matters as much as knowing it ran.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {executions.length === 0 ? (
            <Empty icon="📋" title="No runs yet" body="Executions appear as soon as a workflow reacts to an event." />
          ) : (
            executions.map(e => <ExecutionRow key={e.id} execution={e} />)
          )}
        </CardBody>
      </Card>
    </div>
  )
}
