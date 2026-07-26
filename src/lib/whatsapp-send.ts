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
import { sendText } from './whatsapp'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type MessageType = 'loyalty_welcome' | 'review_request' | 'campaign' | 'manual'
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
        .select('whatsapp_phone_number_id, whatsapp_access_token')
        .eq('id', venueId)
        .single()

      const v = data as { whatsapp_phone_number_id?: string; whatsapp_access_token?: string } | null
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
      params.body
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
}) {
  try {
    const supabase = getAdminClient()
    await supabase.from('whatsapp_messages').insert({
      venue_id:      params.venueId,
      guest_id:      params.guestId || null,
      phone:         params.phone,
      message_type:  params.messageType,
      body:          params.body,
      status:        params.status,
      twilio_sid:    params.providerMessageId || null,
      error_message: params.errorMessage || null,
    })
  } catch (err) {
    console.error('[WhatsApp] log error:', err)
  }
}
