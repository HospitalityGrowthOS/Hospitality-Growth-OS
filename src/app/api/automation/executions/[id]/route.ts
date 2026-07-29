import { NextRequest, NextResponse } from 'next/server'
import { getCurrentVenue } from '@/lib/venue'
import { approveExecution, cancelExecution, getExecution } from '@/lib/automation'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const execution = await getExecution(venue.id, params.id)
  if (!execution) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ execution })
}

/** `{ action: 'approve' | 'cancel' }` — the human decision on a held execution. */
export async function POST(req: NextRequest, { params }: Params) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { action } = await req.json()
    if (action === 'approve') {
      const result = await approveExecution(venue.id, params.id)
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: result.reason === 'not_found' ? 404 : 400 })
      }
      return NextResponse.json({ execution: result.data })
    }
    if (action === 'cancel') {
      const result = await cancelExecution(venue.id, params.id)
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'action must be "approve" or "cancel"' }, { status: 400 })
  } catch (err) {
    console.error('[automation/executions/:id] POST failed:', err)
    return NextResponse.json({ error: 'Could not update execution' }, { status: 500 })
  }
}
