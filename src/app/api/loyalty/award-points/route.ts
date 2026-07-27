import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentVenue } from '@/lib/venue'
import { awardPoints } from '@/lib/loyalty'

const schema = z.object({
  member_id: z.string().uuid(),
  spend_amount: z.number().positive(),
  visit_id: z.string().uuid().optional(),
  // Accepted for backwards compatibility but ignored — the venue always comes
  // from the signed-in owner's session.
  venue_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = schema.parse(await req.json())

    const result = await awardPoints({
      memberId:    body.member_id,
      venueId:     venue.id,
      spendAmount: body.spend_amount,
      visitId:     body.visit_id,
    })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('[award-points] error:', err)
    return NextResponse.json({ error: 'Failed to award points' }, { status: 500 })
  }
}
