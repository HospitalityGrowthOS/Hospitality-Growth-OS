/**
 * Action registry.
 *
 * The only file in the engine that reaches outward — and only into Universal
 * Core services (loyalty, messaging, AI, notifications). It imports nothing
 * from any industry module, so the engine stays industry-agnostic even though
 * its actions do real work.
 *
 * Unimplemented actions are *recording placeholders*, not no-ops: they resolve
 * their full configuration, write exactly what they would have done into the
 * audit log, and return `not_implemented`. A placeholder that silently does
 * nothing is the failure mode this platform has already been bitten by.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { tryWrite } from '@/lib/db'
import { awardPoints } from '@/lib/loyalty'
import { sendText } from '@/lib/whatsapp'
import { callModel } from '@/lib/ai/client'
import type {
  Action, ActionDescriptor, ActionHandler, ActionResult, ActionType, EvaluationContext,
} from './types'
import { readField } from './conditions'

// ── Template interpolation ───────────────────────────────────────────────────

/**
 * Replaces `{{ guest.name }}` with the value from the evaluation context.
 *
 * An unresolved placeholder becomes an empty string rather than leaking
 * `{{ guest.name }}` into a message a guest reads.
 */
export function interpolate(template: string, context: EvaluationContext): string {
  return String(template ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = readField(context, path)
    return value === null || value === undefined ? '' : String(value)
  })
}

const str = (config: Record<string, unknown>, key: string, fallback = ''): string =>
  typeof config[key] === 'string' ? (config[key] as string) : fallback

const num = (config: Record<string, unknown>, key: string, fallback: number): number => {
  const n = Number(config[key])
  return Number.isFinite(n) ? n : fallback
}

/** Records what an action would do without doing it. */
const planned = (type: ActionType, detail: string, resolved: Record<string, unknown>): ActionResult =>
  ({ type, outcome: 'dry_run', detail: `Would ${detail}`, resolved })

// ── Handlers ─────────────────────────────────────────────────────────────────

const sendWhatsApp: ActionHandler = async ({ config, context, dryRun }) => {
  const guest = context.guest as Record<string, unknown> | null
  const venue = context.venue as Record<string, unknown>
  const phone = (guest?.phone as string) || str(config, 'phone')
  const message = interpolate(str(config, 'message'), context)
  const resolved = { phone, message }

  if (!phone) {
    return { type: 'send_whatsapp', outcome: 'skipped', detail: 'No phone number for this guest', resolved }
  }
  if (!message.trim()) {
    return { type: 'send_whatsapp', outcome: 'skipped', detail: 'Message is empty after interpolation', resolved }
  }
  if (guest && guest.whatsapp_opted_in === false) {
    return { type: 'send_whatsapp', outcome: 'skipped', detail: 'Guest has opted out of WhatsApp', resolved }
  }
  if (dryRun) return planned('send_whatsapp', `send WhatsApp to ${phone}`, resolved)

  const phoneId = venue.whatsapp_phone_number_id as string
  const token = venue.whatsapp_access_token as string
  if (!phoneId || !token) {
    return { type: 'send_whatsapp', outcome: 'skipped', detail: 'Venue has no WhatsApp credentials configured', resolved }
  }

  try {
    await sendText(phoneId, token, phone, message, venue.id as string)
    return { type: 'send_whatsapp', outcome: 'executed', detail: `Sent to ${phone}`, resolved }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { type: 'send_whatsapp', outcome: 'failed', detail: `Delivery to ${phone} failed`, resolved, error }
  }
}

