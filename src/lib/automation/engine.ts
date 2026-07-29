/**
 * Engine — the dispatch pipeline.
 *
 *   Event → Trigger → Workflow → Conditions → Actions → Execution → Logging
 *
 * Every automation in the platform runs through this one path. There are no
 * special-case automations, and this file imports nothing from any product or
 * industry module: it matches opaque event names against stored workflows.
 *
 * Immediate work runs inline. Delayed and scheduled work becomes a pending
 * execution for the scheduler to drain, so a guest-facing request never waits
 * on an automation that was meant to happen tomorrow.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { AutomationEvent, DispatchSummary, EvaluationContext } from './types'
import { workflowsListeningFor } from './workflow'
import { triggerMatches } from './triggers'
import { buildContext } from './conditions'
import { runWorkflow } from './executor'
import { resolveRunAt } from './scheduler'
import { toExecution } from './history'

/**
 * Runs every active workflow listening for this event.
 *
 * Never throws. Automation is downstream of the thing that emitted the event,
 * and must not be able to break it.
 */
export async function dispatch(event: AutomationEvent): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    event: event.name, matched: 0, executed: 0, skipped: 0,
    scheduled: 0, failed: 0, executionIds: [],
  }

  const listening = await workflowsListeningFor(event.venueId, event.name)
  const matched = listening.filter(w => triggerMatches(w.triggerEvent, w.triggerConfig, event))
  summary.matched = matched.length
  if (!matched.length) return summary

  // One context serves every workflow reacting to this event — the guest and
  // member lookups happen once regardless of how many workflows match.
  let context: EvaluationContext
  try {
    context = await buildContext(event)
  } catch (err) {
    console.error('[automation] dispatch could not build context:', err)
    return summary
  }

  for (const workflow of matched) {
    try {
      const runAt = resolveRunAt(workflow.schedule)

      // Deferred: record the intent now, act later.
      if (runAt) {
        const id = await enqueue(event, workflow.id, runAt, workflow.dryRun)
        if (id) { summary.scheduled++; summary.executionIds.push(id) }
        continue
      }

      const execution = await runWorkflow(workflow, event, { context })
      if (!execution) { summary.failed++; continue }

      summary.executionIds.push(execution.id)
      if (execution.status === 'success') summary.executed++
      else if (execution.status === 'skipped') summary.skipped++
      else if (execution.status === 'awaiting_approval') summary.scheduled++
      else summary.failed++
    } catch (err) {
      console.error(`[automation] workflow ${workflow.id} threw during dispatch:`, err)
      summary.failed++
    }
  }

  return summary
}

/** Writes a pending execution for the scheduler to pick up. */
async function enqueue(
  event: AutomationEvent,
  workflowId: string,
  runAt: string,
  dryRun: boolean
): Promise<string | null> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_executions')
    .insert({
      venue_id: event.venueId,
      workflow_id: workflowId,
      event_name: event.name,
      event_payload: event.payload as never,
      target_guest_id: event.guestId ?? null,
      status: 'pending',
      scheduled_for: runAt,
      dry_run: dryRun,
      // Both are NOT NULL. A queued execution has evaluated nothing yet, so
      // they start empty and are filled in when the scheduler runs it.
      conditions_evaluated: [] as never,
      actions_executed: [] as never,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[automation] could not enqueue execution:', error.message)
    return null
  }
  return String(data.id)
}

/**
 * Runs a workflow against a synthetic event without persisting side effects.
 *
 * This is the builder's test button: it forces dry run, so actions resolve
 * their configuration and report exactly what they would have done. The
 * execution is still recorded — a test that leaves no trace is hard to debug.
 */
export async function testWorkflow(params: {
  venueId: string
  workflowId: string
  guestId?: string | null
  payload?: Record<string, unknown>
}) {
  const { getWorkflow } = await import('./workflow')
  const workflow = await getWorkflow(params.venueId, params.workflowId)
  if (!workflow) {
    return { ok: false as const, reason: 'not_found' as const, message: 'Workflow not found' }
  }

  const event: AutomationEvent = {
    name: workflow.triggerEvent,
    venueId: params.venueId,
    guestId: params.guestId ?? null,
    payload: params.payload ?? {},
    occurredAt: new Date().toISOString(),
  }

  const execution = await runWorkflow(workflow, event, { forceDryRun: true })
  return execution
    ? { ok: true as const, data: execution }
    : { ok: false as const, reason: 'failed' as const, message: 'Test run produced no execution record' }
}

export { toExecution }
