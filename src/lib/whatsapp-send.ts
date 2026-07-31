/**
 * Outbound WhatsApp messaging via Meta Cloud API.
 *
 * Replaces the Twilio path (src/lib/twilio.ts). Two modes:
 *   - Platform credentials (env)   → used for our own test/demo number
 *   - Per-venue credentials (DB)   → each client venue brings its own number
 *
 * Business-initiated messages (welcome, review request) must use an APPROVED
 * TEMPLATE. Free-form text only works inside the 24h customer service window,
 * i.e. after the guest messages us first.
 *
 * Without credentials configured: stubs to console (dev-safe, never throws).
 */

import { createClient } from '@supabase/supabase-js'
import { tryWrite } from '@/lib/db'
import { sendText } from './whatsapp'
import { isDemoSettings } from '@/lib/demo'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type MessageType = 'loyalty_welcome' | 'review_request' | 'campaign' | 'manual' | 'reservation_confirmed'
export type MessageStatus = 'sent' | 'failed' | 'delivered' | 'read'

export interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
  stub?: boolean
}

interface Credentials {
  phoneNumberId: string
  accessToken: string
}

// ── Credential resolution ──────────────────────────────────────────────────────

/**
 * Venue-specific credentials win; platform env vars are the fallback so the
 * demo/test number keeps working before any venue is onboarded.
 */
