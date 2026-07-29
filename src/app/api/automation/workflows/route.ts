import { NextRequest, NextResponse } from 'next/server'
import { getCurrentVenue } from '@/lib/venue'
import { listWorkflows, createWorkflow } from '@/lib/automation'
import type { WorkflowInput } from '@/lib/automation'

export async function GET() {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ workflows: await listWorkflows(venue.id) })
}

export async function POST(req: NextRequest) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const input = (await req.json()) as WorkflowInput
    const result = await createWorkflow(venue.id, input)
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.reason === 'invalid' ? 400 : 500 })
    }
    return NextResponse.json({ workflow: result.data }, { status: 201 })
  } catch (err) {
    console.error('[automation/workflows] POST failed:', err)
    return NextResponse.json({ error: 'Could not create workflow' }, { status: 500 })
  }
}
