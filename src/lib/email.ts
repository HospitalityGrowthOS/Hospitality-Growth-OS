import { toNextTier, DEFAULT_TIER_THRESHOLDS, type TierThresholds } from '@/lib/tiers'
import { isDemoVenue, logSuppressed } from '@/lib/demo'
/**
 * Email utility — Resend REST API.
 * Set RESEND_API_KEY in .env.local to send real emails.
 * Without it: logs to console only (dev stub).
 *
 * Free tier: resend.com — 3,000 emails/month, no CC needed.
 *
 * QR images use api.qrserver.com (hosted URL) — Gmail blocks base64 data URIs.
 */

interface LoyaltyWelcomeEmailProps {
  to: string
  name: string
  venueName: string
  points: number
  tier: string
  qrCode: string
  memberId: string
  /** Venue's currency symbol. Defaults to euro so existing callers keep working. */
  currencySym?: string
  /** The venue's own thresholds. Without these the mail quoted a hardcoded 500. */
  thresholds?: TierThresholds
  /** Pass this. A demo venue's guest addresses look real and may belong to someone. */
  venueId?: string
}

export interface EmailResult {
  ok: boolean
  /** True when nothing left the building — no API key, or a demo venue. */
  stub?: boolean
  /** Provider message id. Without it a send cannot be traced past acceptance. */
  id?: string
  error?: string
}

/**
 * The one place mail is actually sent.
 *
 * Both callers route through here so the demo guard and the stub contract
 * cannot drift apart between them — the guard existing on one mail and not the
 * other is exactly the kind of gap that let the platform message invented
 * guests over WhatsApp.
 */
