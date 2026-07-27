import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhook, parsePayload, markRead, sendText, sendInteractive } from '@/lib/whatsapp'
import {
  buildVenueContext,
  captureReservationRequest,
  escalateConversation,
  handleGuestMessage,
  DEFAULT_MODEL,
  type ConversationTurn,
} from '@/lib/ai'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!

// ─── GET: Meta webhook verification ──────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const challenge = verifyWebhook(
    searchParams.get('hub.mode'),
    searchParams.get('hub.verify_token'),
    searchParams.get('hub.challenge'),
    VERIFY_TOKEN
  )
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST: Inbound message ────────────────────────────────────
export async function POST(req: NextRequest) {
  // Return 200 immediately — Meta requires response within 20s
  const payload = await req.json()

  // Process async (don't await)
  processInbound(payload).catch(err => console.error('WhatsApp processing error:', err))

  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}

async function processInbound(payload: Record<string, unknown>) {
  const msg = parsePayload(payload)
  if (!msg) return

  const supabase = await createAdminClient()

  // Find venue by phone number ID
  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('whatsapp_phone_number_id', msg.phoneNumberId)
    .single()

  if (!venue) { console.error('No venue for phoneNumberId:', msg.phoneNumberId); return }

  // Find or create guest
  let { data: guest } = await supabase
    .from('guests')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('phone', msg.from)
    .single()

  if (!guest) {
    const { data } = await supabase
      .from('guests')
      .insert({ venue_id: venue.id, name: msg.from, phone: msg.from, whatsapp_opted_in: true })
      .select()
      .single()
    guest = data
  }

  if (!guest) return

  // Mark as read
  await markRead(venue.whatsapp_phone_number_id!, venue.whatsapp_access_token!, msg.messageId)

  // Route by type
  if (msg.type === 'interactive' && msg.buttonReplyId) {
    await handleButtonReply(msg, venue, guest.id, supabase)
  } else if (msg.text) {
    await handleTextMessage(msg, venue, guest, supabase)
  }
}

async function handleButtonReply(
  msg: ReturnType<typeof parsePayload> & object,
  venue: Record<string, unknown>,
  guestId: string,
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  const { buttonReplyId, from } = msg as { buttonReplyId: string; from: string }
  const phoneId = venue.whatsapp_phone_number_id as string
  const token = venue.whatsapp_access_token as string

  if (buttonReplyId?.startsWith('review_google_')) {
    const requestId = buttonReplyId.replace('review_google_', '')
    await supabase.from('review_requests').update({ status: 'clicked', clicked_at: new Date().toISOString() }).eq('id', requestId)
    const googleUrl = (venue.settings as Record<string, unknown>)?.google_review_url as string || 'https://search.google.com/local/writereview'
    await sendText(phoneId, token, from, `Thank you! 🙏 Here's your review link:\n${googleUrl}\n\nTakes 30 seconds and means the world to us! ⭐`)
    return
  }

  if (buttonReplyId?.startsWith('review_feedback_')) {
    const requestId = buttonReplyId.replace('review_feedback_', '')
    await supabase.from('review_requests').update({ status: 'clicked', clicked_at: new Date().toISOString() }).eq('id', requestId)
    await sendText(phoneId, token, from, `Thank you! We really value your feedback. 💬\n\nPlease share your thoughts — what did you enjoy, and is there anything we could improve?`)
  }
}

async function handleTextMessage(
  msg: { from: string; text?: string; messageId: string },
  venue: Record<string, unknown>,
  guest: { id: string; name?: string | null; loyalty_tier?: string | null; loyalty_points?: number | null },
  supabase: Awaited<ReturnType<typeof createAdminClient>>
) {
  if (!msg.text) return

  const venueId = venue.id as string
  const phoneId = venue.whatsapp_phone_number_id as string
  const token = venue.whatsapp_access_token as string

  // Reuse the open thread so the assistant has context; otherwise start one.
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('venue_id', venueId)
    .eq('guest_id', guest.id)
    .eq('channel', 'whatsapp')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) {
    const { data } = await supabase
      .from('conversations')
      .insert({
        venue_id: venueId,
        guest_id: guest.id,
        channel: 'whatsapp',
        status: 'open',
        ai_handled: true,
        context: {},
      })
      .select()
      .single()
    conversation = data
  }
  if (!conversation) return

  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('sent_at', { ascending: false })
    .limit(10)

  const turns: ConversationTurn[] = (history ?? [])
    .reverse()
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const venueContext = buildVenueContext({
    id: venueId,
    name: venue.name as string,
    type: venue.type as string | null,
    city: venue.city as string | null,
    address: venue.address as string | null,
    settings: venue.settings,
  })

  const result = await handleGuestMessage({
    message: msg.text,
    venue: venueContext,
    guest: {
      id: guest.id,
      name: guest.name,
      tier: guest.loyalty_tier,
      points: guest.loyalty_points,
    },
    history: turns,
  })

  // Store the guest's message either way — losing it because the assistant
  // was unavailable would leave the team with no record of what was asked.
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    venue_id: venueId,
    role: 'user',
    content: msg.text,
    channel_message_id: msg.messageId,
    sent_at: new Date().toISOString(),
    metadata: {},
    intent: result.ok ? result.data.intent : null,
    sentiment: result.ok ? result.data.sentiment : null,
  })

  if (!result.ok) {
    // No assistant available: hand the guest to a person rather than ignoring them.
    await escalateConversation({
      venueId,
      conversationId: conversation.id,
      reason:
        result.reason === 'not_configured'
          ? 'Assistant is not configured, so this message was not answered'
          : `Assistant could not reply: ${result.message}`,
      guestLabel: guest.name ?? msg.from,
      lastMessage: msg.text,
    })
    return
  }

  const reply = result.data

  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    venue_id: venueId,
    role: 'assistant',
    content: reply.message,
    sent_at: new Date().toISOString(),
    metadata: { model: DEFAULT_MODEL },
    intent: reply.intent,
    sentiment: reply.sentiment,
  })

  await sendText(phoneId, token, msg.from, reply.message)

  // A reservation is only ever captured, never confirmed.
  if (reply.reservation) {
    await captureReservationRequest({
      venueId,
      guestId: guest.id,
      guestName: guest.name,
      guestPhone: msg.from,
      details: reply.reservation,
      sourceMessage: msg.text,
      channel: 'whatsapp',
    })
  }

  if (reply.shouldEscalate) {
    await escalateConversation({
      venueId,
      conversationId: conversation.id,
      reason: reply.escalationReason ?? 'Guest needs a member of the team',
      guestLabel: guest.name ?? msg.from,
      lastMessage: msg.text,
      sentiment: reply.sentiment,
    })
  }
}
