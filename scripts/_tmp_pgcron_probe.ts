import { createAdminClient } from '../src/lib/supabase/server'
import { createWorkflow, setWorkflowStatus, emitEvent } from '../src/lib/automation'

async function main() {
  const db = await createAdminClient()
  const { data: v } = await db.from('venues').select('id').limit(1).single()

  // Dry-run workflow: even when the drain executes it, nothing real happens.
  const wf = await createWorkflow(v!.id, {
    name: 'PGCRON PROBE — safe to delete',
    triggerEvent: 'business.health.changed',
    dryRun: true,
    schedule: { kind: 'delayed', delayMinutes: 1 },
    actions: [{ type: 'notify_owner', config: { title: 'pg_cron probe' } }],
  })
  if (!wf.ok) throw new Error(wf.message)
  await setWorkflowStatus(v!.id, wf.data.id, 'active')

  const s = await emitEvent({ venueId: v!.id, name: 'business.health.changed', payload: { probe: true } })
  console.log('WORKFLOW=' + wf.data.id)
  console.log('EXECUTION=' + s!.executionIds[0])
  console.log('due at:', new Date(Date.now() + 60_000).toISOString())
}
main().then(() => process.exit(0)).catch(e => { console.error('FAILED:', e.message); process.exit(1) })
