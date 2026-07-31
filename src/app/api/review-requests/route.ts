import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { tryWrite } from '@/lib/db'
import { resolveChannel } from '@/lib/channels'
import { sendReviewRequestEmail } from '@/lib/email'
import { z } from 'zod'
import { sendReviewRequest } from '@/lib/whatsapp-send'

/**
 * Manual review request management.
 *
 * Originally built to be called by n8n, and therefore unauthenticated with
 * `venue_id` taken from the request. That was a hole in two directions:
 * venue ids are public — they appear in QR signup URLs — so anyone could send
 * WhatsApp messages using a venue's own credentials, risking that venue's
 * number being banned; and the GET returned every review request for any
 * venue, guest names and phone numbers included.
 *
 * The platform owns its workflow engine now and nothing calls these endpoints
 * internally. Both handlers require an owner session and derive the venue from
 * it; a `venue_id` in the request is ignored.
 */

const CreateRequestSchema = z.object({
  // Accepted for backwards compatibility, never trusted.
  venue_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
  guest_name: z.string().min(1).optional(),
  guest_phone: z.string().min(1).optional(),
  guest_email: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = CreateRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { guest_id, guest_name, guest_phone, guest_email } = parsed.data

    const admin = await createAdminClient()

    let resolvedName = guest_name
    let resolvedPhone = guest_phone
    let resolvedEmail = guest_email

    if (guest_id) {
      const { data: guest } = await admin
        .from('guests')
        .select('name, phone, email')
        .eq('id', guest_id)
        .eq('venue_id', venue.id)   // never resolve a guest across venues
        .maybeSingle()

      if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
      resolvedName = resolvedName || guest.name || undefined
      resolvedPhone = resolvedPhone || guest.phone || undefined
      resolvedEmail = resolvedEmail || guest.email || undefined
    }

    const { data: reviewRequest, error } = await admin
      .from('review_requests')
      .insert({
        venue_id: venue.id,
        guest_id: guest_id || null,
        guest_name: resolvedName || null,
        guest_phone: resolvedPhone || null,
        // Carried on the row so the dispatcher can reach a guest who has no
        // `guests` record, exactly as guest_phone already allows for WhatsApp.
        guest_email: resolvedEmail || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error || !reviewRequest) {
      console.error('[review-requests] insert error:', error?.message)
      return NextResponse.json({ error: 'Could not create request' }, { status: 500 })
    }

    // Manual send goes out immediately. scheduled_for stays NULL so the
    // 45-minute dispatcher never picks this up a second time.
    //
    // Routed the same way the dispatcher routes, rather than assuming WhatsApp:
    // this path used to send nothing at all for a guest who only had an email.
    const channel = resolveChannel({ phone: resolvedPhone, email: resolvedEmail })

    if (channel) {
      const result = channel === 'whatsapp'
        ? await sendReviewRequest({
            phone:     resolvedPhone!,
            guestName: resolvedName || 'Guest',
            venueName: venue.name,
            requestId: reviewRequest.id,
            venueId:   venue.id,
            guestId:   guest_id,
          })
        : await sendReviewRequestEmail({
            to:        resolvedEmail!,
            guestName: resolvedName,
            venueName: venue.name,
            requestId: reviewRequest.id,
            venueId:   venue.id,
          })

      // A stub means nothing was sent — leave it pending rather than claim a
      // delivery that did not happen.
      if (!result.stub) {
        await tryWrite('review-requests: record send outcome', admin
          .from('review_requests')
          .update(result.ok
            ? { status: 'sent', sent_at: new Date().toISOString(), channel }
            : { status: 'failed' })
          .eq('id', reviewRequest.id))
      }
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

export async function GET() {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('review_requests')
      .select('*')
      .eq('venue_id', venue.id)   // scoped to the caller's own venue
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[review-requests] GET failed:', error.message)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }
    return NextResponse.json({ requests: data })
  } catch (e) {
    console.error('[review-requests] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
