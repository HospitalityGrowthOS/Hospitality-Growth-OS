/**
 * Executor — runs one workflow against one event.
 *
 * This is where the audit log is written. Every execution records the event,
 * every condition with the value actually observed, every action with what it
 * did or would have done, the duration, and any error. An execution row is
 * created *before* actions run, so a crash mid-run leaves evidence rather than
 * silence.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { tryWrite } from '@/lib/db'
import type {
  ActionResult, AutomationEvent, ConditionResult, EvaluationContext,
  Execution, ExecutionStatus, Workflow,
} from './types'
import { buildContext, evaluateConditions } from './conditions'
import { runAction } from './actions'
import { recordWorkflowRun } from './workflow'
import { toExecution } from './history'

interface RunOptions {
  /** Forces dry run regardless of the workflow's own setting. */
  forceDryRun?: boolean
  /** Reuses a context already built for another workflow in the same dispatch. */
  context?: EvaluationContext
  /** Resumes an execution that was previously created (approval, retry, drain). */
  executionId?: string
}

/**
 * Evaluates conditions and, if they pass, runs the actions.
 *
 * Returns the finished execution. Never throws: a failure inside a workflow is
 * data, not an exception — the caller is usually a guest-facing request that
 * must not 500 because an automation misbehaved.
 */
export async function runWorkflow(
  workflow: Workflow,
  event: AutomationEvent,
  options: RunOptions = {}
): Promise<Execution | null> {
  const supabase = await createAdminClient()
  const startedAt = Date.now()
  const dryRun = options.forceDryRun || workflow.dryRun

  let context: EvaluationContext
  try {
    context = options.context ?? await buildContext(event)
  } catch (err) {
    console.error('[automation] could not build context:', err)
    return null
  }

  const { passed, results } = evaluateConditions(workflow.conditions, context)

  // Conditions failed: record the skip and stop. Recording rather than
  // discarding is what lets an owner see *why* a workflow did nothing.
  if (!passed) {
    return await finalise(supabase, {
      execution: options.executionId,
      workflow, event, dryRun,
      status: 'skipped',
      conditions: results,
      actions: [],
      error: null,
      startedAt,
    })
  }

  // Approval gate: everything is evaluated, nothing is performed, and the
  // execution waits for a person.
  if (workflow.requiresApproval && !options.executionId) {
    return await finalise(supabase, {
      execution: undefined,
      workflow, event, dryRun,
      status: 'awaiting_approval',
      conditions: results,
      actions: [],
      error: null,
      startedAt,
    })
  }

  const actionResults: ActionResult[] = []
  let error: string | null = null

  for (const action of workflow.actions) {
    const result = await runAction(action, {
      context,
      venueId: event.venueId,
      guestId: event.guestId ?? null,
      dryRun,
    })
    actionResults.push(result)
    if (result.outcome === 'failed') {
      // Record and keep going. One failed message must not cancel a points
      // award that was also configured — the same lesson as the daily cron.
      error = error ?? `${result.type}: ${result.error ?? result.detail}`
    }
  }

  const anyFailed = actionResults.some(r => r.outcome === 'failed')
  const execution = await finalise(supabase, {
    execution: options.executionId,
    workflow, event, dryRun,
    status: anyFailed ? 'failed' : 'success',
    conditions: results,
    actions: actionResults,
    error,
    startedAt,
  })

  if (!dryRun) await recordWorkflowRun(workflow.id, workflow.executionCount)
  return execution
}

/** Writes (or updates) the execution row and returns the domain object. */
async function finalise(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  params: {
    execution?: string
    workflow: Workflow
    event: AutomationEvent
    dryRun: boolean
    status: ExecutionStatus
    conditions: ConditionResult[]
    actions: ActionResult[]
    error: string | null
    startedAt: number
  }
): Promise<Execution | null> {
  const completedAt = new Date().toISOString()
  const row = {
    status: params.status,
    conditions_evaluated: params.conditions as never,
    actions_executed: params.actions as never,
    error: params.error,
    started_at: new Date(params.startedAt).toISOString(),
    completed_at: completedAt,
    duration_ms: Date.now() - params.startedAt,
  }

  if (params.execution) {
    const { data, error } = await supabase
      .from('automation_executions')
      .update(row)
      .eq('id', params.execution)
      .select()
      .single()
    if (error) { console.error('[automation] execution update failed:', error.message); return null }
    return toExecution(data as Record<string, unknown>)
  }

  const { data, error } = await supabase
    .from('automation_executions')
    .insert({
      venue_id: params.event.venueId,
      workflow_id: params.workflow.id,
      event_name: params.event.name,
      event_payload: params.event.payload as never,
      target_guest_id: params.event.guestId ?? null,
      target_channel: channelOf(params.actions),
      dry_run: params.dryRun,
      ...row,
    })
    .select()
    .single()

  if (error) { console.error('[automation] execution insert failed:', error.message); return null }
  return toExecution(data as Record<string, unknown>)
}

/** The channel actually used, for the history view. */
function channelOf(actions: ActionResult[]): string | null {
  const sent = actions.find(a => a.type === 'send_whatsapp' && a.outcome === 'executed')
  if (sent) return 'whatsapp'
  const attempted = actions.find(a => a.type === 'send_whatsapp')
  return attempted ? 'whatsapp' : null
}

/**
 * Runs an execution that already exists — used by the approval flow, the
 * scheduler drain and retries.
 */
export async function resumeExecution(execution: Execution): Promise<Execution | null> {
  const supabase = await createAdminClient()
  const { data: row } = await supabase
    .from('automation_workflows')
    .select('*')
    .eq('id', execution.workflowId)
    .maybeSingle()

  if (!row) {
    console.error('[automation] cannot resume: workflow is gone')
    return null
  }

  const { getWorkflow } = await import('./workflow')
  const workflow = await getWorkflow(execution.venueId, execution.workflowId)
  if (!workflow) return null

  // Marking it running is bookkeeping — if it fails the run should still
  // proceed, but a lost transition must not be invisible.
  await tryWrite('automation: mark running', supabase.from('automation_executions')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', execution.id))

  return runWorkflow(
    workflow,
    {
      name: execution.eventName as `${string}.${string}`,
      venueId: execution.venueId,
      guestId: execution.targetGuestId,
      payload: execution.eventPayload,
      occurredAt: execution.createdAt,
    },
    { executionId: execution.id }
  )
}
