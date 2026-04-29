import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

export const MODEL = 'claude-sonnet-4-6'

// ─── Core call ────────────────────────────────────────────────
export async function callClaude(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  maxTokens = 1024
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

// ─── Review response ──────────────────────────────────────────
export async function generateReviewResponse(params: {
  reviewContent: string
  rating: number
  venueName: string
  ownerName: string
  reviewerName: string
}): Promise<string> {
  const tone =
    params.rating >= 4 ? 'grateful and warm'
    : params.rating === 3 ? 'appreciative and constructive'
    : 'empathetic and solution-focused'

  return callClaude(
    [{ role: 'user', content: `Review (${params.rating} stars) by ${params.reviewerName}:\n"${params.reviewContent}"` }],
    `You are ${params.ownerName}, owner of ${params.venueName}. Write a ${tone} Google review response.
Rules: address reviewer by name, under 120 words, never defensive, sign off as ${params.ownerName}.
Write in the same language as the review.`,
    300
  )
}

// ─── Guest intent detection ───────────────────────────────────
export type GuestIntent =
  | 'reservation' | 'hours' | 'menu' | 'loyalty_balance'
  | 'loyalty_redeem' | 'complaint' | 'directions'
  | 'allergy' | 'group_booking' | 'review_feedback' | 'general'

export async function detectIntent(message: string): Promise<GuestIntent> {
  const valid: GuestIntent[] = [
    'reservation','hours','menu','loyalty_balance','loyalty_redeem',
    'complaint','directions','allergy','group_booking','review_feedback','general'
  ]
  const result = await callClaude(
    [{ role: 'user', content: message }],
    `Classify into one of: ${valid.join(', ')}. Respond with ONLY the label.`,
    15
  )
  const intent = result.trim().toLowerCase() as GuestIntent
  return valid.includes(intent) ? intent : 'general'
}

// ─── AI guest reply ───────────────────────────────────────────
export async function generateGuestReply(params: {
  message: string
  venueName: string
  venueType: string
  city: string
  address: string
  openingHours: string
  cuisineType?: string
  aiPersonaName: string
  guestName?: string
  guestTier?: string
  conversationHistory: Anthropic.MessageParam[]
  intent: GuestIntent
}): Promise<{ response: string; shouldEscalate: boolean }> {
  const systemPrompt = `You are ${params.aiPersonaName}, AI concierge for ${params.venueName} (${params.venueType}) in ${params.city}.
Address: ${params.address}
Hours: ${params.openingHours}
Cuisine: ${params.cuisineType || 'International'}
${params.guestName ? `Guest: ${params.guestName}${params.guestTier && params.guestTier !== 'none' ? `, ${params.guestTier} member` : ''}` : ''}
Rules: respond in guest's language, 2-3 sentences max, never make up info.
If guest is angry or asks for manager twice, end with ESCALATE_TO_HUMAN.`

  const response = await callClaude(
    [...params.conversationHistory, { role: 'user', content: params.message }],
    systemPrompt,
    400
  )

  const shouldEscalate = response.includes('ESCALATE_TO_HUMAN')
  return { response: response.replace('ESCALATE_TO_HUMAN', '').trim(), shouldEscalate }
}

// ─── Weekly report ────────────────────────────────────────────
export async function generateWeeklyReport(
  venueName: string,
  kpis: Record<string, number>,
  prevKpis: Record<string, number>
): Promise<string> {
  return callClaude(
    [{ role: 'user', content: `${venueName}\nThis week: ${JSON.stringify(kpis)}\nLast week: ${JSON.stringify(prevKpis)}` }],
    'Write a 3-4 bullet weekly restaurant performance summary. Highlight wins, flag issues, give 1 actionable tip. Under 200 words.',
    400
  )
}
