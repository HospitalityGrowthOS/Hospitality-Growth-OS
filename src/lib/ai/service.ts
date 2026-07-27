/**
 * Public AI service.
 *
 * These are the only AI entry points the rest of the app should call. Nothing
 * here writes to the database except where the operation is inherently a
 * persistence step (reservation capture, escalation), so callers stay in
 * control of transactions and ordering.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { callModel, isAiConfigured } from './client'
import {
  ANALYSIS_SYSTEM,
  SUMMARY_SYSTEM,
  analysisUserPrompt,
  guestReplySystem,
  reviewReplySystem,
  reviewReplyUserPrompt,
} from './prompts'
import {
  aiFailure,
  isIntent,
  isSentiment,
  type AiResult,
  type AssistantReply,
  type ConversationTurn,
  type GuestContext,
  type Intent,
  type MessageAnalysis,
  type ReservationDetails,
  type Sentiment,
  type VenueContext,
} from './types'

export { isAiConfigured }

/** Conservative default when the model is unavailable or unparseable. */
const NEUTRAL_ANALYSIS: MessageAnalysis = {
  intent: 'unknown',
  sentiment: 'neutral',
  shouldEscalate: false,
  escalationReason: null,
  reservation: null,
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function parseAnalysis(raw: string): MessageAnalysis | null {
  // Models occasionally wrap JSON in a fence despite instructions.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const o = parsed as Record<string, unknown>

  const intent: Intent =
    typeof o.intent === 'string' && isIntent(o.intent) ? o.intent : 'unknown'
  const sentiment: Sentiment =
    typeof o.sentiment === 'string' && isSentiment(o.sentiment) ? o.sentiment : 'neutral'

  let reservation: ReservationDetails | null = null
  if (intent === 'reservation' && o.reservation && typeof o.reservation === 'object') {
    const r = o.reservation as Record<string, unknown>
    reservation = {
      date:      typeof r.date === 'string' && r.date ? r.date : null,
      time:      typeof r.time === 'string' && r.time ? r.time : null,
      partySize: typeof r.party_size === 'number' ? r.party_size : null,
      notes:     typeof r.notes === 'string' && r.notes ? r.notes : null,
    }
  }

  // A complaint always warrants a human, whatever the model decided.
  const modelWantsEscalation = o.should_escalate === true
  const shouldEscalate = modelWantsEscalation || intent === 'human_support' || intent === 'complaint'

  return {
    intent,
    sentiment,
    shouldEscalate,
    escalationReason:
      typeof o.escalation_reason === 'string' && o.escalation_reason
        ? o.escalation_reason
        : shouldEscalate
          ? 'Guest needs a member of the team'
          : null,
    reservation,
  }
}

/**
 * Single model call producing every signal we need about a message.
 * classifyIntent and detectSentiment wrap this so asking for one signal does
 * not cost two round trips.
 */
export async function analyzeMessage(params: {
  message: string
  history?: ConversationTurn[]
  venueId?: string
}): Promise<AiResult<MessageAnalysis>> {
  const history = (params.history ?? [])
    .slice(-6)
    .map(turn => `${turn.role === 'user' ? 'Guest' : 'Assistant'}: ${turn.content}`)

  const result = await callModel({
    system: ANALYSIS_SYSTEM,
    messages: [{ role: 'user', content: analysisUserPrompt(params.message, history) }],
    maxTokens: 300,
    feature: 'analyze_message',
    venueId: params.venueId,
  })

  if (!result.ok) return result

  const analysis = parseAnalysis(result.data)
  if (!analysis) {
    return aiFailure('invalid_response', 'Could not parse the analysis response.')
  }
  return { ok: true, data: analysis }
}

/** Classify a guest message into the supported intent taxonomy. */
export async function classifyIntent(params: {
  message: string
  history?: ConversationTurn[]
  venueId?: string
}): Promise<AiResult<Intent>> {
  const result = await analyzeMessage(params)
  return result.ok ? { ok: true, data: result.data.intent } : result
}

/** Determine whether the guest sounds positive, neutral or negative. */
export async function detectSentiment(params: {
  message: string
  history?: ConversationTurn[]
  venueId?: string
}): Promise<AiResult<Sentiment>> {
  const result = await analyzeMessage(params)
  return result.ok ? { ok: true, data: result.data.sentiment } : result
}

/**
 * Whether this exchange should be handed to a person.
 *
 * Deliberately not a model call of its own — escalation is decided during
 * analysis, and a complaint escalates regardless of what the model thought.
 */
export function suggestEscalation(analysis: MessageAnalysis): {
  escalate: boolean
  reason: string | null
} {
  const escalate =
    analysis.shouldEscalate ||
    analysis.intent === 'complaint' ||
    analysis.intent === 'human_support' ||
    analysis.sentiment === 'negative'

  if (!escalate) return { escalate: false, reason: null }

  return {
    escalate: true,
    reason:
      analysis.escalationReason ??
      (analysis.sentiment === 'negative'
        ? 'Guest sounds unhappy'
        : 'Guest needs a member of the team'),
  }
}

// ── Guest replies ─────────────────────────────────────────────────────────────

/**
 * Answer a guest question from venue facts and FAQ entries.
 *
 * The prompt only receives topics that have real answers, so an unknown topic
 * produces "I'll check with the team" rather than an invented one.
 */
export async function answerFAQ(params: {
  message: string
  venue: VenueContext
  guest?: GuestContext
  intent?: Intent
  history?: ConversationTurn[]
}): Promise<AiResult<string>> {
  const intent = params.intent ?? 'general_question'
  const history = (params.history ?? []).slice(-8)

  return callModel({
    system: guestReplySystem(params.venue, params.guest, intent),
    messages: [
      ...history.map(turn => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: params.message },
    ],
    maxTokens: 400,
    feature: 'guest_reply',
    venueId: params.venue.id,
  })
}

/**
 * Full assistant turn: analyse, then reply in a way appropriate to the intent.
 *
 * Persistence is the caller's job — this returns what happened and lets the
 * route decide what to store and in what order.
 */
export async function handleGuestMessage(params: {
  message: string
  venue: VenueContext
  guest?: GuestContext
  history?: ConversationTurn[]
}): Promise<AiResult<AssistantReply>> {
  const analysis = await analyzeMessage({
    message: params.message,
    history: params.history,
    venueId: params.venue.id,
  })
  if (!analysis.ok) return analysis

  const reply = await answerFAQ({
    message: params.message,
    venue: params.venue,
    guest: params.guest,
    intent: analysis.data.intent,
    history: params.history,
  })
  if (!reply.ok) return reply

  const escalation = suggestEscalation(analysis.data)

  return {
    ok: true,
    data: {
      message: reply.data.trim(),
      intent: analysis.data.intent,
      sentiment: analysis.data.sentiment,
      shouldEscalate: escalation.escalate,
      escalationReason: escalation.reason,
      reservation: analysis.data.reservation,
    },
  }
}

// ── Review replies ────────────────────────────────────────────────────────────

/**
 * Draft a public reply to a review. Always a draft — nothing here publishes.
 */
export async function generateReviewReply(params: {
  reviewContent: string
  rating: number
  venueName: string
  ownerName: string
  authorName?: string | null
  venueId?: string
}): Promise<AiResult<string>> {
  const result = await callModel({
    system: reviewReplySystem({
      venueName: params.venueName,
      ownerName: params.ownerName,
      rating: params.rating,
    }),
    messages: [
      {
        role: 'user',
        content: reviewReplyUserPrompt({
          rating: params.rating,
          content: params.reviewContent,
          authorName: params.authorName ?? null,
        }),
      },
    ],
    maxTokens: 400,
    feature: 'review_reply',
    venueId: params.venueId,
  })

  return result.ok ? { ok: true, data: result.data.trim() } : result
}

// ── Conversation summary ──────────────────────────────────────────────────────

/** Summarise a thread for a staff member taking it over. */
export async function summarizeConversation(params: {
  turns: ConversationTurn[]
  venueId?: string
}): Promise<AiResult<string>> {
  if (!params.turns.length) {
    return aiFailure('invalid_response', 'There are no messages to summarise.')
  }

  const transcript = params.turns
    .map(t => `${t.role === 'user' ? 'Guest' : 'Assistant'}: ${t.content}`)
    .join('\n')

  const result = await callModel({
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: transcript }],
    maxTokens: 250,
    feature: 'summarize_conversation',
    venueId: params.venueId,
  })

  return result.ok ? { ok: true, data: result.data.trim() } : result
}

