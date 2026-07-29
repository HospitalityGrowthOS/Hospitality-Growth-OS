/**
 * Automation Engine — shared types.
 *
 * Nothing in this file refers to restaurants, menus, tables or any other
 * industry concept. The engine deals in event *names* (opaque strings), a
 * generic evaluation context, and registered action handlers. A future Hotel
 * or Resort module contributes new event names and new context fields without
 * this file changing.
 */

// ── Events ───────────────────────────────────────────────────────────────────

/**
 * Canonical event name, `domain.thing_happened`.
 *
 * Typed as a template literal rather than a fixed union: the engine must accept
 * events from modules it has never heard of, while still rejecting an
 * unnamespaced string like `'birthday'`.
 */
export type EventName = `${string}.${string}`

export interface AutomationEvent {
  name: EventName
  venueId: string
  /** The guest this event concerns, when it concerns one. */
  guestId?: string | null
  /** Free-form detail. The engine never interprets it; conditions may read it. */
  payload: Record<string, unknown>
  occurredAt: string
}

// ── Conditions ───────────────────────────────────────────────────────────────

export const CONDITION_OPERATORS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'in', 'not_in', 'contains', 'is_set', 'is_not_set',
  'within_days', 'older_than_days',
] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

export interface Condition {
  /** Dotted path into the evaluation context, e.g. `guest.total_visits`. */
  field: string
  operator: ConditionOperator
  value?: unknown
}

/** A condition plus what was actually observed — written to the audit log. */
export interface ConditionResult {
  field: string
  operator: ConditionOperator
  expected: unknown
  observed: unknown
  passed: boolean
}

/**
 * Everything a condition may read. Populated once per execution.
 *
 * `event` is always present. The rest are loaded only when the event carries a
 * guest, so a venue-level event does not pay for guest lookups.
 */
export interface EvaluationContext {
  event: Record<string, unknown>
  venue: Record<string, unknown>
  guest?: Record<string, unknown> | null
  member?: Record<string, unknown> | null
  [key: string]: unknown
}

// ── Actions ──────────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'send_whatsapp',
  'send_email',
  'notify_owner',
  'create_action_item',
  'issue_loyalty_points',
  'issue_reward',
  'create_ai_recommendation',
  'schedule_follow_up',
  'tag_guest',
  'create_reservation_task',
  'escalate_conversation',
  'call_ai_service',
  'call_internal_api',
  'call_external_api',
] as const

export type ActionType = (typeof ACTION_TYPES)[number]

export interface Action {
  type: ActionType
  config: Record<string, unknown>
}

export type ActionOutcome = 'executed' | 'skipped' | 'failed' | 'not_implemented' | 'dry_run'

/** What an action did, recorded whether or not it succeeded. */
export interface ActionResult {
  type: ActionType
  outcome: ActionOutcome
  /** Human-readable account of what happened, or would have happened. */
  detail: string
  /** The resolved inputs — kept so a dry run is as informative as a real one. */
  resolved?: Record<string, unknown>
  error?: string
}

/** Signature every action handler implements. */
export type ActionHandler = (params: {
  config: Record<string, unknown>
  context: EvaluationContext
  venueId: string
  guestId: string | null
  dryRun: boolean
}) => Promise<ActionResult>

// ── Schedule ─────────────────────────────────────────────────────────────────

export type ScheduleKind = 'immediate' | 'delayed' | 'at' | 'recurring'

export interface Schedule {
  kind: ScheduleKind
  /** `delayed`: how long after the event to act. */
  delayMinutes?: number
  /** `at`: an absolute ISO timestamp. */
  runAt?: string
  /** `recurring`: cron expression. Stored now, executed when a runner exists. */
  cron?: string
}

// ── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'draft' | 'active' | 'disabled'

export interface RetryPolicy {
  maxAttempts: number
  backoffMinutes?: number
}

export interface Workflow {
  id: string
  venueId: string
  name: string
  description: string | null
  status: WorkflowStatus
  triggerEvent: EventName
  triggerConfig: Record<string, unknown>
  conditions: Condition[]
  actions: Action[]
  schedule: Schedule
  dryRun: boolean
  requiresApproval: boolean
  retryPolicy: RetryPolicy
  templateKey: string | null
  lastExecutedAt: string | null
  executionCount: number
  createdAt: string
  updatedAt: string
}

/** The shape accepted when creating or updating a workflow. */
export interface WorkflowInput {
  name: string
  description?: string | null
  status?: WorkflowStatus
  triggerEvent: EventName
  triggerConfig?: Record<string, unknown>
  conditions?: Condition[]
  actions?: Action[]
  schedule?: Schedule
  dryRun?: boolean
  requiresApproval?: boolean
  retryPolicy?: RetryPolicy
  templateKey?: string | null
}

// ── Execution ────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | 'pending' | 'awaiting_approval' | 'running'
  | 'success' | 'failed' | 'skipped' | 'cancelled'

export interface Execution {
  id: string
  venueId: string
  workflowId: string
  workflowName?: string
  eventName: string
  eventPayload: Record<string, unknown>
  status: ExecutionStatus
  conditionsEvaluated: ConditionResult[]
  actionsExecuted: ActionResult[]
  error: string | null
  retryCount: number
  scheduledFor: string | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  targetGuestId: string | null
  targetChannel: string | null
  dryRun: boolean
  createdAt: string
}

// ── Catalogue descriptors (data the builder UI renders from) ─────────────────

export interface TriggerDescriptor {
  event: EventName
  label: string
  description: string
  /** Grouping in the builder. */
  category: string
  /** Context fields this event makes available to conditions. */
  provides: string[]
}

export interface ConditionFieldDescriptor {
  field: string
  label: string
  type: 'number' | 'string' | 'date' | 'boolean'
  operators: ConditionOperator[]
  options?: string[]
}

export interface ActionDescriptor {
  type: ActionType
  label: string
  description: string
  /** False for the production-ready placeholders. */
  implemented: boolean
  configFields: { key: string; label: string; type: 'text' | 'textarea' | 'number'; required?: boolean }[]
}

// ── Results ──────────────────────────────────────────────────────────────────

/** Mirrors the AI layer's contract: callers get a definite answer, never a throw. */
export type AutomationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'not_found' | 'invalid' | 'failed'; message: string }

export interface DispatchSummary {
  event: EventName
  matched: number
  executed: number
  skipped: number
  scheduled: number
  failed: number
  executionIds: string[]
}
