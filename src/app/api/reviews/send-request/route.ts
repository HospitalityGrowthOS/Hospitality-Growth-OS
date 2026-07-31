/**
 * Review automation dispatcher.
 *
 * Polled every 5 minutes by pg_cron (see supabase/review_automation.sql).
 * Sends every pending request whose 45-minute delay has elapsed, over whichever
 * channel can actually reach the guest.
 *
 * WhatsApp goes as an approved template: a business-initiated free-form message
 * would be rejected, since the guest has not messaged us in the last 24 hours.
 * Email carries the same `/feedback/[requestId]` link, so a reply arrives
 * through one lifecycle no matter how it was asked for.
 *
 * This used to send WhatsApp unconditionally and ignore `review_requests.channel`
 * entirely, which left every guest who had not opted into WhatsApp unreachable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { tryWrite } from '@/lib/db'
import { sendReviewRequest } from '@/lib/whatsapp-send'
import { sendReviewRequestEmail } from '@/lib/email'
import { usableChannel } from '@/lib/channels'

const BATCH_LIMIT = 50

/**
 * A request that couldn't be delivered within this window is abandoned rather
 * than retried by the 5-minute cron forever. Age is a better cutoff than an
 * attempt counter here: a review request that is a day late is stale anyway,
 * and asking about a visit that long ago reads as careless.
 */
const MAX_AGE_HOURS = 24

function authorized(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: requests, error } = await supabase
    .from('review_requests')
    .select('id, venue_id, guest_id, guest_name, guest_phone, guest_email, channel, scheduled_for')
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
  const guestIds = Array.from(new Set(requests.map(r => r.guest_id).filter(Boolean))) as string[]
  const venueIds = Array.from(new Set(requests.map(r => r.venue_id).filter(Boolean))) as string[]

  const [{ data: guestRows }, { data: venueRows }] = await Promise.all([
    guestIds.length
      ? supabase.from('guests').select('id, name, phone, email, whatsapp_opted_in').in('id', guestIds)
      : Promise.resolve({ data: [] as { id: string; name?: string; phone?: string; email?: string; whatsapp_opted_in?: boolean }[] }),
    venueIds.length
      ? supabase.from('venues').select('id, name').in('id', venueIds)
      : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
  ])

  const guestsById = new Map((guestRows ?? []).map(g => [g.id, g]))
  const venuesById = new Map((venueRows ?? []).map(v => [v.id, v]))

  let sent = 0
  let skipped = 0
  let failed = 0
  let stubbed = 0

  for (const request of requests) {
    const guest = request.guest_id ? guestsById.get(request.guest_id) : undefined
    const venue = venuesById.get(request.venue_id)

    // Fall back to the denormalized fields when there is no linked guest row.
    const phone = guest?.phone ?? request.guest_phone
    // Mirrors the phone fallback. Without it an email request for a walk-in
    // with no `guests` row had nowhere to carry an address, so the dispatcher
    // resolved no channel and wrote the request off as unreachable.
    const email = guest?.email ?? request.guest_email
    const name  = guest?.name  ?? request.guest_name ?? 'there'

    // Honour the channel already on the row where it can still work, otherwise
    // pick one from the contact details we have.
    const channel = usableChannel(request.channel, {
      phone, email, whatsappOptedIn: guest?.whatsapp_opted_in,
    })

    if (!channel) {
      // No usable channel — this is terminal, not a delay. 'opted_out' was
      // written here for as long as this file has existed and the constraint
      // rejected every one of them, so the request stayed pending and the cron
      // picked it up again every five minutes for a day.
      await tryWrite('review-dispatch: mark unreachable', supabase
        .from('review_requests')
        .update({ status: 'unreachable' })
        .eq('id', request.id))
      skipped++
      continue
    }

    const result = channel === 'whatsapp'
      ? await sendReviewRequest({
          phone: phone!,
          guestName: name,
          venueName: venue?.name ?? 'our venue',
          requestId: request.id,
          venueId:   request.venue_id,
          guestId:   request.guest_id ?? undefined,
        })
      : await sendReviewRequestEmail({
          to: email!,
          guestName: name,
          venueName: venue?.name ?? 'our venue',
          requestId: request.id,
          venueId:   request.venue_id,
        })

    if (result.ok && result.stub) {
      // Nothing was sent — no credentials, or a demo venue. Marking this 'sent'
      // would tell the owner a guest had been contacted who never was, and
      // would take the request out of the queue for a send that never happened.
      //
      // It stays pending so it goes out once the channel works. But a stub is
      // ok:true, so it never reaches the failure path below — without this the
      // five-minute cron would retry the same request forever.
      if ((request.scheduled_for ?? now) < staleBefore) {
        await tryWrite('review-dispatch: retire un-sendable request', supabase
          .from('review_requests')
          .update({ status: 'unreachable' })
          .eq('id', request.id))
        console.warn(`[review-dispatch] ${request.id} retired — no channel configured for ${MAX_AGE_HOURS}h`)
      }
      stubbed++
    } else if (result.ok) {
      // If this update is lost, the next run re-sends the same message to the
      // same guest — the log line below is the only warning of that.
      await tryWrite(`review-dispatch: mark sent (${request.id}) — FAILURE MEANS THE GUEST MAY BE MESSAGED TWICE`, supabase
        .from('review_requests')
        .update({ status: 'sent', sent_at: new Date().toISOString(), channel })
        .eq('id', request.id))
      sent++
    } else {
      // Retry transient failures on the next run; abandon anything that has
      // been failing past the staleness window.
      const stale = (request.scheduled_for ?? now) < staleBefore
      if (stale) {
        await tryWrite('review-dispatch: mark failed', supabase
          .from('review_requests')
          .update({ status: 'failed' })
          .eq('id', request.id))
      }

      console.error(
        `[review-dispatch] send failed for ${request.id}${stale ? ' (abandoned — too old)' : ' (will retry)'}:`,
        result.error
      )
      failed++
    }
  }

  return NextResponse.json({ processed: requests.length, sent, skipped, failed, stubbed })
}

// Health check / manual trigger
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
