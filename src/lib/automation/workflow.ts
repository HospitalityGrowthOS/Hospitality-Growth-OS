/**
 * Workflow persistence.
 *
 * Maps between the database row (snake_case, JSONB columns) and the domain
 * type. Nothing else in the engine touches the workflows table, so a schema
 * change lands here and nowhere else.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { mustWrite } from '@/lib/db'
import type {
  Action, AutomationResult, Condition, EventName, RetryPolicy,
  Schedule, Workflow, WorkflowInput, WorkflowStatus,
} from './types'
import { validateWorkflow } from './validation'

type Row = Record<string, unknown>

function toWorkflow(row: Row): Workflow {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    name: String(row.name),
    description: (row.description as string) ?? null,
    status: row.status as WorkflowStatus,
    triggerEvent: row.trigger_event as EventName,
    triggerConfig: (row.trigger_config as Record<string, unknown>) ?? {},
    conditions: (row.conditions as Condition[]) ?? [],
    actions: (row.actions as Action[]) ?? [],
    schedule: (row.schedule as Schedule) ?? { kind: 'immediate' },
    dryRun: Boolean(row.dry_run),
    requiresApproval: Boolean(row.requires_approval),
    retryPolicy: (row.retry_policy as RetryPolicy) ?? { maxAttempts: 1 },
    templateKey: (row.template_key as string) ?? null,
    lastExecutedAt: (row.last_executed_at as string) ?? null,
    executionCount: Number(row.execution_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toRow(input: WorkflowInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? 'draft',
    trigger_event: input.triggerEvent,
    trigger_config: (input.triggerConfig ?? {}) as never,
    conditions: (input.conditions ?? []) as never,
    actions: (input.actions ?? []) as never,
    schedule: (input.schedule ?? { kind: 'immediate' }) as never,
    dry_run: input.dryRun ?? false,
    requires_approval: input.requiresApproval ?? false,
    retry_policy: (input.retryPolicy ?? { maxAttempts: 1 }) as never,
    template_key: input.templateKey ?? null,
  }
}

export async function listWorkflows(venueId: string): Promise<Workflow[]> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[automation] listWorkflows failed:', error.message)
    return []
  }
  return (data ?? []).map(r => toWorkflow(r as Row))
}

export async function getWorkflow(venueId: string, id: string): Promise<Workflow | null> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .select('*')
    .eq('venue_id', venueId)   // never resolve a workflow across venues
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return toWorkflow(data as Row)
}

/**
 * Active workflows listening for an event.
 *
 * The dispatch hot path — indexed on (venue_id, trigger_event, status).
 * Draft and disabled workflows are invisible here, which is what makes the
 * enable/disable switch meaningful.
 */
export async function workflowsListeningFor(
  venueId: string,
  event: EventName
): Promise<Workflow[]> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .select('*')
    .eq('venue_id', venueId)
    .eq('trigger_event', event)
    .eq('status', 'active')

  if (error) {
    console.error('[automation] workflowsListeningFor failed:', error.message)
    return []
  }
  return (data ?? []).map(r => toWorkflow(r as Row))
}

export async function createWorkflow(
  venueId: string,
  input: WorkflowInput
): Promise<AutomationResult<Workflow>> {
  const problems = validateWorkflow(input)
  if (problems.length) {
    return { ok: false, reason: 'invalid', message: problems.join(' ') }
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .insert({ venue_id: venueId, ...toRow(input) })
    .select()
    .single()

  if (error || !data) {
    return { ok: false, reason: 'failed', message: error?.message ?? 'Could not create workflow' }
  }
  return { ok: true, data: toWorkflow(data as Row) }
}

export async function updateWorkflow(
  venueId: string,
  id: string,
  input: WorkflowInput
): Promise<AutomationResult<Workflow>> {
  const problems = validateWorkflow(input)
  if (problems.length) {
    return { ok: false, reason: 'invalid', message: problems.join(' ') }
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .update(toRow(input))
    .eq('venue_id', venueId)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return { ok: false, reason: 'not_found', message: error?.message ?? 'Workflow not found' }
  }
  return { ok: true, data: toWorkflow(data as Row) }
}

/**
 * Changes status only.
 *
 * A workflow may not be activated unless it would validate — otherwise an
 * owner can switch on something that silently fails on every event.
 */
export async function setWorkflowStatus(
  venueId: string,
  id: string,
  status: WorkflowStatus
): Promise<AutomationResult<Workflow>> {
  const existing = await getWorkflow(venueId, id)
  if (!existing) return { ok: false, reason: 'not_found', message: 'Workflow not found' }

  if (status === 'active') {
    const problems = validateWorkflow({
      name: existing.name,
      triggerEvent: existing.triggerEvent,
      conditions: existing.conditions,
      actions: existing.actions,
      schedule: existing.schedule,
    })
    if (problems.length) {
      return { ok: false, reason: 'invalid', message: `Cannot activate: ${problems.join(' ')}` }
    }
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_workflows')
    .update({ status })
    .eq('venue_id', venueId)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return { ok: false, reason: 'failed', message: error?.message ?? 'Could not change status' }
  }
  return { ok: true, data: toWorkflow(data as Row) }
}

export async function deleteWorkflow(venueId: string, id: string): Promise<AutomationResult<true>> {
  const supabase = await createAdminClient()
  try {
    await mustWrite('automation: delete workflow', supabase
      .from('automation_workflows').delete().eq('venue_id', venueId).eq('id', id))
    return { ok: true, data: true }
  } catch (err) {
    return { ok: false, reason: 'failed', message: err instanceof Error ? err.message : String(err) }
  }
}

/** Bookkeeping after a run. Best-effort: never fails an execution. */
export async function recordWorkflowRun(workflowId: string, count: number): Promise<void> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('automation_workflows')
    .update({ last_executed_at: new Date().toISOString(), execution_count: count + 1 })
    .eq('id', workflowId)
  if (error) console.error('[automation] recordWorkflowRun failed:', error.message)
}
