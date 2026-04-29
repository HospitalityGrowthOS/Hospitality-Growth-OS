import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sendReviewRequest } from '@/lib/twilio'

const CreateRequestSchema = z.object({
  venue_id: z.string().uuid(),
  guest_id: z.string().uuid().optional(),
  guest_name: z.string().min(1).optional(),
  guest_phone: z.string().min(1).optional(),
})

// POST /api/review-requests
// Creates a review request. Called by n8n or dashboard.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = CreateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { venue_id, guest_id, guest_name, guest_phone } = parsed.data

    const admin = await createAdminClient()

    // Verify venue exists
    const { data: venue } = await admin
      .from('venues')
      .select('id, name')
      .eq('id', venue_id)
      .single()

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // If guest_id provided, pull guest info
    let resolvedName = guest_name
    let resolvedPhone = guest_phone

    if (guest_id && (!resolvedName || !resolvedPhone)) {
      const { data: guest } = await admin
        .from('guests')
        .select('name, phone')
        .eq('id', guest_id)
        .single()

      if (guest) {
        resolvedName = resolvedName || guest.name
        resolvedPhone = resolvedPhone || guest.phone
      }
    }

    const { data: reviewRequest, error } = await admin
      .from('review_requests')
      .insert({
        venue_id,
        guest_id: guest_id || null,
        guest_name: resolvedName || null,
        guest_phone: resolvedPhone || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[review-requests] insert error:', error)
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 })
    }

    // Send WhatsApp review request — fire-and-forget
    if (resolvedPhone) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      sendReviewRequest({
        phone:       resolvedPhone,
        guestName:   resolvedName || 'Guest',
        venueName:   venue.name,
        feedbackUrl: `${appUrl}/feedback/${reviewRequest.id}`,
        venueId:     venue_id,
        guestId:     guest_id,
      }).catch(err => console.error('[review-requests] WhatsApp error:', err))
    }

    return NextResponse.json({
      success: true,
      review_request: reviewRequest,
      feedback_url: `/feedback/${reviewRequest.id}`,
    }, { status: 201 })

  } catch (e) {
    console.error('[review-requests] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/review-requests?venue_id=xxx
// Returns all requests for a venue (used by dashboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const venue_id = searchParams.get('venue_id')

    if (!venue_id) {
      return NextResponse.json({ error: 'venue_id required' }, { status: 400 })
    }

    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('review_requests')
      .select('*')
      .eq('venue_id', venue_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    return NextResponse.json({ requests: data })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
