import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateReviewResponse } from '@/lib/claude'

const schema = z.object({ review_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const supabase = await createClient()
    const admin = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load review with venue
    const { data: review, error } = await admin
      .from('reviews')
      .select('*, venues(name, settings)')
      .eq('id', body.review_id)
      .single()

    if (error || !review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (!review.content) return NextResponse.json({ error: 'Review has no content' }, { status: 400 })

    const venue = review.venues as { name: string; settings: Record<string, unknown> }
    const ownerName = venue.settings?.owner_name as string || 'The Owner'

    const draft = await generateReviewResponse({
      reviewContent: review.content,
      rating: review.rating,
      venueName: venue.name,
      ownerName,
      reviewerName: review.author_name || 'Guest',
    })

    // Save draft to DB
    await admin.from('reviews').update({ ai_response_draft: draft }).eq('id', body.review_id)

    return NextResponse.json({ success: true, draft })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('generate-response error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
