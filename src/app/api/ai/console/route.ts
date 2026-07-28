import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import {
  buildVenueContext,
  captureReservationRequest,
  escalateConversation,
  handleGuestMessage,
  DEFAULT_MODEL,
  type ConversationTurn,
} from '@/lib/ai'

const schema = z.object({
  message: z.string().min(1).max(2000),
  /** Continues an existing thread; omit to start a new one. */
  conversation_id: z.string().uuid().optional(),
  /** Answer as if for this guest, so loyalty context is exercised. */
  guest_id: z.string().uuid().optional(),
})

/**
 * Console endpoint for the AI Command Center.
 *
 * Runs the identical path WhatsApp uses — same analysis, same prompts, same
 * escalation rules — and stores the exchange as a real conversation on the
 * `website` channel. Testing here therefore exercises production code, and the
 * transcript appears in Conversation History alongside every other channel.
 */
export async function POST(req: NextRequest) {
  try {
    const venue = await getCurrentVenue()
    if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = schema.parse(await req.json())
    const supabase = await createAdminClient()
    const venueId = venue.id
    const startedAt = Date.now()

    // Optional guest, so loyalty answers can be exercised with real figures.
    let guest: { id: string; name: string | null; tier: string | null; points: number | null } | null = null
    if (body.guest_id) {
      const { data } = await supabase
        .from('guests')
        .select('id, name, loyalty_tier, loyalty_points')
        .eq('id', body.guest_id)
        .eq('venue_id', venueId)
        .maybeSingle()
      if (data) {
        guest = {
          id: data.id,
          name: data.name,
          tier: data.loyalty_tier,
          points: data.loyalty_points,
        }
      }
    }

    // Resume or open the thread.
    let conversationId = body.conversation_id ?? null
    if (conversationId) {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('venue_id', venueId)
        .maybeSingle()
      if (!data) conversationId = null
    }

    if (!conversationId) {
      const { data } = await supabase
        .from('conversations')
        .insert({
          venue_id: venueId,
          guest_id: guest?.id ?? null,
          channel: 'website',
          status: 'open',
          ai_handled: true,
          context: { source: 'console' },
        })
        .select('id')
        .single()
      conversationId = data?.id ?? null
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Could not open a conversation' }, { status: 500 })
    }

    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(10)

    const turns: ConversationTurn[] = (history ?? [])
      .reverse()
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const venueContext = buildVenueContext({
      id: venueId,
      name: venue.name,
      type: venue.type,
      city: venue.city,
      address: venue.address,
      settings: venue.settings,
    })

    const result = await handleGuestMessage({
      message: body.message,
      venue: venueContext,
      guest: guest ?? undefined,
      history: turns,
    })

    const now = new Date().toISOString()

    // Store the inbound turn regardless of the outcome.
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      venue_id: venueId,
      role: 'user',
      content: body.message,
      sent_at: now,
      metadata: { source: 'console' },
      intent: result.ok ? result.data.intent : null,
      sentiment: result.ok ? result.data.sentiment : null,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          conversation_id: conversationId,
          reason: result.reason,
          error: result.message,
          latency_ms: Date.now() - startedAt,
        },
        { status: result.reason === 'not_configured' ? 503 : 502 }
      )
    }

    const reply = result.data

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      venue_id: venueId,
      role: 'assistant',
      content: reply.message,
      sent_at: new Date().toISOString(),
      metadata: { model: DEFAULT_MODEL, source: 'console' },
      intent: reply.intent,
      sentiment: reply.sentiment,
    })

    // The console runs the real pipeline, so a reservation mentioned here is
    // captured exactly as it would be from WhatsApp.
    let reservationId: string | null = null
    if (reply.reservation) {
      reservationId = await captureReservationRequest({
        venueId,
        guestId: guest?.id ?? null,
        guestName: guest?.name ?? null,
        guestPhone: null,
        details: reply.reservation,
        sourceMessage: body.message,
        channel: 'website',
      })
    }

    if (reply.shouldEscalate) {
      await escalateConversation({
        venueId,
        conversationId,
        reason: reply.escalationReason ?? 'Guest needs a member of the team',
        guestLabel: guest?.name ?? 'Console tester',
        lastMessage: body.message,
        sentiment: reply.sentiment,
      })
    }

    return NextResponse.json({
      ok: true,
      conversation_id: conversationId,
      reply: reply.message,
      intent: reply.intent,
      sentiment: reply.sentiment,
      escalated: reply.shouldEscalate,
      escalation_reason: reply.escalationReason,
      reservation: reply.reservation,
      reservation_id: reservationId,
      loyalty: guest
        ? { name: guest.name, tier: guest.tier, points: guest.points }
        : null,
      model: DEFAULT_MODEL,
      latency_ms: Date.now() - startedAt,
      at: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[ai/console] error:', err)
    return NextResponse.json({ error: 'Console request failed' }, { status: 500 })
  }
}
