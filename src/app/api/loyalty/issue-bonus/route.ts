import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { calcLoyaltyTier } from '@/lib/utils'

const schema = z.object({
  member_id: z.string().uuid(),
  venue_id:  z.string().uuid(),
  points:    z.number().int().positive().max(10000),
  reason:    z.string().min(1).max(200),
})

export async function POST(req: NextRequest) {
  try {
    // Auth check — must be signed-in venue owner
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = schema.parse(await req.json())
    const admin = await createAdminClient()

    // Fetch member (scoped to this venue for safety)
    const { data: member } = await admin
      .from('loyalty_members')
      .select('*')
      .eq('id', body.member_id)
      .eq('venue_id', body.venue_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const newBalance = member.points_balance + body.points
    const newTier    = calcLoyaltyTier(newBalance)
    const now        = new Date().toISOString()

    await Promise.all([
      admin.from('loyalty_transactions').insert({
        venue_id:   body.venue_id,
        member_id:  body.member_id,
        type:       'bonus',
        points:     body.points,
        description: body.reason,
        created_by: user.id,
      }),
      admin.from('loyalty_members').update({
        points_balance:     newBalance,
        points_earned_total: member.points_earned_total + body.points,
        tier:               newTier,
        last_activity_at:   now,
        updated_at:         now,
      }).eq('id', body.member_id),
      admin.from('guests').update({
        loyalty_points: newBalance,
        loyalty_tier:   newTier,
      }).eq('id', member.guest_id),
    ])

    return NextResponse.json({
      success:     true,
      new_balance: newBalance,
      new_tier:    newTier,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[issue-bonus] error:', err)
    return NextResponse.json({ error: 'Failed to issue points' }, { status: 500 })
  }
}
