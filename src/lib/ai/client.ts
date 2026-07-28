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

function getClient(): Anthropic | null {
  const key = apiKey()
  if (!key) return null
  if (!cached) cached = new Anthropic({ apiKey: key })
  return cached
}

/** Which product feature made the call — used for the activity breakdown. */
export type AiFeature =
  | 'analyze_message'
  | 'guest_reply'
  | 'review_reply'
  | 'summarize_conversation'
  | 'weekly_report'
  | 'business_insight'

export interface CallOptions {
  system: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  feature: AiFeature
  venueId?: string
  /** Set false for high-volume internal calls that would spam the log. */
  log?: boolean
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
    })

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
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[ai] ${opts.feature} failed:`, message)

    await logInteraction({
      feature: opts.feature,
      venueId: opts.venueId,
      latencyMs: Date.now() - started,
      success: false,
      errorMessage: message,
      enabled: opts.log !== false,
    })

    return aiFailure('provider_error', message)
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