export async function resolveCredentials(venueId?: string): Promise<Credentials | null> {
  if (venueId) {
    try {
      const supabase = getAdminClient()
      const { data } = await supabase
        .from('venues')
        .select('whatsapp_phone_number_id, whatsapp_access_token, settings')
        .eq('id', venueId)
        .single()

      const v = data as {
        whatsapp_phone_number_id?: string
        whatsapp_access_token?: string
        settings?: Record<string, unknown>
      } | null

      // A demo venue never sends. Its guests are invented, so every message is
      // at best wasted quota and at worst a real message to a stranger whose
      // number the fixture happened to land on.
      //
      // The guard belongs here rather than in each dispatcher because this is
      // the single point every outbound WhatsApp passes through — review
      // requests, campaigns and automation actions alike. Returning null makes
      // the send a logged stub.
      //
      // Learned the hard way: seeding the Golden Demo Venue put 446 review
      // requests in the queue and the dispatcher sent all of them to Meta,
      // which rejected them as "not in allowed list". On a venue with a
      // verified number they would have gone out.
      if (isDemoSettings(v?.settings)) {
        console.log(`[whatsapp] suppressed — venue ${venueId} is a demo venue`)
        return null
      }

      if (v?.whatsapp_phone_number_id && v?.whatsapp_access_token) {
        return { phoneNumberId: v.whatsapp_phone_number_id, accessToken: v.whatsapp_access_token }
      }
    } catch (err) {
      console.error('[whatsapp] venue credential lookup failed:', err)
    }
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN
  if (phoneNumberId && accessToken) return { phoneNumberId, accessToken }

  return null
}

/** Meta expects digits only — no '+', no spaces, no dashes. */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

// ── Template send (business-initiated) ─────────────────────────────────────────

export async function sendTemplate(params: {
  to: string
  templateName: string
  languageCode?: string
  bodyParams?: string[]
  /** Fills the {{1}} placeholder in a dynamic URL button (the path suffix). */
  urlButtonParam?: string
  venueId?: string
}): Promise<SendResult> {
  const { to, templateName, languageCode = 'en_US', bodyParams = [], urlButtonParam, venueId } = params

  const creds = await resolveCredentials(venueId)
  if (!creds) {
    console.log(`[WhatsApp stub] template "${templateName}" → ${to}`)
    return { ok: true, messageId: 'stub', stub: true }
  }

  const components: Record<string, unknown>[] = []
  if (bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(text => ({ type: 'text', text })),
    })
  }
  if (urlButtonParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlButtonParam }],
    })
  }

  try {
    const res = await fetch(`${GRAPH_API}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components.length && { components }),
        },
      }),
    })

    const data = await res.json() as {
      messages?: Array<{ id: string }>
      error?: { message: string }
    }

    if (!res.ok) {
      console.error('[WhatsApp] template send failed:', data.error)
      return { ok: false, error: data.error?.message || `HTTP ${res.status}` }
    }

    return { ok: true, messageId: data.messages?.[0]?.id }
  } catch (err) {
    console.error('[WhatsApp] template send error:', err)
    return { ok: false, error: String(err) }
  }
}

// ── Free-form send (only valid inside the 24h service window) ──────────────────

export async function sendFreeform(params: {
  to: string
  body: string
  venueId?: string
}): Promise<SendResult> {
  const creds = await resolveCredentials(params.venueId)
  if (!creds) {
    console.log(`[WhatsApp stub] → ${params.to} | ${params.body.slice(0, 60)}…`)
    return { ok: true, messageId: 'stub', stub: true }
  }

  try {
    const data = await sendText(
      creds.phoneNumberId,
      creds.accessToken,
      normalizePhone(params.to),
      params.body,
      params.venueId
    ) as { messages?: Array<{ id: string }> }
    return { ok: true, messageId: data.messages?.[0]?.id }
  } catch (err) {
    console.error('[WhatsApp] freeform send error:', err)
    return { ok: false, error: String(err) }
  }
}

// ── Business-initiated flows (approved templates) ──────────────────────────────

/**
 * Sent right after a guest enrolls via the QR signup.
 * Template `loyalty_welcome`: body {{1}} first name, {{2}} venue, {{3}} points;
 * URL button suffix {{1}} = memberId.
 */
export async function sendLoyaltyWelcome(params: {
  phone: string
  guestName: string
  venueName: string
  points: number
  memberId: string
  venueId: string
  guestId?: string
}): Promise<SendResult> {
  const { phone, guestName, venueName, points, memberId, venueId, guestId } = params
  const firstName = guestName.split(' ')[0] || 'there'

  const result = await sendTemplate({
    to: phone,
    templateName: 'loyalty_welcome',
    bodyParams: [firstName, venueName, String(points)],
    urlButtonParam: memberId,
    venueId,
  })

  await logMessage({
    venueId,
    guestId,
    phone,
    messageType:       'loyalty_welcome',
    body:              `[loyalty_welcome] ${firstName} · ${venueName} · ${points} pts`,
    status:            result.ok ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage:      result.error,
    stub:              result.stub,
  })

  return result
}

/**
 * Sent after a visit to invite feedback.
 * Template `review_request`: body {{1}} first name, {{2}} venue;
 * URL button suffix {{1}} = reviewRequestId.
 */
export async function sendReviewRequest(params: {
  phone: string
  guestName: string
  venueName: string
  requestId: string
  venueId: string
  guestId?: string
}): Promise<SendResult> {
  const { phone, guestName, venueName, requestId, venueId, guestId } = params
  const firstName = guestName.split(' ')[0] || 'there'

  const result = await sendTemplate({
    to: phone,
    templateName: 'review_request',
    bodyParams: [firstName, venueName],
    urlButtonParam: requestId,
    venueId,
  })

  await logMessage({
    venueId,
    guestId,
    phone,
    messageType:       'review_request',
    body:              `[review_request] ${firstName} · ${venueName}`,
    status:            result.ok ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage:      result.error,
    stub:              result.stub,
  })

  return result
}

/**
 * Tells a guest their table is booked.
 *
 * Sent free-form rather than as an approved template, because it is a reply
 * inside a conversation the guest started — they asked for a table, so the
 * 24-hour service window is open. If a venue later takes bookings from a
 * channel where that is not true, this needs a template.
 *
 * Transactional, so it deliberately ignores marketing opt-out: someone who
 * asked for a table has asked to be told whether they have one.
 */
export async function sendReservationConfirmed(params: {
  phone: string
  guestName?: string | null
  venueName: string
  date: string
  time: string
  partySize: number
  venueId: string
  guestId?: string
}): Promise<SendResult> {
  const { phone, guestName, venueName, date, time, partySize, venueId, guestId } = params
  const firstName = guestName?.split(' ')[0] || 'there'
  const body =
    `Hi ${firstName}, your table at ${venueName} is confirmed ✅\n\n` +
    `${date} at ${time} · ${partySize} ${partySize === 1 ? 'guest' : 'guests'}\n\n` +
    `Reply here if anything changes and we will sort it out.`

  const result = await sendFreeform({ to: phone, body, venueId })

  await logMessage({
    venueId,
    guestId,
    phone,
    messageType:       'reservation_confirmed',
    body,
    status:            result.ok ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage:      result.error,
    stub:              result.stub,
  })

  return result
}

// ── Message log ────────────────────────────────────────────────────────────────

export async function logMessage(params: {
  venueId: string
  guestId?: string
  phone: string
  messageType: MessageType
  body: string
  status: MessageStatus
  providerMessageId?: string
  errorMessage?: string
  /** True when no message actually left the building. */
  stub?: boolean
}) {
  // A stubbed send is one that did not happen — no credentials, or a demo
  // venue. Recording it as 'sent' would fill the venue's message log with
  // messages no guest ever received, which is worse than having no log: the
  // owner would believe those guests had been contacted.
  if (params.stub) return

  try {
    const supabase = getAdminClient()
    // tryWrite, not a bare await: PostgREST failures resolve with { error }
    // rather than throwing, so the catch below never fires for them.
    await tryWrite('whatsapp: message log', supabase.from('whatsapp_messages').insert({
      venue_id:      params.venueId,
      guest_id:      params.guestId || null,
      phone:         params.phone,
      message_type:  params.messageType,
      body:          params.body,
      status:        params.status,
      twilio_sid:    params.providerMessageId || null,
      error_message: params.errorMessage || null,
    }))
  } catch (err) {
    console.error('[WhatsApp] log error:', err)
  }
}
