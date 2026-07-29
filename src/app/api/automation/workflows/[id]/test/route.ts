import { NextRequest, NextResponse } from 'next/server'
import { getCurrentVenue } from '@/lib/venue'
import { testWorkflow } from '@/lib/automation'

/**
 * Runs a workflow against a synthetic event in dry-run mode. Nothing reaches
 * a guest; the resolved configuration is returned so the owner can see exactly
 * what would have happened.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const result = await testWorkflow({
      venueId: venue.id,
      workflowId: params.id,
      guestId: body.guest_id ?? null,
      payload: body.payload ?? {},
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.reason === 'not_found' ? 404 : 500 })
    }
    return NextResponse.json({ execution: result.data })
  } catch (err) {
    console.error('[automation/test] failed:', err)
    return NextResponse.json({ error: 'Test run failed' }, { status: 500 })
  }
}
