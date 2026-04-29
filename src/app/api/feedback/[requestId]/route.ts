import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
})

// GET /api/feedback/[requestId] — returns request + venue info for the public page
export async function GET(
  _request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('review_requests')
      .select('id, status, guest_name, venue_id')
      .eq('id', params.requestId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (data.status !== 'pending') {
      return NextResponse.json(
        { error: 'already_completed', status: data.status },
        { status: 409 }
      )
    }

    // Get venue name separately
    const { data: venue } = await admin
      .from('venues')
      .select('name')
      .eq('id', data.venue_id)
      .single()

    return NextResponse.json({
      id: data.id,
      guest_name: data.guest_name,
      venue_name: venue?.name || 'our venue',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/feedback/[requestId] — submits feedback
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const body = await request.json()
    const parsed = FeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { rating, feedback } = parsed.data
    const status = rating >= 4 ? 'positive' : 'negative'

    const admin = await createAdminClient()

    // Check request exists and is pending
    const { data: existing } = await admin
      .from('review_requests')
      .select('id, status, venue_id')
      .eq('id', params.requestId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'already_completed', status: existing.status },
        { status: 409 }
      )
    }

    const { error } = await admin
      .from('review_requests')
      .update({
        rating,
        feedback: feedback || null,
        status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.requestId)

    if (error) {
      console.error('[feedback] update error:', error)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    // TODO: Trigger n8n for follow-up campaign
    // if (status === 'positive') trigger Google review follow-up
    // if (status === 'negative') trigger internal alert

    return NextResponse.json({ success: true, status, rating })
  } catch (e) {
    console.error('[feedback] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
