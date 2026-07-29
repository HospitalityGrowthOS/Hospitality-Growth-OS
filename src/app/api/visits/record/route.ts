import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { awardPoints } from '@/lib/loyalty'
import { mustWrite, tryWrite } from '@/lib/db'
import { emitEvent } from '@/lib/automation'

const schema = z.object({
  // Accepted for backwards compatibility but never trusted — the venue always
  // comes from the signed-in owner's session.
  venue_id: z.string().uuid().optional(),
  guest_phone: z.string().min(7),
  spend_amount: z.number().nonnegative().default(0),
  party_size: z.number().int().positive().default(1),
  table_number: z.string().optional(),
  source: z.enum(['walkin', 'reservation', 'delivery']).default('walkin'),
  staff_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = schema.parse(await req.json())
    const venueId = venue.id
    const supabase = await createAdminClient()

    // Find or create guest
    let { data: guest } = await supabase
      .from('guests')
      .select('*')
      .eq('venue_id', venueId)
      .eq('phone', body.guest_phone)
      .single()

    if (!guest) {
      const { data } = await supabase
        .from('guests')
        .insert({ venue_id: venueId, name: body.guest_phone, phone: body.guest_phone, whatsapp_opted_in: true })
        .select().single()
      guest = data
    }
    if (!guest) return NextResponse.json({ error: 'Failed to find/create guest' }, { status: 500 })

    // Record visit
    const { data: visit } = await supabase.from('visits').insert({
      venue_id: venueId,
      guest_id: guest.id,
      visited_at: new Date().toISOString(),
      party_size: body.party_size,
      spend_amount: body.spend_amount,
      table_number: body.table_number || null,
      source: body.source,
      staff_id: body.staff_id || null,
    }).select().single()

    if (!visit) return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 })

    // Award loyalty points if member
    if (body.spend_amount > 0) {
      const { data: member } = await supabase
        .from('loyalty_members')
        .select('id')
        .eq('venue_id', venueId)
        .eq('guest_id', guest.id)
        .single()

      if (member) {
        // Direct call — an HTTP hop here would carry no session and fail auth.
        await awardPoints({
          memberId:    member.id,
          venueId,
          spendAmount: body.spend_amount,
          visitId:     visit.id,
        }).catch(err => console.error('[visits] award points failed:', err))
      }
    }

    // Queue the review request — the dispatcher sends it once the delay elapses.
    const venueSettings = (venue.settings || {}) as Record<string, unknown>
    const delayMinutes = (venueSettings.review_delay_minutes as number) ?? 45
    await mustWrite('visits: queue review request', supabase.from('review_requests').insert({
      venue_id:      venueId,
      guest_id:      guest.id,
      visit_id:      visit.id,
      channel:       'whatsapp',
      status:        'pending',
      guest_name:    guest.name || null,
      guest_phone:   guest.phone || body.guest_phone,
      scheduled_for: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    }))

    // Track event
    await tryWrite('visits: analytics event', supabase.from('analytics_events').insert({ venue_id: venueId, event_type: 'visit_recorded', properties: { visit_id: visit.id, spend: body.spend_amount } }))

    // Hand the event to the Automation Engine. It decides whether anything
    // should happen; this route neither knows nor cares which workflows exist.
    // emitEvent never throws — a misbehaving workflow cannot fail a visit.
    await emitEvent({
      venueId,
      name: 'visit.recorded',
      guestId: guest.id,
      payload: {
        visit_id: visit.id,
        spend_amount: body.spend_amount,
        party_size: body.party_size,
        table_number: body.table_number ?? null,
        source: body.source,
      },
    })

    return NextResponse.json({ success: true, visit_id: visit.id, guest_id: guest.id })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('record visit error:', err)
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 })
  }
}
