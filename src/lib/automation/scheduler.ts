/**
 * Scheduler.
 *
 * Two responsibilities, deliberately separated: deciding *when* a workflow
 * should run, and draining work that has become due. Neither depends on how
 * the drain is invoked — today a cron route calls it; tomorrow pg_cron or a
 * queue worker can, and no workflow definition changes.
 *
 * There is no external scheduler and no polling loop inside the app.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { Execution, Schedule } from './types'
import { toExecution } from './history'
import { resumeExecution } from './executor'

/**
 * When this schedule should fire, or null to run immediately inline.
 *
 * Recurring schedules are stored and reported but not yet placed on a timer —
 * they need a runner that owns the recurrence cursor, which is a Phase 2
 * concern. Returning null would make them fire on every event, which is worse
 * than not firing at all, so they defer by their first interval instead.
 */
export function resolveRunAt(schedule: Schedule | undefined, now = Date.now()): string | null {
  if (!schedule || schedule.kind === 'immediate') return null

  switch (schedule.kind) {
    case 'delayed': {
      const minutes = Number(schedule.delayMinutes)
      if (!Number.isFinite(minutes) || minutes <= 0) return null
      return new Date(now + minutes * 60_000).toISOString()
    }
    case 'at': {
      if (!schedule.runAt) return null
      const at = Date.parse(schedule.runAt)
      if (Number.isNaN(at)) return null
      // A time already past runs on the next drain rather than never.
      return new Date(Math.max(at, now)).toISOString()
    }
    case 'recurring':
      // Held until a recurrence runner exists; see the note above.
      return new Date(now + 24 * 60 * 60_000).toISOString()
  }
}

/** Human-readable description, for the builder's review step. */
export function describeSchedule(schedule: Schedule | undefined): string {
  if (!schedule || schedule.kind === 'immediate') return 'Runs immediately'
  switch (schedule.kind) {
    case 'delayed': {
      const m = Number(schedule.delayMinutes) || 0
      const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
      if (m < 60) return `Runs ${unit(m, 'minute')} after the trigger`
      if (m < 1440) return `Runs ${unit(Math.round(m / 60), 'hour')} after the trigger`
      return `Runs ${unit(Math.round(m / 1440), 'day')} after the trigger`
    }
    case 'at':
      return schedule.runAt
        ? `Runs at ${new Date(schedule.runAt).toLocaleString('en-GB')}`
        : 'Runs at a fixed time'
    case 'recurring':
      return `Repeats on schedule (${schedule.cron ?? 'not set'}) — not yet executed automatically`
  }
}

/** Executions that are due. Oldest first, so a backlog drains in order. */
export async function dueExecutions(limit = 50): Promise<Execution[]> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('automation_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[automation] dueExecutions failed:', error.message)
    return []
  }
  return (data ?? []).map(r => toExecution(r as Record<string, unknown>))
}

export interface DrainResult {
  due: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Runs everything that has become due.
 *
 * Each execution is isolated: one that throws is recorded and the drain
 * continues. A single bad workflow must not stop every other venue's
 * scheduled work — the same failure mode that took down the daily cron.
 */
export async function drain(limit = 50): Promise<DrainResult> {
  const due = await dueExecutions(limit)
  const result: DrainResult = { due: due.length, succeeded: 0, failed: 0, skipped: 0 }

  for (const execution of due) {
    try {
      const finished = await resumeExecution(execution)
      if (!finished) { result.failed++; continue }
      if (finished.status === 'success') result.succeeded++
      else if (finished.status === 'skipped') result.skipped++
      else result.failed++
    } catch (err) {
      console.error(`[automation] execution ${execution.id} threw during drain:`, err)
      await markFailed(execution.id, err instanceof Error ? err.message : String(err))
      result.failed++
    }
  }

  return result
}

async function markFailed(executionId: string, error: string): Promise<void> {
  const supabase = await createAdminClient()
  const { error: writeError } = await supabase
    .from('automation_executions')
    .update({ status: 'failed', error, completed_at: new Date().toISOString() })
    .eq('id', executionId)
  if (writeError) console.error('[automation] could not mark execution failed:', writeError.message)
}
