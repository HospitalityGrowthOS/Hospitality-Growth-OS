import { NextRequest, NextResponse } from 'next/server'
import { getCurrentVenue } from '@/lib/venue'
import { getWorkflow, updateWorkflow, setWorkflowStatus, deleteWorkflow } from '@/lib/automation'
import type { WorkflowInput, WorkflowStatus } from '@/lib/automation'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const workflow = await getWorkflow(venue.id, params.id)
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ workflow })
}

/** Accepts either a status change on its own, or a full workflow update. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const result = body.status && Object.keys(body).length === 1
      ? await setWorkflowStatus(venue.id, params.id, body.status as WorkflowStatus)
      : await updateWorkflow(venue.id, params.id, body as WorkflowInput)

    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : result.reason === 'invalid' ? 400 : 500
      return NextResponse.json({ error: result.message }, { status })
    }
    return NextResponse.json({ workflow: result.data })
  } catch (err) {
    console.error('[automation/workflows/:id] PATCH failed:', err)
    return NextResponse.json({ error: 'Could not update workflow' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await deleteWorkflow(venue.id, params.id)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
