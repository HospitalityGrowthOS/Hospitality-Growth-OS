import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
})

/**
 * A request is still open for feedback while it is queued or delivered.
 * Anything else (positive / negative / opted_out) has already been answered.
 */
const OPEN_STATUSES = new Set(['pending', 'sent'])

/** Ratings at or above this go to Google; below it stay private. */
const PUBLIC_REVIEW_THRESHOLD = 4

// GET /api/feedback/[requestId] — request + venue info for the public page
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

    if (!OPEN_STATUSES.has(data.status)) {
      return NextResponse.json(
        { error: 'already_completed', status: data.status },
        { status: 409 }
      )
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/feedback/[requestId] — submits feedback and routes the outcome
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const parsed = FeedbackSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { rating, feedback } = parsed.data
    const isPositive = rating >= PUBLIC_REVIEW_THRESHOLD
    const status = isPositive ? 'positive' : 'negative'

    const admin = await createAdminClient()

    const { data: existing } = await admin
      .from('review_requests')
      .select('id, status, venue_id, guest_id, guest_name')
      .eq('id', params.requestId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (!OPEN_STATUSES.has(existing.status)) {
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

    const { data: venue } = await admin
      .from('venues')
      .select('name, settings')
      .eq('id', existing.venue_id)
      .single()

    // Happy guest → hand them the public review link.
    if (isPositive) {
      const settings = (venue?.settings || {}) as Record<string, unknown>
      const googleReviewUrl = (settings.google_review_url as string) || null
      return NextResponse.json({ success: true, status, rating, google_review_url: googleReviewUrl })
    }

    // Unhappy guest → keep it private and put it in front of the owner.
    const guestLabel = existing.guest_name || 'A guest'
    await admin.from('action_items').insert({
      venue_id:     existing.venue_id,
      title:        `${rating}★ feedback needs a response`,
      description:  feedback
        ? `${guestLabel} rated ${rating}/5: "${feedback.slice(0, 300)}"`
        : `${guestLabel} rated ${rating}/5 without leaving a comment.`,
      type:         'negative_feedback',
      priority:     rating <= 2 ? 'high' : 'medium',
      status:       'pending',
      related_id:   params.requestId,
      related_type: 'review_request',
    })

    return NextResponse.json({ success: true, status, rating })
  } catch (e) {
    console.error('[feedback] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
