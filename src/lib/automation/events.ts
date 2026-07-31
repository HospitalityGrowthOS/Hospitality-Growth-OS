/**
 * Event model.
 *
 * Everything the engine does starts here. Product code calls `emitEvent` and
 * knows nothing about workflows; the engine reacts and knows nothing about the
 * product. That indirection is what lets a future Hotel or Resort module add
 * `stay.checked_in` without the engine changing.
 *
 * Events are logged to `analytics_events`, which already carries exactly the
 * fields an event envelope needs (venue, guest, type, properties, timestamp).
 * No new event table was introduced.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { tryWrite } from '@/lib/db'
import type { AutomationEvent, DispatchSummary, EventName } from './types'

/**
 * Event names the platform emits today.
 *
 * This is a catalogue, not a constraint — `EventName` accepts any namespaced
 * string, so a module can emit an event that predates its entry here. The
 * catalogue exists so the workflow builder has something to offer the owner.
 */
export const KNOWN_EVENTS = [
  'customer.registered',
  'customer.updated',
  'loyalty.member_joined',
  'loyalty.tier_changed',
  'loyalty.points_awarded',
  'visit.recorded',
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'review.received',
  'review.positive',
  'review.negative',
  'ai.recommendation.created',
  'business.health.changed',
  'faq.unknown_spike',
  'conversation.escalated',
] as const satisfies readonly EventName[]

export type KnownEvent = (typeof KNOWN_EVENTS)[number]

/**
 * Records an event and runs any workflows listening for it.
 *
 * Never throws. A failure inside automation must not break the product action
 * that emitted the event — a guest's visit is recorded whether or not a
 * birthday workflow fires. Callers that want the outcome can read the summary;
 * most should ignore it.
 */
export async function emitEvent(params: {
  venueId: string
  name: EventName
  guestId?: string | null
  payload?: Record<string, unknown>
}): Promise<DispatchSummary | null> {
  const event: AutomationEvent = {
    name: params.name,
    venueId: params.venueId,
    guestId: params.guestId ?? null,
    payload: params.payload ?? {},
    occurredAt: new Date().toISOString(),
  }

  try {
    await logEvent(event)
  } catch (err) {
    console.error('[automation] event log failed (non-fatal):', err)
  }

  try {
    // Imported lazily so that product code emitting an event does not pull the
    // whole action layer — and its service dependencies — into its bundle.
    const { dispatch } = await import('./engine')
    return await dispatch(event)
  } catch (err) {
    console.error(`[automation] dispatch failed for ${params.name} (non-fatal):`, err)
    return null
  }
}

/** Writes the event to the shared analytics stream. Best-effort by design. */
async function logEvent(event: AutomationEvent): Promise<void> {
  const supabase = await createAdminClient()
  await tryWrite('automation: event log', supabase.from('analytics_events').insert({
    venue_id: event.venueId,
    guest_id: event.guestId ?? null,
    event_type: event.name,
    properties: event.payload as never,
    occurred_at: event.occurredAt,
  }))
}

/**
 * Recent events for a venue, newest first.
 *
 * Reads the same analytics stream, filtered to namespaced names so legacy rows
 * (`visit_recorded`, written before this convention) do not appear as if they
 * were engine events.
 */
export async function recentEvents(venueId: string, limit = 20) {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_type, properties, occurred_at, guest_id')
    .eq('venue_id', venueId)
    .like('event_type', '%.%')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[automation] recentEvents failed:', error.message)
    return []
  }
  return data ?? []
}