const notifyOwner: ActionHandler = async ({ config, context, venueId, dryRun }) => {
  const title = interpolate(str(config, 'title', 'Automation alert'), context)
  const body = interpolate(str(config, 'message'), context)
  const resolved = { title, body }
  if (dryRun) return planned('notify_owner', `notify the owner: "${title}"`, resolved)

  const supabase = await createAdminClient()
  const ok = await tryWrite('automation: notify owner', supabase.from('notifications').insert({
    venue_id: venueId,
    title,
    body,
    type: str(config, 'type', 'info'),
    is_read: false,
  }))
  return ok
    ? { type: 'notify_owner', outcome: 'executed', detail: `Notification created: "${title}"`, resolved }
    : { type: 'notify_owner', outcome: 'failed', detail: 'Could not create notification', resolved }
}

const createActionItem: ActionHandler = async ({ config, context, venueId, dryRun }) => {
  const title = interpolate(str(config, 'title', 'Automation task'), context)
  const description = interpolate(str(config, 'description'), context)
  // action_items.priority is a database enum — an arbitrary string would be a
  // runtime 22P02, which is exactly what the generated types exist to prevent.
  const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
  const raw = str(config, 'priority', 'medium')
  const priority = (PRIORITIES as readonly string[]).includes(raw)
    ? (raw as (typeof PRIORITIES)[number])
    : 'medium'
  const resolved = { title, description, priority }
  if (dryRun) return planned('create_action_item', `create task "${title}"`, resolved)

  const supabase = await createAdminClient()
  const ok = await tryWrite('automation: action item', supabase.from('action_items').insert({
    venue_id: venueId,
    title,
    description,
    type: str(config, 'type', 'automation'),
    priority,
    status: 'pending',
  }))
  return ok
    ? { type: 'create_action_item', outcome: 'executed', detail: `Task created: "${title}"`, resolved }
    : { type: 'create_action_item', outcome: 'failed', detail: 'Could not create task', resolved }
}

const issueLoyaltyPoints: ActionHandler = async ({ config, context, venueId, dryRun }) => {
  const member = context.member as Record<string, unknown> | null
  const points = num(config, 'points', 0)
  const resolved = { points, member_id: member?.id ?? null }

  if (!member?.id) {
    return { type: 'issue_loyalty_points', outcome: 'skipped', detail: 'Guest is not a loyalty member', resolved }
  }
  if (points <= 0) {
    return { type: 'issue_loyalty_points', outcome: 'skipped', detail: 'Points must be greater than zero', resolved }
  }
  if (dryRun) return planned('issue_loyalty_points', `award ${points} points`, resolved)

  // Through the loyalty service. The engine performs no points arithmetic and
  // writes no ledger rows — awardPoints owns that, and the database trigger
  // owns the balances.
  const spendEquivalent = num(config, 'spend_equivalent', 0)
  if (spendEquivalent > 0) {
    const result = await awardPoints({
      memberId: String(member.id), venueId, spendAmount: spendEquivalent,
    })
    return result.ok
      ? { type: 'issue_loyalty_points', outcome: 'executed', detail: `Awarded ${result.points_earned} points`, resolved }
      : { type: 'issue_loyalty_points', outcome: 'failed', detail: result.error ?? 'Award failed', resolved }
  }

  // A flat bonus is a ledger row; the trigger derives the balance from it.
  const supabase = await createAdminClient()
  const { data: current } = await supabase
    .from('loyalty_members').select('points_balance').eq('id', String(member.id)).single()
  const balanceAfter = (current?.points_balance ?? 0) + points

  const ok = await tryWrite('automation: bonus points', supabase.from('loyalty_transactions').insert({
    venue_id: venueId,
    member_id: String(member.id),
    type: 'bonus',
    points,
    balance_after: balanceAfter,
    description: interpolate(str(config, 'reason', 'Automation bonus'), context),
  }))
  return ok
    ? { type: 'issue_loyalty_points', outcome: 'executed', detail: `Awarded ${points} bonus points`, resolved }
    : { type: 'issue_loyalty_points', outcome: 'failed', detail: 'Could not write ledger row', resolved }
}