async function deliver(params: {
  to: string
  subject: string
  html: string
  venueId?: string
}): Promise<EmailResult> {
  const { to, subject, html, venueId } = params

  if (await isDemoVenue(venueId)) {
    logSuppressed('email', venueId!, to)
    return { ok: true, stub: true }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[Email stub] → ${to} | Subject: ${subject}`)
    return { ok: true, stub: true }
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
      return { ok: false, error: err }
    }
    // Accepted is not delivered. Keeping the id is the only way to answer
    // "did it actually arrive?" later — the provider knows, we did not ask.
    const body = await res.json().catch(() => ({}))
    return { ok: true, id: (body as { id?: string }).id }
  } catch (err) {
    console.error('[email] Send failed:', err)
    return { ok: false, error: String(err) }
  }
}

/**
 * Asks a guest how their visit went, over email.
 *
 * The counterpart of the WhatsApp `review_request` template, for guests who
 * never opted into WhatsApp — 16 of 164 in the Golden Demo Venue, who until now
 * the product could not reach by any route it could actually use.
 *
 * The link is the same `/feedback/[requestId]` page the WhatsApp button opens,
 * so a reply arrives through one lifecycle regardless of how it was asked for.
 */
export async function sendReviewRequestEmail(params: {
  to: string
  guestName?: string | null
  venueName: string
  requestId: string
  venueId: string
}): Promise<EmailResult> {
  const { to, guestName, venueName, requestId, venueId } = params
  const firstName = guestName?.split(' ')[0] || 'there'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const link = `${appUrl}/feedback/${requestId}`

  return deliver({
    to,
    venueId,
    subject: `How was your visit to ${venueName}?`,
    html: buildFeedbackHtml({ firstName, venueName, link }),
  })
}

/** Deliberately plain: one question, one button, nothing to unsubscribe from. */
function buildFeedbackHtml(p: { firstName: string; venueName: string; link: string }): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EF;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 16px;font-size:16px;color:#1A1510;">Hi ${escapeHtml(p.firstName)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A4038;">
            Thanks for visiting <strong>${escapeHtml(p.venueName)}</strong>. How did we do? It takes
            about thirty seconds and it genuinely helps a small business like ours.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td style="border-radius:8px;background:#1A1510;">
              <a href="${p.link}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                Leave feedback
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#8A7F74;">
            If the button does not work, paste this into your browser:<br>
            <span style="color:#6B5F56;word-break:break-all;">${p.link}</span>
          </p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#8A7F74;">Sent by ${escapeHtml(p.venueName)}</p>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const TIER_EMOJI: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' }
const TIER_LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

export async function sendLoyaltyWelcomeEmail(props: LoyaltyWelcomeEmailProps): Promise<EmailResult> {
  const { to, name, venueName, points, tier, qrCode, memberId, currencySym = '€', thresholds, venueId } = props
  const firstName = name.split(' ')[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const cardUrl = `${appUrl}/loyalty/${memberId}`
  // Was a hardcoded 500, which contradicted whatever the venue had configured
  // — the guest was told a target they were not actually measured against.
  const next = toNextTier(points, thresholds ?? DEFAULT_TIER_THRESHOLDS)
  const pointsToSilver = next?.remaining ?? 0

  // Use hosted QR URL — Gmail blocks base64 data URIs
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=1A1510&bgcolor=FFFFFF&qzone=2&data=${encodeURIComponent(cardUrl)}`

  const html = buildEmailHtml({
    firstName, name, venueName, points, tier, qrCode, cardUrl, qrImageUrl, pointsToSilver,
    currencySym,
  })

  // The demo guard, the stub contract and the Resend call all live in deliver()
  // so the two mails cannot drift apart — a guard present on one and missing
  // from the other is how the platform ended up messaging invented guests.
  return deliver({
    to,
    venueId,
    subject: `Welcome to ${venueName} Loyalty! You earned ${points} points 🎉`,
    html,
  })
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildEmailHtml(p: {
  firstName: string
  name: string
  venueName: string
  points: number
  tier: string
  qrCode: string
  cardUrl: string
  qrImageUrl: string
  pointsToSilver: number
  currencySym: string
}) {
  const emoji = TIER_EMOJI[p.tier] ?? '🥉'
  const tierLabel = TIER_LABEL[p.tier] ?? 'Bronze'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to ${p.venueName} Loyalty</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;">
  <tr><td align="center" style="padding:40px 16px;">
  <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

    <!-- Logo -->
    <tr><td align="center" style="padding-bottom:28px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="background:#E85D26;width:32px;height:32px;border-radius:8px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:white;padding:0 8px;">H</td>
        <td style="padding-left:10px;font-family:Georgia,serif;font-size:16px;font-weight:600;color:#1A1510;vertical-align:middle;">${p.venueName}</td>
      </tr></table>
    </td></tr>

    <!-- Headline -->
    <tr><td align="center" style="padding-bottom:6px;">
      <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;color:#1A1510;font-weight:700;">Welcome, ${p.firstName}! 🎉</h1>
    </td></tr>
    <tr><td align="center" style="padding-bottom:28px;">
      <p style="margin:0;color:#6B5F56;font-size:14px;line-height:1.5;">You're now a member of <strong style="color:#1A1510;">${p.venueName}</strong>.<br>Your loyalty card is ready.</p>
    </td></tr>

    <!-- Membership Card -->
    <tr><td style="padding-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1510;border-radius:16px;">
        <tr><td style="padding:24px 24px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 3px;font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.35);font-weight:600;">Member</p>
                <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:600;color:#FFFFFF;">${p.name}</p>
              </td>
              <td align="right" valign="top">
                <span style="font-size:22px;">${emoji}</span><br>
                <span style="font-size:10px;color:rgba(255,255,255,0.45);">${tierLabel}</span>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr>
              <td>
                <p style="margin:0 0 3px;font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.35);font-weight:600;">Points Balance</p>
                <p style="margin:0;font-size:42px;font-weight:700;color:#C8A45A;font-family:monospace;line-height:1;">${p.points}</p>
              </td>
              <td align="right" valign="bottom">
                <p style="margin:0 0 3px;font-size:9px;color:rgba(255,255,255,0.35);text-align:right;">Welcome bonus</p>
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);font-family:monospace;text-align:right;">+${p.points} pts</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;">
            <tr><td>
              <p style="margin:0;font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:3px;font-family:monospace;">${p.qrCode}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <!-- QR Code -->
    <tr><td style="padding-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E8E0D4;">
        <tr><td align="center" style="padding:24px;">
          <p style="margin:0 0 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#6B5F56;">Your Loyalty QR Code</p>
          <img src="${p.qrImageUrl}" alt="Loyalty QR" width="160" height="160" style="display:block;margin:0 auto;border-radius:8px;">
          <p style="margin:14px 0 0;font-size:12px;color:#6B5F56;line-height:1.5;">Show this at <strong style="color:#1A1510;">${p.venueName}</strong> to earn &amp; redeem points</p>
        </td></tr>
      </table>
    </td></tr>

    ${p.pointsToSilver > 0 ? `
    <!-- Progress -->
    <tr><td style="padding-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E8E0D4;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A1510;">🥈 ${p.pointsToSilver} more points to Silver</p>
          <p style="margin:0;font-size:11px;color:#6B5F56;">Visit &amp; spend to earn 10 pts per ${p.currencySym}1</p>
        </td></tr>
      </table>
    </td></tr>` : `
    <tr><td style="padding-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#C8A45A14;border-radius:12px;border:1px solid #C8A45A40;">
        <tr><td align="center" style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1A1510;">🥇 You've reached Gold status!</p>
        </td></tr>
      </table>
    </td></tr>`}

    <!-- CTA -->
    <tr><td align="center" style="padding-bottom:28px;">
      <a href="${p.cardUrl}" style="display:inline-block;background:#E85D26;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:15px 36px;border-radius:12px;">View My Loyalty Card &rarr;</a>
    </td></tr>

    <!-- How to earn -->
    <tr><td style="padding-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E8E0D4;">
        <tr><td style="padding:16px 20px 8px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#1A1510;">How to earn more points</p>
        </td></tr>
        ${[
          ['🍽️', 'Visit &amp; dine', `10 pts per ${p.currencySym}1`],
          ['⭐', 'Leave a review', '+50 pts bonus'],
          ['🎂', 'Birthday reward', '+200 pts / year'],
          ['👥', 'Refer a friend', '+100 pts / referral'],
        ].map(([icon, label, pts]) => `
        <tr><td style="padding:8px 20px;border-top:1px solid #F5F0E8;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:15px;padding-right:12px;">${icon}</td>
            <td style="font-size:12px;color:#2C2520;width:100%;">${label}</td>
            <td style="font-size:11px;font-weight:600;color:#E85D26;white-space:nowrap;font-family:monospace;">${pts}</td>
          </tr></table>
        </td></tr>`).join('')}
        <tr><td style="padding:8px 0;"></td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center">
      <p style="margin:0;font-size:11px;color:#6B5F56;">Powered by <strong style="color:#2C2520;">Hospitality Growth OS</strong></p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`
}
