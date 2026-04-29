import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendText } from '@/lib/whatsapp'
import { calcLoyaltyTier, getTierEmoji } from '@/lib/utils'

const schema = z.object({
  member_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  spend_amount: z.number().positive(),
  visit_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const supabase = await createAdminClient()

    const [{ data: member }, { data: venue }] = await Promise.all([
      supabase.from('loyalty_members').select('*, guests(name, phone)').eq('id', body.member_id).single(),
      supabase.from('venues').select('*').eq('id', body.venue_id).single(),
    ])

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

    const settings = venue.settings as Record<string, unknown>
    const pointsPerEuro = (settings?.points_per_euro as number) || 10
    const thresholds = (settings?.tier_thresholds as { silver: number; gold: number }) || { silver: 500, gold: 1500 }

    const pointsEarned = Math.floor(body.spend_amount * pointsPerEuro)
    if (pointsEarned <= 0) return NextResponse.json({ success: true, points_earned: 0 })

    const newBalance = member.points_balance + pointsEarned
    const oldTier = member.tier as string
    const newTier = calcLoyaltyTier(newBalance, thresholds)
    const tierUpgraded = newTier !== oldTier

    await Promise.all([
      supabase.from('loyalty_transactions').insert({
        venue_id: body.venue_id, member_id: body.member_id,
        type: 'earn', points: pointsEarned,
        description: `Visit spend €${body.spend_amount.toFixed(2)}`,
        reference_id: body.visit_id || null,
      }),
      supabase.from('loyalty_members').update({ points_balance: newBalance, points_earned_total: member.points_earned_total + pointsEarned, tier: newTier, last_activity_at: new Date().toISOString() }).eq('id', body.member_id),
      supabase.from('guests').update({ loyalty_points: newBalance, loyalty_tier: newTier }).eq('id', member.guest_id),
    ])

    // WhatsApp notification
    const guest = member.guests as { name?: string; phone?: string }
    if (guest?.phone && venue.whatsapp_phone_number_id && venue.whatsapp_access_token) {
      const firstName = guest.name?.split(' ')[0] || 'there'
      const emoji = getTierEmoji(newTier)
      const message = tierUpgraded
        ? `🎉 Congratulations ${firstName}!\n\nYou've reached *${newTier.charAt(0).toUpperCase() + newTier.slice(1)} status* at ${venue.name}! ${emoji}\n\nBalance: *${newBalance} points*`
        : `Thanks for visiting ${venue.name}, ${firstName}! ${emoji}\n\n+${pointsEarned} points earned\nTotal: *${newBalance} points*`
      await sendText(venue.whatsapp_phone_number_id, venue.whatsapp_access_token, guest.phone, message)
    }

    return NextResponse.json({ success: true, points_earned: pointsEarned, new_balance: newBalance, tier_upgraded: tierUpgraded, new_tier: newTier })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Failed to award points' }, { status: 500 })
  }
}
