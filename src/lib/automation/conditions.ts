/**
 * Condition engine.
 *
 * Conditions are declarative: a dotted field path, an operator, and a value.
 * They are evaluated against a context object assembled once per execution.
 * Nothing here knows what a guest *is* — it reads `guest.total_visits` the same
 * way it would read `stay.nights` from a future Hotel module.
 *
 * Every evaluation records what was expected and what was observed, because a
 * workflow that quietly did nothing is indistinguishable from a broken one
 * unless you can see which condition stopped it.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type {
  Condition,
  ConditionFieldDescriptor,
  ConditionResult,
  EvaluationContext,
  AutomationEvent,
} from './types'

// ── Context assembly ─────────────────────────────────────────────────────────

/**
 * Loads everything conditions may read.
 *
 * Guest and member are fetched only when the event carries a guest, so a
 * venue-level event costs one query rather than three.
 */
export async function buildContext(event: AutomationEvent): Promise<EvaluationContext> {
  const supabase = await createAdminClient()

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, type, city, settings')
    .eq('id', event.venueId)
    .single()

  const context: EvaluationContext = {
    event: { ...event.payload, name: event.name, occurred_at: event.occurredAt },
    venue: (venue ?? {}) as Record<string, unknown>,
    guest: null,
    member: null,
  }

  if (event.guestId) {
    // Errors are surfaced, not discarded. A mistyped column here makes every
    // condition on `guest.*` silently fail and every `{{ guest.name }}`
    // render empty — which is indistinguishable from a guest with no name
    // unless the failure is logged.
    const [guestResult, memberResult] = await Promise.all([
      supabase
        .from('guests')
        .select('id, name, phone, email, language, tags, loyalty_tier, loyalty_points, total_visits, total_spent, last_visit_at, first_visit_at, whatsapp_opted_in, review_opt_out')
        .eq('id', event.guestId)
        .maybeSingle(),
      supabase
        .from('loyalty_members')
        .select('id, tier, points_balance, points_earned_total, points_redeemed_total, enrolled_at, last_activity_at, birthday')
        .eq('guest_id', event.guestId)
        .eq('venue_id', event.venueId)
        .maybeSingle(),
    ])

    if (guestResult.error) {
      console.error('[automation] context: guest lookup failed:', guestResult.error.message)
    }
    if (memberResult.error) {
      console.error('[automation] context: member lookup failed:', memberResult.error.message)
    }

    context.guest = guestResult.data as Record<string, unknown> | null
    context.member = memberResult.data as Record<string, unknown> | null

    // Birthday lives on the membership, but an owner writing a condition
    // thinks of it as the guest's. Expose it in both places rather than
    // making them remember which table it happens to sit in.
    if (context.guest && memberResult.data?.birthday) {
      context.guest.birthday = memberResult.data.birthday
    }
  }

  return context
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Reads `a.b.c` out of the context, returning undefined rather than throwing. */
export function readField(context: EvaluationContext, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node === null || node === undefined || typeof node !== 'object') return undefined
    return (node as Record<string, unknown>)[key]
  }, context)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function daysBetween(value: unknown, now: number): number | null {
  if (typeof value !== 'string') return null
  const then = Date.parse(value)
  return Number.isNaN(then) ? null : (now - then) / 86_400_000
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v))
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