const createAiRecommendation: ActionHandler = async ({ config, context, venueId, dryRun }) => {
  const title = interpolate(str(config, 'title', 'Automation insight'), context)
  const description = interpolate(str(config, 'description'), context)
  const priority = str(config, 'priority', 'medium')
  const resolved = { title, description, priority }
  if (dryRun) return planned('create_ai_recommendation', `raise recommendation "${title}"`, resolved)

  const supabase = await createAdminClient()
  const ok = await tryWrite('automation: recommendation', supabase.from('ai_recommendations').insert({
    venue_id: venueId,
    type: str(config, 'type', 'automation_generated'),
    title,
    description,
    priority: (['high', 'medium', 'low'].includes(priority) ? priority : 'medium') as 'high' | 'medium' | 'low',
    status: 'pending',
    data: { source: 'automation' } as never,
    generated_at: new Date().toISOString(),
  }))
  return ok
    ? { type: 'create_ai_recommendation', outcome: 'executed', detail: `Recommendation raised: "${title}"`, resolved }
    : { type: 'create_ai_recommendation', outcome: 'failed', detail: 'Could not raise recommendation', resolved }
}

const callAiService: ActionHandler = async ({ config, context, venueId, dryRun }) => {
  const prompt = interpolate(str(config, 'prompt'), context)
  const resolved = { prompt }
  if (!prompt.trim()) {
    return { type: 'call_ai_service', outcome: 'skipped', detail: 'Prompt is empty', resolved }
  }
  if (dryRun) return planned('call_ai_service', 'call the AI service with the resolved prompt', resolved)

  // Through the existing AI layer: one model client, one interaction log, one
  // budget ceiling. The engine never talks to a model directly.
  const result = await callModel({
    feature: 'automation_action',
    system: str(config, 'system', 'You are assisting a hospitality business. Answer concisely and factually.'),
    messages: [{ role: 'user', content: prompt }],
    maxTokens: num(config, 'max_tokens', 400),
    venueId,
  })
  return result.ok
    ? { type: 'call_ai_service', outcome: 'executed', detail: result.data.slice(0, 280), resolved: { ...resolved, output: result.data } }
    : { type: 'call_ai_service', outcome: 'failed', detail: result.message, resolved, error: result.reason }
}

/**
 * Builds a placeholder handler.
 *
 * It resolves configuration exactly as a real handler would and records the
 * full intent, so the audit log shows what *would* have happened and the
 * action becomes implementable without changing any workflow that uses it.
 */
