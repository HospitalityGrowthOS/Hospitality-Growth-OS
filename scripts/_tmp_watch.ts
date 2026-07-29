import { createAdminClient } from '../src/lib/supabase/server'
async function main() {
  const db = await createAdminClient()
  const { data } = await db.from('automation_executions')
    .select('status, completed_at, actions_executed')
    .eq('id', 'f4b647d6-b97a-4958-9c6e-c1807b9a92de').single()
  console.log(JSON.stringify({ status: data?.status, completed: data?.completed_at }))
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
