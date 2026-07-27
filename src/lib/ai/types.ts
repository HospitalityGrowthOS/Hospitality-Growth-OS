/**
 * Shared types for the AI service layer.
 *
 * Nothing here imports the model client, so these can be used from UI code
 * without pulling the SDK into a client bundle.
 */

// ── Intent taxonomy ───────────────────────────────────────────────────────────

export const INTENTS = [
  'loyalty_points',
  'rewards',
  'reservation',
  'opening_hours',
  'menu_question',
  'complaint',
  'review',
  'general_question',
  'human_support',
  'unknown',
] as const

export type Intent = (typeof INTENTS)[number]

/** Human-readable labels for dashboard display. */
export const INTENT_LABELS: Record<Intent, string> = {
  loyalty_points:   'Loyalty points',
  rewards:          'Rewards',
  reservation:      'Reservation',
  opening_hours:    'Opening hours',
  menu_question:    'Menu question',
  complaint:        'Complaint',
  review:           'Review',
  general_question: 'General question',
  human_support:    'Human support',
  unknown:          'Unknown',
}

export function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value)
}

// ── Sentiment ─────────────────────────────────────────────────────────────────

export const SENTIMENTS = ['positive', 'neutral', 'negative'] as const
export type Sentiment = (typeof SENTIMENTS)[number]

export function isSentiment(value: string): value is Sentiment {
  return (SENTIMENTS as readonly string[]).includes(value)
}

// ── Results ───────────────────────────────────────────────────────────────────

/**
 * Every AI function returns this rather than throwing, so a missing API key or
 * a provider outage degrades the feature instead of breaking the request.
 */
export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AiFailureReason; message: string }

export type AiFailureReason = 'not_configured' | 'provider_error' | 'invalid_response'

export function aiFailure<T>(reason: AiFailureReason, message: string): AiResult<T> {
  return { ok: false, reason, message }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export interface ReservationDetails {
  /** ISO date (YYYY-MM-DD) if the guest named one. */
  date: string | null
  /** 24h time (HH:MM) if the guest named one. */
  time: string | null
  partySize: number | null
  notes: string | null
}

/**
 * Produced by a single model call. classifyIntent() and detectSentiment() are
 * thin wrappers over this so callers can ask for one signal without paying for
 * two round trips.
 */
export interface MessageAnalysis {
  intent: Intent
  sentiment: Sentiment
  /** True when the guest should be handed to a person. */
  shouldEscalate: boolean
  /** Short reason for the escalation, for the action item. */
  escalationReason: string | null
  /** Present only when intent is `reservation`. */
  reservation: ReservationDetails | null
}

// ── Venue context ─────────────────────────────────────────────────────────────

/** The venue facts the assistant is allowed to state. */
export interface VenueContext {
  id: string
  name: string
  type: string | null
  city: string | null
  address: string | null
  assistantName: string
  /** Resolved FAQ answers; missing entries are omitted rather than invented. */
  faq: Record<string, string>
}

/** Optional guest facts, used to personalise replies. */
export interface GuestContext {
  id?: string
  name?: string | null
  tier?: string | null
  points?: number | null
}

// ── Conversation ──────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantReply {
  message: string
  intent: Intent
  sentiment: Sentiment
  shouldEscalate: boolean
  escalationReason: string | null
  reservation: ReservationDetails | null
}

// ── Channels ──────────────────────────────────────────────────────────────────

export type ChannelName = 'whatsapp' | 'email' | 'web' | 'voice' | 'n8n'

export interface OutboundMessage {
  to: string
  body: string
  venueId: string
  guestId?: string
}

export interface ChannelSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * Implemented per channel so the assistant never needs to know how a message
 * is delivered. Only WhatsApp is wired up today; the rest are declared so
 * adding them is an implementation, not a refactor.
 */
export interface ChannelAdapter {
  name: ChannelName
  /** False when the channel exists but isn't usable yet. */
  isAvailable(): boolean
  send(message: OutboundMessage): Promise<ChannelSendResult>
}
