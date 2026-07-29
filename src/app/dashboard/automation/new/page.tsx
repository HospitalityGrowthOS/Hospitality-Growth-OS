export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import { triggersByCategory, CONDITION_FIELDS, ACTIONS } from '@/lib/automation'
import WorkflowBuilder from '../WorkflowBuilder'

export default async function NewWorkflowPage() {
  const venue = await getCurrentVenue()
  if (!venue) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-mid">No venue is linked to your account yet.</p></div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="font-display text-[18px] font-semibold text-ink">New workflow</h1>
        <p className="text-[13px] text-mid mt-0.5">Listen for something, check a few conditions, then act.</p>
      </div>
      <WorkflowBuilder
        triggers={triggersByCategory()}
        fields={CONDITION_FIELDS}
        actions={ACTIONS}
      />
    </div>
  )
}
