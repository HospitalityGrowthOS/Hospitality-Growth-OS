/**
 * Execution history — the permanent audit log.
 *
 * Read-only queries plus the row→domain mapping. Executions are never edited
 * after they complete, so this file has no update path beyond approval and
 * cancellation, which are state transitions rather than corrections.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type {
  ActionResult, AutomationResult, ConditionResult, Execution, ExecutionStatus,
} from './types'

export function toExecution(row: Record<string, unknown>): Execution {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    workflowId: String(row.workflow_id),
    workflowName: (row.automation_workflows as { name?: string } | null)?.name,
    eventName: String(row.event_name),
    eventPayload: (row.event_payload as Record<string, unknown>) ?? {},
    status: row.status as ExecutionStatus,
    conditionsEvaluated: (row.conditions_evaluated as ConditionResult[]) ?? [],
    actionsExecuted: (row.actions_executed as ActionResult[]) ?? [],
    error: (row.error as string) ?? null,
    retryCount: Number(row.retry_count ?? 0),
    scheduledFor: (row.scheduled_for as string) ?? null,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    durationMs: (row.duration_ms as number) ?? null,
    targetGuestId: (row.target_guest_id as string) ?? null,
    targetChannel: (row.target_channel as string) ?? null,
    dryRun: Boolean(row.dry_run),
    createdAt: String(row.created_at),
  }
}

export async function listExecutions(params: {
  venueId: string
  workflowId?: string
  status?: ExecutionStatus
  limit?: number
}): Promise<Execution[]> {
  const supabase = await createAdminClient()
  let query = supabase
    .from('automation_executions')
    .select('*, automation_workflows(name)')
    .eq('venue_id', params.venueId)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)

  if (params.workflowId) query = query.eq('workflow_id', params.workflowId)
  if (params.status) query = query.eq('status', params.status)

  const { data, error } = await query
  if (error) {
    console.error('[automation] listExecutions failed:', error.message)
    return []
  }
  return (data ?? []).map(r => toExecution(r as Record<string, unknown>))
}

export async function getExecution(venueId: string, id: string): Promise<Execution | null> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_executions')
    .select('*, automation_workflows(name)')
    .eq('venue_id', venueId)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return toExecution(data as Record<string, unknown>)
}

export interface AutomationStats {
  activeWorkflows: number
  disabledWorkflows: number
  draftWorkflows: number
  executionsToday: number
  succeededToday: number
  failedToday: number
  pending: number
  awaitingApproval: number
  /** Successful share of today's finished executions, null when none finished. */
  successRate: number | null
}

/** Powers the executive dashboard. One pass over today's rows. */
export async function automationStats(venueId: string): Promise<AutomationStats> {
  const supabase = await createAdminClient()
  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const [{ data: workflows }, { data: today }, { data: outstanding }] = await Promise.all([
    supabase.from('automation_workflows').select('status').eq('venue_id', venueId),
    supabase.from('automation_executions').select('status')
      .eq('venue_id', venueId).gte('created_at', since.toISOString()),
    supabase.from('automation_executions').select('status')
      .eq('venue_id', venueId).in('status', ['pending', 'awaiting_approval']),
  ])

  const count = (rows: { status: string }[] | null, status: string) =>
    (rows ?? []).filter(r => r.status === status).length

  const succeeded = count(today as { status: string }[], 'success')
  const failed = count(today as { status: string }[], 'failed')
  const finished = succeeded + failed

  return {
    activeWorkflows:   count(workflows as { status: string }[], 'active'),
    disabledWorkflows: count(workflows as { status: string }[], 'disabled'),
    draftWorkflows:    count(workflows as { status: string }[], 'draft'),
    executionsToday:   (today ?? []).length,
    succeededToday:    succeeded,
    failedToday:       failed,
    pending:           count(outstanding as { status: string }[], 'pending'),
    awaitingApproval:  count(outstanding as { status: string }[], 'awaiting_approval'),
    successRate:       finished > 0 ? Math.round((succeeded / finished) * 100) : null,
  }
}

/**
 * Approves a held execution and runs it.
 *
 * The approval gate exists so an owner decides before anything reaches a
 * guest; approving is therefore the moment the actions actually happen.
 */
export async function approveExecution(
  venueId: string,
  id: string
): Promise<AutomationResult<Execution>> {
  const execution = await getExecution(venueId, id)
  if (!execution) return { ok: false, reason: 'not_found', message: 'Execution not found' }
  if (execution.status !== 'awaiting_approval') {
    return { ok: false, reason: 'invalid', message: `This execution is ${execution.status}, not awaiting approval.` }
  }

  const { resumeExecution } = await import('./executor')
  const finished = await resumeExecution(execution)
  return finished
    ? { ok: true, data: finished }
    : { ok: false, reason: 'failed', message: 'Could not run the approved execution' }
}

export async function cancelExecution(
  venueId: string,
  id: string
): Promise<AutomationResult<true>> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('automation_executions')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('venue_id', venueId)
    .eq('id', id)
    .in('status', ['pending', 'awaiting_approval'])

  if (error) return { ok: false, reason: 'failed', message: error.message }
  return { ok: true, data: true }
}
