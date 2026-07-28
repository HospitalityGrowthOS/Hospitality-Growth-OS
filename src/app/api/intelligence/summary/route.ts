import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentVenue } from '@/lib/venue'
import { generateBusinessSummary, getIntelligence } from '@/lib/intelligence'

const schema = z.object({ period: z.enum(['daily', 'weekly']) })

/**
 * Generates a written briefing from figures the intelligence layer computed.
 *
 * On demand rather than on page load: a model call per render would be slow
 * and would spend budget on views nobody reads.
 */
export async function POST(req: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { period } = schema.parse(await req.json())

    const snapshot = await getIntelligence({
      id: venue.id,
      name: venue.name,
      type: venue.type,
      city: venue.city,
      address: venue.address,
      settings: venue.settings,
    })

    const result = await generateBusinessSummary({
      snapshot,
      period,
      venueName: venue.name,
      venueId: venue.id,
    })

    if (!result.ok) {
      const status = result.reason === 'not_configured' ? 503 : 502
      return NextResponse.json({ error: result.message, reason: result.reason }, { status })
    }

    return NextResponse.json({
      success: true,
      period,
      summary: result.data,
      generated_at: snapshot.generatedAt,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[intelligence/summary] error:', err)
    return NextResponse.json({ error: 'Could not generate a summary' }, { status: 500 })
  }
}
