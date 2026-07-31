/**
 * Reservation status changes.
 * PATCH /api/reservations/[id]
 *
 * Scoped to the caller's venue. The id is never trusted on its own: the update
 * carries an explicit venue filter so a reservation belonging to someone else
 * cannot be moved by guessing its UUID.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { emitEvent } from '@/lib/automation/events'
import { sendReservationConfirmed } from '@/lib/whatsapp-send'

/** Mirrors supabase/reservation_status.sql — keep the two in step. */
const STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'declined', 'no_show'] as const

const schema = z.object({
  status: z.enum(STATUSES),
  notes: z.string().max(500).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { status, notes } = parsed.data

  const admin = await createAdminClient()

  const { data: existing } = await admin
    .from('reservation_requests')
    .select('id, guest_id, guest_name, guest_phone, status, requested_date, requested_time, party_size')
    .eq('id', params.id)
    .eq('venue_id', venue.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  if (existing.status === status) return NextResponse.json({ success: true, unchanged: true })

  const { error } = await admin
    .from('reservation_requests')
    .update({
      status,
      ...(notes !== undefined ? { notes } : {}),
      handled_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('venue_id', venue.id)

  if (error) {
    console.error('[reservations] status update failed:', error.message)
    return NextResponse.json({ error: 'Could not update reservation' }, { status: 500 })
  }

  // Confirming is the moment the guest is owed an answer. They asked for a
  // table and were told nothing until now — the request was captured, the
  // owner acted on it, and the loop closed silently on the venue's side only.
  if (status === 'confirmed') {
    // No phone or no date means nothing worth sending — the owner still gets
    // the confirmation recorded, they just have to tell the guest themselves.
    if (existing.guest_phone && existing.requested_date) {
      // Not awaited into the response path: a messaging failure must not make
      // the owner think the booking was not confirmed. It was.
      sendReservationConfirmed({
        phone: existing.guest_phone,
        guestName: existing.guest_name,
        venueName: venue.name,
        date: existing.requested_date,
        time: (existing.requested_time ?? '').slice(0, 5),
        partySize: existing.party_size ?? 2,
        venueId: venue.id,
        guestId: existing.guest_id ?? undefined,
      }).catch(err => console.error('[reservations] confirmation send failed:', err))
    }

    await emitEvent({
      venueId: venue.id,
      name: 'reservation.confirmed',
      guestId: existing.guest_id,
      payload: {
        reservation_id: existing.id,
        date: existing.requested_date,
        time: existing.requested_time,
        party_size: existing.party_size,
        requested_for: `${existing.requested_date} ${existing.requested_time ?? ''}`.trim(),
      },
    })
  }

  // Cancellation is the one transition the automation engine already has a
  // trigger for, so a venue can build a win-back or a table-release flow on it.
  if (status === 'cancelled' || status === 'declined') {
    await emitEvent({
      venueId: venue.id,
      name: 'reservation.cancelled',
      guestId: existing.guest_id,
      payload: {
        reservation_id: existing.id,
        status,
        date: existing.requested_date,
        time: existing.requested_time,
        party_size: existing.party_size,
      },
    })
  }

  return NextResponse.json({ success: true, status })
}
