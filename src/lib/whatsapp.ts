import { isDemoVenue, logSuppressed } from '@/lib/demo'

const GRAPH_API = 'https://graph.facebook.com/v18.0'

// ─── Send text ────────────────────────────────────────────────
export async function sendText(
  phoneNumberId: string, token: string, to: string, text: string,
  /** Pass this. It is what stops a demo venue messaging invented guests. */
  venueId?: string
) {
  return call(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  }, venueId, to)
}

// ─── Send interactive (buttons) ───────────────────────────────
export async function sendInteractive(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string,
  /** Pass this. It is what stops a demo venue messaging invented guests. */
  venueId?: string
) {
  return call(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      ...(footerText && { footer: { text: footerText } }),
      action: {
        buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  }, venueId, to)
}

// ─── Mark read ────────────────────────────────────────────────
export async function markRead(phoneNumberId: string, token: string, messageId: string) {
  return call(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

// ─── Verify webhook ───────────────────────────────────────────
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken && challenge) return challenge
  return null
}

// ─── Parse inbound payload ────────────────────────────────────
export interface InboundMessage {
  messageId: string
  from: string
  type: 'text' | 'interactive' | 'unknown'
  text?: string
  buttonReplyId?: string
  buttonReplyTitle?: string
  phoneNumberId: string
  timestamp: number
}

export function parsePayload(payload: Record<string, unknown>): InboundMessage | null {
  try {
    const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown>
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value = change?.value as Record<string, unknown>
    const messages = value?.messages as unknown[]
    if (!messages?.length) return null

    const msg = messages[0] as Record<string, unknown>
    const meta = value.metadata as Record<string, unknown>

    const base = {
      messageId: msg.id as string,
      from: msg.from as string,
      phoneNumberId: meta?.phone_number_id as string,
      timestamp: parseInt(msg.timestamp as string, 10),
    }

    if (msg.type === 'text') {
      return { ...base, type: 'text', text: (msg.text as Record<string,unknown>)?.body as string }
    }
    if (msg.type === 'interactive') {
      const i = msg.interactive as Record<string, unknown>
      if (i.type === 'button_reply') {
        const r = i.button_reply as Record<string, unknown>
        return { ...base, type: 'interactive', buttonReplyId: r.id as string, buttonReplyTitle: r.title as string }
      }
    }
    return { ...base, type: 'unknown' }
  } catch { return null }
}

// ─── Internal fetch ───────────────────────────────────────────
async function call(phoneNumberId: string, token: string, body: unknown, venueId?: string, to = '') {
  // Every outbound message in this module passes through here, which is why
  // the demo check sits at this level rather than in each of the five callers.
  if (await isDemoVenue(venueId)) {
    logSuppressed('whatsapp', venueId!, to)
    return { messages: [{ id: 'stub' }], stub: true }
  }

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`)
  return res.json()
}
