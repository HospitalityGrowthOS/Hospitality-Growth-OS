/**
 * Campaign Executor
 * Sends WhatsApp campaigns to segmented guest lists.
 * Called by cron or manually from dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendText } from '@/lib/whatsapp'

const schema = z.object({ campaign_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const { campaign_id } = schema.parse(await req.json())
    const supabase = await createAdminClient()

    const { data: campaignRaw } = await supabase
      .from('campaigns')
      .select('*, venues(*)')
      .eq('id', campaign_id)
      .single()

    const campaign = campaignRaw as unknown as {
      id: string
      status: string
      venue_id: string
      message_template: string
      target_segment: Record<string, unknown>
      venues: Record<string, unknown>
    } | null

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json({ error: `Cannot send campaign with status: ${campaign.status}` }, { status: 400 })
    }

    const venue = campaign.venues as Record<string, unknown>
    if (!venue?.whatsapp_phone_number_id || !venue?.whatsapp_access_token) {
      return NextResponse.json({ error: 'Venue has no WhatsApp configured' }, { status: 400 })
    }

    // Mark as running
    await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaign_id)

    // Build guest segment
    const segment = campaign.target_segment as Record<string, unknown> || {}
    let query = supabase.from('guests').select('id, name, phone, loyalty_tier').eq('venue_id', campaign.venue_id).eq('whatsapp_opted_in', true)

    if (segment.tier) query = query.eq('loyalty_tier', segment.tier)
    if (segment.min_visits) query = query.gte('total_visits', segment.min_visits as number)
    if (segment.inactive_days) {
      const cutoff = new Date(Date.now() - (segment.inactive_days as number) * 86400000).toISOString()
      query = query.lt('last_visit_at', cutoff)
    }

    const { data: guests } = await query
    if (!guests?.length) {
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign_id)
      return NextResponse.json({ sent: 0, message: 'No matching guests' })
    }

    let sent = 0, failed = 0
    const BATCH_SIZE = 10
    const DELAY_MS = 1000 // WhatsApp rate limiting

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE)

      await Promise.allSettled(batch.map(async (guest) => {
        if (!guest.phone) return

        const message = personalizeMessage(campaign.message_template as string, {
          name: guest.name?.split(' ')[0] || 'there',
          tier: guest.loyalty_tier || '',
          venue: venue.name as string,
        })

        try {
          await sendText(venue.whatsapp_phone_number_id as string, venue.whatsapp_access_token as string, guest.phone, message)
          await supabase.from('campaign_sends').insert({
            campaign_id, venue_id: campaign.venue_id, guest_id: guest.id,
            status: 'sent', sent_at: new Date().toISOString(),
          })
          sent++
        } catch {
          await supabase.from('campaign_sends').insert({
            campaign_id, venue_id: campaign.venue_id, guest_id: guest.id,
            status: 'failed', error_message: 'WhatsApp delivery failed',
          })
          failed++
        }
      }))

      // Rate limit between batches
      if (i + BATCH_SIZE < guests.length) await sleep(DELAY_MS)
    }

    await supabase.from('campaigns').update({
      status: 'completed',
      sent_count: sent,
    }).eq('id', campaign_id)

    return NextResponse.json({ success: true, sent, failed, total: guests.length })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('campaign send error:', err)
    return NextResponse.json({ error: 'Campaign execution failed' }, { status: 500 })
  }
}

function personalizeMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
