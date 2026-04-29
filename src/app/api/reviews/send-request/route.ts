/**
 * Review Automation Engine
 * Triggered by cron every 5 minutes.
 * Finds pending review_requests where visit was 45+ minutes ago,
 * sends WhatsApp message, routes positive/negative.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendInteractive } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  // Secure cron endpoint
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45 min ago

  // Find pending requests where the visit was 45+ min ago and guest opted in
  const { data: requests, error } = await supabase
    .from('review_requests')
    .select(`
      id, venue_id, guest_id, visit_id,
      guests(name, phone, whatsapp_opted_in),
      venues(name, whatsapp_phone_number_id, whatsapp_access_token, settings),
      visits(visited_at)
    `)
    .eq('status', 'pending')
    .eq('channel', 'whatsapp')
    .lt('visits.visited_at', cutoff)
    .limit(50)

  if (error) { console.error('review-request query error:', error); return NextResponse.json({ error: error.message }, { status: 500 }) }
  if (!requests?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  const results: string[] = []

  for (const request of requests) {
    const guest = request.guests as { name?: string; phone?: string; whatsapp_opted_in?: boolean }
    const venue = request.venues as { name: string; whatsapp_phone_number_id?: string; whatsapp_access_token?: string; settings?: Record<string, unknown> }

    if (!guest?.whatsapp_opted_in || !guest?.phone) {
      await supabase.from('review_requests').update({ status: 'opted_out' }).eq('id', request.id)
      continue
    }

    if (!venue?.whatsapp_phone_number_id || !venue?.whatsapp_access_token) {
      results.push(`skip:${request.id} - no WhatsApp config`)
      continue
    }

    const firstName = guest.name?.split(' ')[0] || 'there'
    const settings = venue.settings || {}
    const reviewDelayCopy = (settings.review_message_copy as string) ||
      `Hi ${firstName}! 🍽️\n\nThank you for dining at *${venue.name}* tonight!\n\nWe hope you had a wonderful experience. We'd love to hear your thoughts:`

    try {
      await sendInteractive(
        venue.whatsapp_phone_number_id,
        venue.whatsapp_access_token,
        guest.phone,
        reviewDelayCopy,
        [
          { id: `review_google_${request.id}`, title: '⭐ Leave Google Review' },
          { id: `review_feedback_${request.id}`, title: '💬 Share Feedback' },
        ],
        `Takes 30 seconds · Means everything to us`
      )

      await supabase.from('review_requests').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        review_url: (settings.google_review_url as string) || '',
      }).eq('id', request.id)

      sent++
    } catch (err) {
      console.error(`Failed to send review request ${request.id}:`, err)
      results.push(`error:${request.id}`)
    }
  }

  return NextResponse.json({ sent, processed: requests.length, results })
}

// GET for manual trigger / health check
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