/** Evaluates one condition. Never throws — an unreadable field simply fails. */
export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext,
  now = Date.now()
): ConditionResult {
  const observed = readField(context, condition.field)
  const expected = condition.value
  let passed = false

  switch (condition.operator) {
    case 'eq':  passed = String(observed) === String(expected); break
    case 'neq': passed = String(observed) !== String(expected); break

    case 'gt': case 'gte': case 'lt': case 'lte': {
      const a = toNumber(observed), b = toNumber(expected)
      if (a === null || b === null) { passed = false; break }
      passed = condition.operator === 'gt'  ? a > b
             : condition.operator === 'gte' ? a >= b
             : condition.operator === 'lt'  ? a < b
             : a <= b
      break
    }

    case 'in':     passed = toList(expected).includes(String(observed)); break
    case 'not_in': passed = !toList(expected).includes(String(observed)); break

    case 'contains':
      passed = typeof observed === 'string' &&
               observed.toLowerCase().includes(String(expected ?? '').toLowerCase())
      break

    case 'is_set':     passed = observed !== null && observed !== undefined && observed !== ''; break
    case 'is_not_set': passed = observed === null || observed === undefined || observed === ''; break

    // Date comparisons, expressed the way an owner thinks about them.
    case 'within_days': {
      const days = daysBetween(observed, now), limit = toNumber(expected)
      passed = days !== null && limit !== null && days >= 0 && days <= limit
      break
    }
    case 'older_than_days': {
      const days = daysBetween(observed, now), limit = toNumber(expected)
      passed = days !== null && limit !== null && days > limit
      break
    }
  }

  return { field: condition.field, operator: condition.operator, expected, observed, passed }
}

/**
 * Evaluates every condition. All must pass — conditions are ANDed.
 *
 * Deliberately evaluates all of them rather than short-circuiting: the audit
 * log is more useful when it shows every check, not just the first failure.
 */
export function evaluateConditions(
  conditions: Condition[],
  context: EvaluationContext,
  now = Date.now()
): { passed: boolean; results: ConditionResult[] } {
  const results = (conditions ?? []).map(c => evaluateCondition(c, context, now))
  return { passed: results.every(r => r.passed), results }
}

// ── Catalogue (builder UI reads this) ────────────────────────────────────────

const NUMERIC: ConditionFieldDescriptor['operators'] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']
const TEXT: ConditionFieldDescriptor['operators'] = ['eq', 'neq', 'in', 'not_in', 'contains', 'is_set', 'is_not_set']
const DATE: ConditionFieldDescriptor['operators'] = ['within_days', 'older_than_days', 'is_set', 'is_not_set']

export const CONDITION_FIELDS: ConditionFieldDescriptor[] = [
  { field: 'guest.loyalty_tier',   label: 'Guest tier',            type: 'string', operators: TEXT, options: ['none', 'bronze', 'silver', 'gold'] },
  { field: 'guest.total_visits',   label: 'Visit count',           type: 'number', operators: NUMERIC },
  { field: 'guest.total_spent',    label: 'Total spend',           type: 'number', operators: NUMERIC },
  { field: 'guest.last_visit_at',  label: 'Days since last visit', type: 'date',   operators: DATE },
  { field: 'guest.whatsapp_opted_in', label: 'WhatsApp opted in',  type: 'boolean', operators: ['eq'] },
  { field: 'guest.birthday',       label: 'Birthday',              type: 'date',   operators: DATE },
  { field: 'member.points_balance', label: 'Loyalty balance',      type: 'number', operators: NUMERIC },
  { field: 'member.points_earned_total', label: 'Points earned',   type: 'number', operators: NUMERIC },
  { field: 'member.tier',          label: 'Membership tier',       type: 'string', operators: TEXT, options: ['bronze', 'silver', 'gold'] },
  { field: 'member.last_activity_at', label: 'Days inactive',      type: 'date',   operators: DATE },
  { field: 'event.rating',         label: 'Review rating',         type: 'number', operators: NUMERIC },
  { field: 'event.sentiment',      label: 'Sentiment',             type: 'string', operators: TEXT, options: ['positive', 'neutral', 'negative'] },
  { field: 'event.priority',       label: 'Recommendation priority', type: 'string', operators: TEXT, options: ['high', 'medium', 'low'] },
  { field: 'event.score',          label: 'Business health',       type: 'number', operators: NUMERIC },
  { field: 'event.spend_amount',   label: 'Visit spend',           type: 'number', operators: NUMERIC },
  { field: 'event.status',         label: 'Reservation status',    type: 'string', operators: TEXT },
  { field: 'event.category',       label: 'Review category',       type: 'string', operators: TEXT },
]

export function describeField(field: string): ConditionFieldDescriptor | null {
  return CONDITION_FIELDS.find(f => f.field === field) ?? null
}
