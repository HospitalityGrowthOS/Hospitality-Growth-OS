/**
 * Model client and interaction logging.
 *
 * The rest of the AI layer talks to the provider only through `callModel`, so
 * swapping models, adding retries or changing logging happens in one place.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'
import { tryWrite } from '@/lib/db'
import { aiFailure, type AiResult } from './types'

/**
 * ANTHROPIC_API_KEY is the SDK convention; CLAUDE_API_KEY is what this project
 * shipped with. Both are accepted so existing deployments keep working.
 */
function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || undefined
}

export function isAiConfigured(): boolean {
  return Boolean(apiKey())
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

let cached: Anthropic | null = null

/**
 * How long any single call may take, and how hard the SDK tries.
 *
 * Both are set explicitly because the inherited defaults are wrong here. The
 * SDK defaults to a **ten minute** timeout, and most calls in this product sit
 * inside the WhatsApp webhook: Meta expects a prompt 200 and re-delivers the
 * message if it does not get one, so a slow model call does not just delay a
 * reply — it duplicates the guest's message and the answer to it.
 *
 * Retries are the SDK's own (connection errors, 408, 409, 429 and every 5xx,
 * which covers the 529 Overloaded that Anthropic returns under load). Three
 * attempts inside a 20-second ceiling is the trade: long enough to ride out a
 * blip, short enough that the webhook still answers while Meta is listening.
 */
const CALL_TIMEOUT_MS = 20_000
const MAX_RETRIES = 3

function getClient(): Anthropic | null {
  const key = apiKey()
  if (!key) return null
  if (!cached) {
    cached = new Anthropic({ apiKey: key, maxRetries: MAX_RETRIES, timeout: CALL_TIMEOUT_MS })
  }
  return cached
}

/**
 * Sorts a provider error into something a caller can act on.
 *
 * The distinction that matters is transient versus permanent: an overloaded
 * provider is worth retrying or escalating to a person, a malformed request
 * never will be, and telling them apart is the difference between a useful
 * escalation note and "something went wrong".
 */
function classify(err: unknown): { reason: 'overloaded' | 'timeout' | 'provider_error'; message: string } {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status

  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { reason: 'timeout', message: `Model call exceeded ${CALL_TIMEOUT_MS / 1000}s` }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { reason: 'overloaded', message: `Could not reach the model provider: ${message}` }
  }
  // 429 rate limit, 529 overloaded, and any other 5xx — all worth another go.
  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return { reason: 'overloaded', message: `Provider unavailable (${status}) after ${MAX_RETRIES} attempts` }
  }
  return { reason: 'provider_error', message }
}

/** Which product feature made the call — used for the activity breakdown. */
export type AiFeature =
  | 'analyze_message'
  | 'guest_reply'
  | 'review_reply'
  | 'summarize_conversation'
  | 'weekly_report'
  | 'business_insight'
  | 'automation_action'

export interface CallOptions {
  system: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  feature: AiFeature
  venueId?: string
  /** Set false for high-volume internal calls that would spam the log. */
  log?: boolean
  /** Override the default ceiling — background jobs can afford to wait longer. */
  timeoutMs?: number
}

/**
 * Single entry point to the model. Never throws — failures come back as a
 * typed result so callers can degrade instead of 500ing.
 */
export async function callModel(opts: CallOptions): Promise<AiResult<string>> {
  const client = getClient()
  if (!client) {
    return aiFailure(
      'not_configured',
      'No Anthropic API key configured. Set ANTHROPIC_API_KEY to enable the assistant.'
    )
  }

  const started = Date.now()

  try {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 512,
      // No temperature: current models reject it as deprecated.
      system: opts.system,
      messages: opts.messages,
    }, { timeout: opts.timeoutMs ?? CALL_TIMEOUT_MS })

    // Take the first text block rather than content[0]: the model may emit a
    // non-text block (e.g. thinking) ahead of the answer.
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      await logInteraction({
        feature: opts.feature,
        venueId: opts.venueId,
        latencyMs: Date.now() - started,
        success: false,
        errorMessage: `Model returned no text block (stop_reason: ${response.stop_reason})`,
        enabled: opts.log !== false,
      })
      return aiFailure(
        'invalid_response',
        `Model returned no text (stop_reason: ${response.stop_reason}).`
      )
    }

    await logInteraction({
      feature: opts.feature,
      venueId: opts.venueId,
      latencyMs: Date.now() - started,
      success: true,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      enabled: opts.log !== false,
    })

    return { ok: true, data: block.text }
  } catch (err) {
    const { reason, message } = classify(err)
    console.error(`[ai] ${opts.feature} failed (${reason}):`, message)

    await logInteraction({
      feature: opts.feature,
      venueId: opts.venueId,
      latencyMs: Date.now() - started,
      success: false,
      errorMessage: message,
      enabled: opts.log !== false,
    })

    return aiFailure(reason, message)
  }
}

// ── Interaction log ───────────────────────────────────────────────────────────

interface LogParams {
  feature: AiFeature
  venueId?: string
  latencyMs: number
  success: boolean
  inputTokens?: number | null
  outputTokens?: number | null
  errorMessage?: string
  enabled: boolean
}

/**
 * Writes to `ai_interactions`. Deliberately swallows its own errors: if the
 * migration hasn't been applied the assistant must still answer guests, it
 * just loses the audit trail until the table exists.
 */
async function logInteraction(params: LogParams): Promise<void> {
  if (!params.enabled) return

  try {
    const supabase = await createAdminClient()
    // tryWrite, not a bare await: a PostgREST failure resolves with { error }
    // instead of throwing, so the catch below never sees it.
    await tryWrite('ai: log interaction', supabase.from('ai_interactions').insert({
      venue_id:      params.venueId ?? null,
      feature:       params.feature,
      model:         DEFAULT_MODEL,
      success:       params.success,
      latency_ms:    params.latencyMs,
      input_tokens:  params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      error_message: params.errorMessage ?? null,
    }))
  } catch {
    // Audit logging must never take down a guest-facing reply.
  }
}