// ── Reservation capture ───────────────────────────────────────────────────────

/**
 * Records a reservation request as Pending. No availability is checked and no
 * booking system is contacted — a person or a future integration processes it.
 *
 * Returns null (rather than throwing) if the table is not yet present, so a
 * missing migration degrades capture instead of breaking the conversation.
 */
export async function captureReservationRequest(params: {
  venueId: string
  guestId?: string | null
  guestName?: string | null
  guestPhone?: string | null
  details: ReservationDetails
  sourceMessage: string
  channel?: string
}): Promise<string | null> {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('reservation_requests')
      .insert({
        venue_id:       params.venueId,
        guest_id:       params.guestId ?? null,
        guest_name:     params.guestName ?? null,
        guest_phone:    params.guestPhone ?? null,
        requested_date: params.details.date,
        requested_time: params.details.time,
        party_size:     params.details.partySize,
        notes:          params.details.notes,
        source_message: params.sourceMessage,
        channel:        params.channel ?? 'whatsapp',
        status:         'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ai] reservation capture failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.error('[ai] reservation capture error:', err)
    return null
  }
}

// ── Escalation ────────────────────────────────────────────────────────────────

/**
 * Raises the conversation to the team: flags it and puts an item on the
 * dashboard. Non-fatal — an assistant that answered the guest should not fail
 * because the follow-up item could not be written.
 */
export async function escalateConversation(params: {
  venueId: string
  conversationId?: string | null
  reason: string
  guestLabel?: string | null
  lastMessage?: string
  sentiment?: Sentiment
}): Promise<void> {
  try {
    const supabase = await createAdminClient()
    const who = params.guestLabel || 'A guest'

    await Promise.all([
      params.conversationId
        ? supabase
            .from('conversations')
            .update({
              status: 'escalated',
              human_takeover_at: new Date().toISOString(),
            })
            .eq('id', params.conversationId)
        : Promise.resolve(),

      supabase.from('action_items').insert({
        venue_id: params.venueId,
        title: `${who} needs a reply`,
        description: params.lastMessage
          ? `${params.reason}. Last message: "${params.lastMessage.slice(0, 240)}"`
          : params.reason,
        type: 'conversation_escalation',
        priority: params.sentiment === 'negative' ? 'high' : 'medium',
        status: 'pending',
        related_id: params.conversationId ?? null,
        related_type: 'conversation',
      }),
    ])
  } catch (err) {
    console.error('[ai] escalation failed:', err)
  }
}