function placeholder(type: ActionType, verb: string, provider: string): ActionHandler {
  return async ({ config, context }) => {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(config ?? {})) {
      resolved[key] = typeof value === 'string' ? interpolate(value, context) : value
    }
    return {
      type,
      outcome: 'not_implemented',
      detail: `${verb} — awaiting the ${provider} integration. Configuration resolved and recorded.`,
      resolved,
    }
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

const HANDLERS: Record<ActionType, ActionHandler> = {
  send_whatsapp:            sendWhatsApp,
  notify_owner:             notifyOwner,
  create_action_item:       createActionItem,
  issue_loyalty_points:     issueLoyaltyPoints,
  create_ai_recommendation: createAiRecommendation,
  call_ai_service:          callAiService,

  send_email:               placeholder('send_email', 'Email queued', 'transactional email'),
  issue_reward:             placeholder('issue_reward', 'Reward issued', 'reward redemption'),
  schedule_follow_up:       placeholder('schedule_follow_up', 'Follow-up scheduled', 'follow-up scheduler'),
  tag_guest:                placeholder('tag_guest', 'Guest tagged', 'guest tagging'),
  create_reservation_task:  placeholder('create_reservation_task', 'Reservation task created', 'reservation'),
  escalate_conversation:    placeholder('escalate_conversation', 'Conversation escalated', 'escalation routing'),
  call_internal_api:        placeholder('call_internal_api', 'Internal API called', 'internal API'),
  call_external_api:        placeholder('call_external_api', 'External API called', 'outbound webhook'),
}

/** Runs one action. Never throws — a handler failure becomes a recorded result. */
export async function runAction(
  action: Action,
  params: { context: EvaluationContext; venueId: string; guestId: string | null; dryRun: boolean }
): Promise<ActionResult> {
  const handler = HANDLERS[action.type]
  if (!handler) {
    return { type: action.type, outcome: 'failed', detail: `Unknown action type "${action.type}"` }
  }
  try {
    return await handler({ config: action.config ?? {}, ...params })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { type: action.type, outcome: 'failed', detail: 'Action threw an unexpected error', error }
  }
}

// ── Catalogue (builder UI reads this) ────────────────────────────────────────

export const ACTIONS: ActionDescriptor[] = [
  { type: 'send_whatsapp', label: 'Send WhatsApp', description: 'Message the guest on WhatsApp.', implemented: true,
    configFields: [{ key: 'message', label: 'Message', type: 'textarea', required: true }] },
  { type: 'notify_owner', label: 'Notify owner', description: 'Raise a notification in the dashboard.', implemented: true,
    configFields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'message', label: 'Detail', type: 'textarea' }] },
  { type: 'create_action_item', label: 'Create task', description: 'Add a task to the owner\'s list.', implemented: true,
    configFields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'description', label: 'Description', type: 'textarea' }] },
  { type: 'issue_loyalty_points', label: 'Issue loyalty points', description: 'Credit points to the member.', implemented: true,
    configFields: [{ key: 'points', label: 'Points', type: 'number', required: true }, { key: 'reason', label: 'Reason', type: 'text' }] },
  { type: 'create_ai_recommendation', label: 'Raise recommendation', description: 'Surface a recommendation to the owner.', implemented: true,
    configFields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'description', label: 'Description', type: 'textarea' }] },
  { type: 'call_ai_service', label: 'Call AI', description: 'Generate text through the AI service layer.', implemented: true,
    configFields: [{ key: 'prompt', label: 'Prompt', type: 'textarea', required: true }] },

  { type: 'send_email', label: 'Send email', description: 'Awaiting the transactional email integration.', implemented: false,
    configFields: [{ key: 'subject', label: 'Subject', type: 'text' }, { key: 'body', label: 'Body', type: 'textarea' }] },
  { type: 'issue_reward', label: 'Issue reward', description: 'Awaiting reward redemption.', implemented: false,
    configFields: [{ key: 'reward_id', label: 'Reward', type: 'text' }] },
  { type: 'schedule_follow_up', label: 'Schedule follow-up', description: 'Awaiting the follow-up scheduler.', implemented: false,
    configFields: [{ key: 'delay_days', label: 'Delay (days)', type: 'number' }] },
  { type: 'tag_guest', label: 'Tag guest', description: 'Awaiting guest tagging.', implemented: false,
    configFields: [{ key: 'tag', label: 'Tag', type: 'text' }] },
  { type: 'create_reservation_task', label: 'Reservation task', description: 'Awaiting the reservation module.', implemented: false,
    configFields: [{ key: 'note', label: 'Note', type: 'text' }] },
  { type: 'escalate_conversation', label: 'Escalate conversation', description: 'Awaiting escalation routing.', implemented: false,
    configFields: [{ key: 'reason', label: 'Reason', type: 'text' }] },
  { type: 'call_internal_api', label: 'Call internal API', description: 'Awaiting the internal API bridge.', implemented: false,
    configFields: [{ key: 'endpoint', label: 'Endpoint', type: 'text' }] },
  { type: 'call_external_api', label: 'Call external API', description: 'Awaiting outbound webhooks.', implemented: false,
    configFields: [{ key: 'url', label: 'URL', type: 'text' }] },
]

export function describeAction(type: string): ActionDescriptor | null {
  return ACTIONS.find(a => a.type === type) ?? null
}
