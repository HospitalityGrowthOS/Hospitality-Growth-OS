import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { mustWrite, tryWrite } from '@/lib/db'
import { sendText } from '@/lib/whatsapp'
import { generateQRCode, calcLoyaltyTier } from '@/lib/utils'

const schema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  birthday: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const supabase = await createAdminClient()

    // Load venue
    const { data: venue } = await supabase.from('venues').select('*').eq('id', body.venue_id).single()
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

    const settings = venue.settings as Record<string, unknown>

    // Find or create guest
    let { data: guest } = await supabase.from('guests').select('*').eq('venue_id', body.venue_id).eq('phone', body.phone).single()

    if (!guest) {
      const { data } = await supabase.from('guests').insert({
        venue_id: body.venue_id,
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        whatsapp_opted_in: true,
        loyalty_tier: 'bronze',
      }).select().single()
      guest = data
    }

    if (!guest) return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 })

    // Check already enrolled
    const { data: existing } = await supabase.from('loyalty_members').select('*').eq('venue_id', body.venue_id).eq('guest_id', guest.id).single()
    if (existing) return NextResponse.json({ already_enrolled: true, qr_code: existing.qr_code, tier: existing.tier, points: existing.points_balance })

    // Generate QR + enroll
    const qrCode = generateQRCode(venue.slug || venue.id.substring(0, 4))
    const welcomePoints = (settings?.welcome_bonus_points as number) || 50

    // Balances start at zero: the welcome-bonus ledger row below is what
    // establishes them, via the after_loyalty_transaction_insert trigger.
    // Seeding them here as well is what inflated points_earned_total to
    // double the welcome bonus on every enrolment.
    const { data: member } = await supabase.from('loyalty_members').insert({
      venue_id: body.venue_id,
      guest_id: guest.id,
      qr_code: qrCode,
      tier: 'bronze',
      points_balance: 0,
      points_earned_total: 0,
      enrolled_at: new Date().toISOString(),
      birthday: body.birthday || null,
    }).select().single()

    if (!member) return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })

    // The ledger row and the balance must agree — a silent failure here is how
    // nine members ended up holding points with no transaction history.
    await mustWrite('enroll: welcome bonus ledger', supabase.from('loyalty_transactions').insert({
      venue_id: body.venue_id,
      member_id: member.id,
      type: 'bonus',
      points: welcomePoints,
      balance_after: welcomePoints,
      description: 'Welcome bonus',
    }))

    // Only the tier — guests.loyalty_points is set by the same trigger.
    await mustWrite('enroll: guest tier', supabase.from('guests').update({ loyalty_tier: 'bronze' }).eq('id', guest.id))

    // Send WhatsApp welcome
    if (venue.whatsapp_phone_number_id && venue.whatsapp_access_token) {
      const firstName = body.name.split(' ')[0]
      await sendText(
        venue.whatsapp_phone_number_id,
        venue.whatsapp_access_token,
        body.phone,
        `Welcome to ${venue.name} Loyalty! 🎉\n\nHi ${firstName}! You've earned ${welcomePoints} welcome points 🥉\n\nYour QR Code: *${qrCode}*\nShow this at the counter to earn & redeem points.\n\n🥉 Bronze → 🥈 Silver at 500pts\n🥈 Silver → 🥇 Gold at 1,500pts`,
        venue.id as string
      )
    }

    await tryWrite('enroll: analytics event', supabase.from('analytics_events').insert({ venue_id: body.venue_id, event_type: 'loyalty_enrolled', properties: { member_id: member.id } }))

    return NextResponse.json({ success: true, member_id: member.id, qr_code: qrCode, tier: 'bronze', points: welcomePoints })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('loyalty enroll error:', err)
    return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })
  }
}
