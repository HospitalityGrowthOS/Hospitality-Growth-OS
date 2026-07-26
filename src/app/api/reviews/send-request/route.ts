/**
 * Review automation dispatcher.
 *
 * Polled every 5 minutes by pg_cron (see supabase/review_automation.sql).
 * Sends the approved `review_request` template for every pending request whose
 * 45-minute delay has elapsed.
 *
 * Business-initiated messages must use an approved template — a free-form or
 * interactive message would be rejected, since the guest has not messaged us
 * within the last 24 hours.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendReviewRequest } from '@/lib/whatsapp-send'

const BATCH_LIMIT = 50

function authorized(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const now = new Date().toISOString()

  const { data: requests, error } = await supabase
    .from('review_requests')
    .select('id, venue_id, guest_id, guest_name, guest_phone')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(BATCH_LIMIT)

  if (error) {
    console.error('[review-dispatch] query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!requests?.length) return NextResponse.json({ sent: 0, skipped: 0 })

  // Resolve guests and venues in two batched lookups. Embedded joins aren't
  // usable here — review_requests has no foreign key to guests.
  const guestIds = [...new Set(requests.map(r => r.guest_id).filter(Boolean))] as string[]
  const venueIds = [...new Set(requests.map(r => r.venue_id).filter(Boolean))] as string[]

  const [{ data: guestRows }, { data: venueRows }] = await Promise.all([
    guestIds.length
      ? supabase.from('guests').select('id, name, phone, whatsapp_opted_in').in('id', guestIds)
      : Promise.resolve({ data: [] as { id: string; name?: string; phone?: string; whatsapp_opted_in?: boolean }[] }),
    venueIds.length
      ? supabase.from('venues').select('id, name').in('id', venueIds)
      : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
  ])

  const guestsById = new Map((guestRows ?? []).map(g => [g.id, g]))
  const venuesById = new Map((venueRows ?? []).map(v => [v.id, v]))

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const request of requests) {
    const guest = request.guest_id ? guestsById.get(request.guest_id) : undefined
    const venue = venuesById.get(request.venue_id)

    // Fall back to the denormalized fields when there is no linked guest row.
    const phone = guest?.phone ?? request.guest_phone
    const name  = guest?.name  ?? request.guest_name ?? 'there'

    // Respect opt-out. Only an explicit false blocks the send; a missing guest
    // row means the request carried its own contact details.
    if (!phone || guest?.whatsapp_opted_in === false) {
      await supabase
        .from('review_requests')
        .update({ status: 'opted_out' })
        .eq('id', request.id)
      skipped++
      continue
    }

    const result = await sendReviewRequest({
      phone,
      guestName: name,
      venueName: venue?.name ?? 'our venue',
      requestId: request.id,
      venueId:   request.venue_id,
      guestId:   request.guest_id ?? undefined,
    })

    if (result.ok) {
      await supabase
        .from('review_requests')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', request.id)
      sent++
    } else {
      // Leave status pending so the next run retries transient failures.
      console.error(`[review-dispatch] send failed for ${request.id}:`, result.error)
      failed++
    }
  }

  return NextResponse.json({ processed: requests.length, sent, skipped, failed })
}

// Health check / manual trigger
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
