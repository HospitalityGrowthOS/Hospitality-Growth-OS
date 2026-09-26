/**
 * Manual loyalty bonus.
 * POST /api/loyalty/issue-bonus
 *
 * The route took `venue_id` from the request body, scoped the *member* lookup
 * to it, and never asked whether the *caller* had anything to do with that
 * venue. Any signed-in account could award up to 10,000 points at any venue,
 * given a member id and a venue id — both of which are public.
 *
 *   1. the caller must own the venue they name  (`ownsVenue`)
 *   2. the member must belong to that same venue (the `.eq('venue_id', …)` below)
 *
 * Both refusals return the same 404, matching `api/venues/select`, so the
 * endpoint does not confirm which venue ids exist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { ownsVenue } from '@/lib/venue'
import { mustWrite } from '@/lib/db'
import { tierFor, tierThresholds } from '@/lib/tiers'

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

    // Check 1 — the caller operates this venue. Before any lookup, before any
    // write. A signed-in stranger gets no further than this line.
    if (!(await ownsVenue(body.venue_id))) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const admin = await createAdminClient()

    // Check 2 — the member belongs to the venue the caller just proved they
    // operate. On its own this was never authorisation: it only established
    // that the member and the supplied venue agreed with each other.
    const { data: member } = await admin
      .from('loyalty_members')
      .select('*')
      .eq('id', body.member_id)
      .eq('venue_id', body.venue_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Thresholds come from the venue, not a default. Awarding a bonus used to
    // re-tier the member against hardcoded numbers, so a manual bonus could
    // silently contradict the tier the venue's own settings called for.
    const { data: bonusVenue } = await admin
      .from('venues').select('settings').eq('id', body.venue_id).single()

    const newBalance = member.points_balance + body.points
    const newTier    = tierFor(newBalance, tierThresholds(bonusVenue?.settings))
    const now        = new Date().toISOString()

    // The ledger row goes in first; its trigger sets points_balance,
    // points_earned_total, last_activity_at and guests.loyalty_points.
    // Only the tier is ours to write.
    await mustWrite('issue-bonus: ledger row', admin.from('loyalty_transactions').insert({
      venue_id:   body.venue_id,
      member_id:  body.member_id,
      type:       'bonus',
      points:     body.points,
      balance_after: newBalance,
      description: body.reason,
      created_by: user.id,
    }))

    if (newTier !== member.tier) {
      await Promise.all([
        mustWrite('issue-bonus: member tier', admin.from('loyalty_members')
          .update({ tier: newTier, updated_at: now }).eq('id', body.member_id)),
        mustWrite('issue-bonus: guest tier', admin.from('guests')
          .update({ loyalty_tier: newTier }).eq('id', member.guest_id)),
      ])
    }

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
