/**
 * Twilio WhatsApp outbound messaging service.
 * Uses Twilio REST API directly — no SDK needed.
 *
 * Sandbox setup (free, instant):
 *   1. twilio.com/console → Messaging → Try it out → Send a WhatsApp message
 *   2. Guest sends "join <your-keyword>" to whatsapp:+14155238886
 *   3. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN in .env.local
 *
 * Without env vars: stubs to console (dev-safe).
 */

import { createClient } from '@supabase/supabase-js'

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

interface SendResult {
  ok: boolean
  sid?: string
  error?: string
  stub?: boolean
}

// ── Core send ──────────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM || '+14155238886'

  if (!accountSid || !authToken) {
    // Dev stub — log only, never fail
    console.log(`[Twilio stub] → ${to} | ${body.slice(0, 80)}…`)
    return { ok: true, sid: 'stub', stub: true }
  }

  // Normalize to whatsapp: prefix
  const toNum   = to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`
  const fromNum = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: fromNum, To: toNum, Body: body }).toString(),
      }
    )

    const data = await res.json() as { sid?: string; message?: string }

    if (!res.ok) {
      console.error('[Twilio] send failed:', data)
      return { ok: false, error: data.message || `HTTP ${res.status}` }
    }

    return { ok: true, sid: data.sid }
  } catch (err) {
    console.error('[Twilio] send error:', err)
    return { ok: false, error: String(err) }
  }
}

// ── Message log ────────────────────────────────────────────────────────────────

async function logMessage(params: {
  venueId:      string
  guestId?:     string
  phone:        string
  messageType:  MessageType
  body:         string
  status:       MessageStatus
  twilioSid?:   string
  errorMessage?: string
}) {
  try {
    const supabase = getAdminClient()
    await supabase.from('whatsapp_messages').insert({
      venue_id:      params.venueId,
      guest_id:      params.guestId   || null,
      phone:         params.phone,
      message_type:  params.messageType,
      body:          params.body,
      status:        params.status,
      twilio_sid:    params.twilioSid  || null,
      error_message: params.errorMessage || null,
    })
  } catch (err) {
    console.error('[Twilio] log error:', err)
  }
}

// ── Loyalty welcome ────────────────────────────────────────────────────────────

export async function sendLoyaltyWelcome(params: {
  phone:     string
  guestName: string
  venueName: string
  points:    number
  memberId:  string
  venueId:   string
  guestId?:  string
}): Promise<SendResult> {
  const { phone, guestName, venueName, points, memberId, venueId, guestId } = params
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const cardUrl   = `${appUrl}/loyalty/${memberId}`
  const firstName = guestName.split(' ')[0]

  const body =
    `🎉 *Welcome to ${venueName} Loyalty!*\n\n` +
    `Hi ${firstName}, you are now an official member of our loyalty programme.\n\n` +
    `🥉 *Status:* Bronze Member\n` +
    `🎁 *Welcome bonus:* ${points} points added to your card\n\n` +
    `📱 *Your loyalty card:*\n${cardUrl}\n\n` +
    `*How to earn more points:*\n` +
    `• 10 pts per €1 spent\n` +
    `• +50 pts for leaving a review\n` +
    `• +200 pts on your birthday\n\n` +
    `We look forward to welcoming you again soon! 🍽️\n` +
    `— The ${venueName} Team`

  const result = await sendWhatsAppMessage(phone, body)

  await logMessage({
    venueId,
    guestId,
    phone,
    messageType:  'loyalty_welcome',
    body,
    status:       result.ok ? 'sent' : 'failed',
    twilioSid:    result.sid,
    errorMessage: result.error,
  })

  return result
}

// ── Review request ─────────────────────────────────────────────────────────────

export async function sendReviewRequest(params: {
  phone:       string
  guestName:   string
  venueName:   string
  feedbackUrl: string
  venueId:     string
  guestId?:    string
}): Promise<SendResult> {
  const { phone, guestName, venueName, feedbackUrl, venueId, guestId } = params
  const firstName = guestName.split(' ')[0]

  const body =
    `⭐ *Thank you for visiting ${venueName}!*\n\n` +
    `Hi ${firstName}, we hope you had a wonderful experience with us.\n\n` +
    `We would love to hear your thoughts — your feedback helps us improve and serve you better.\n\n` +
    `📝 *Share your feedback* (takes 60 seconds):\n${feedbackUrl}\n\n` +
    `Thank you for your support — it means the world to us! 🙏\n` +
    `— The ${venueName} Team`

  const result = await sendWhatsAppMessage(phone, body)

  await logMessage({
    venueId,
    guestId,
    phone,
    messageType:  'review_request',
    body,
    status:       result.ok ? 'sent' : 'failed',
    twilioSid:    result.sid,
    errorMessage: result.error,
  })

  return result
}
