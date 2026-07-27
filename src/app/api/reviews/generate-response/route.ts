import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { generateReviewReply } from '@/lib/ai'

const schema = z.object({ review_id: z.string().uuid() })

/**
 * Drafts a public reply to a review and stores it on the review.
 * Nothing is published — the owner edits and posts it themselves.
 */
export async function POST(req: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = schema.parse(await req.json())
    const admin = await createAdminClient()

    // Scoped by venue as well as id — otherwise any signed-in owner could draft
    // against another venue's reviews by guessing a UUID.
    const { data: review } = await admin
      .from('reviews')
      .select('id, rating, content, author_name')
      .eq('id', body.review_id)
      .eq('venue_id', venue.id)
      .single()

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (!review.content) {
      return NextResponse.json({ error: 'This review has no text to respond to' }, { status: 400 })
    }

    const settings = (venue.settings || {}) as Record<string, unknown>
    const ownerName =
      typeof settings.owner_name === 'string' && settings.owner_name.trim()
        ? settings.owner_name.trim()
        : venue.name

    const result = await generateReviewReply({
      reviewContent: review.content,
      rating: review.rating,
      venueName: venue.name,
      ownerName,
      authorName: review.author_name,
      venueId: venue.id,
    })

    if (!result.ok) {
      const status = result.reason === 'not_configured' ? 503 : 502
      return NextResponse.json({ error: result.message, reason: result.reason }, { status })
    }

    await admin
      .from('reviews')
      .update({ ai_response_draft: result.data })
      .eq('id', body.review_id)

    return NextResponse.json({ success: true, draft: result.data })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[generate-response] error:', err)
    return NextResponse.json({ error: 'Failed to generate a draft' }, { status: 500 })
  }
}
