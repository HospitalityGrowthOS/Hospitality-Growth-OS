import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const schema = z.object({
  venue_id: z.string().uuid(),
  guest_phone: z.string().min(7),
  spend_amount: z.number().nonnegative().default(0),
  party_size: z.number().int().positive().default(1),
  table_number: z.string().optional(),
  source: z.enum(['walkin', 'reservation', 'delivery']).default('walkin'),
  staff_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const supabase = await createAdminClient()

    // Find or create guest
    let { data: guest } = await supabase
      .from('guests')
      .select('*')
      .eq('venue_id', body.venue_id)
      .eq('phone', body.guest_phone)
      .single()

    if (!guest) {
      const { data } = await supabase
        .from('guests')
        .insert({ venue_id: body.venue_id, phone: body.guest_phone, whatsapp_opted_in: true })
        .select().single()
      guest = data
    }
    if (!guest) return NextResponse.json({ error: 'Failed to find/create guest' }, { status: 500 })

    // Record visit
    const { data: visit } = await supabase.from('visits').insert({
      venue_id: body.venue_id,
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
        .eq('venue_id', body.venue_id)
        .eq('guest_id', guest.id)
        .single()

      if (member) {
        // Fire-and-forget points award
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/loyalty/award-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member.id, venue_id: body.venue_id, spend_amount: body.spend_amount, visit_id: visit.id }),
        }).catch(console.error)
      }
    }

    // Schedule review request (45-minute delay via review-request queue)
    await supabase.from('review_requests').insert({
      venue_id: body.venue_id,
      guest_id: guest.id,
      visit_id: visit.id,
      channel: 'whatsapp',
      status: 'pending',
    })

    // Track event
    await supabase.from('analytics_events').insert({ venue_id: body.venue_id, event_type: 'visit_recorded', properties: { visit_id: visit.id, spend: body.spend_amount } })

    return NextResponse.json({ success: true, visit_id: visit.id, guest_id: guest.id })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('record visit error:', err)
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 })
  }
}
