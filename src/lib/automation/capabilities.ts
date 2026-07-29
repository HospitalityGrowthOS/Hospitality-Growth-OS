/**
 * Capability Registry — types only. Nothing here runs.
 *
 * This file defines the extension point through which future Industry Modules
 * will contribute behaviour to the Automation Engine. It is deliberately
 * unimplemented: with one industry module there is nothing to dispatch
 * between, and an abstraction built against a single case is shaped by
 * guesses rather than requirements. See docs/adr/0001-capability-registry.md.
 *
 * Every declaration below is a type or an interface. There is no registry
 * instance, no resolution logic, and no call site. Adding this file changed no
 * behaviour, and removing it would change none either — which is exactly the
 * property a premature abstraction should have until it earns its keep.
 *
 * ── The idea ────────────────────────────────────────────────────────────────
 *
 * A capability is a *behaviour*, not a schema. `booking` is the behaviour of
 * something being reserved for someone at a time. A restaurant reservation, a
 * hotel stay and a spa appointment are three providers of that one behaviour.
 *
 * The engine understands the lifecycle and nothing else. It can act on "a
 * booking was cancelled" across every industry precisely because it does not
 * know what was booked. The moment it needs the party size, it has stopped
 * being industry-agnostic — so it never asks.
 */

import type { EventName } from './types'

// ── Capability names ─────────────────────────────────────────────────────────

/**
 * The behaviours the platform recognises.
 *
 * A closed union rather than `string`: an industry module that misspells its
 * capability fails to compile instead of registering into a void. This is the
 * same discipline the generated database types apply to enum columns, and for
 * the same reason — the alternative is a runtime discovery.
 */
export type CapabilityName =
  | 'booking'
  | 'messaging'
  | 'loyalty'
  | 'reviews'
  | 'orders'
  | 'payments'
  | 'crm'
  | 'notifications'
  | 'ai_assistant'

// ── Lifecycles ───────────────────────────────────────────────────────────────

/**
 * The lifecycle phases each capability exposes.
 *
 * This is the entire vocabulary the engine shares with an industry module.
 * Phases are verbs that survive translation across industries: a hotel stay
 * and a haircut are both `booking.cancelled`, and a workflow reacting to that
 * is meaningful in both.
 *
 * Anything that does not survive translation — table numbers, room types,
 * treatment durations — stays in the provider's payload, opaque to the engine.
 */
export interface CapabilityLifecycle {
  booking: 'created' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show'
  messaging: 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  loyalty: 'enrolled' | 'points_awarded' | 'points_redeemed' | 'tier_changed' | 'reward_issued'
  reviews: 'requested' | 'received' | 'responded'
  orders: 'placed' | 'accepted' | 'preparing' | 'ready' | 'fulfilled' | 'cancelled'
  payments: 'authorised' | 'captured' | 'refunded' | 'failed'
  crm: 'registered' | 'updated' | 'merged' | 'deleted'
  notifications: 'raised' | 'acknowledged' | 'dismissed'
  ai_assistant: 'answered' | 'escalated' | 'unanswered'
}

/** The phases valid for a given capability. */
export type PhaseOf<C extends CapabilityName> = CapabilityLifecycle[C]

/**
 * The event name a capability phase produces: `booking.cancelled`.
 *
 * Assignable to `EventName`, so capability events flow through the existing
 * dispatch path with no special handling. The engine does not need to know an
 * event came from a capability provider rather than from product code.
 */
export type CapabilityEvent<C extends CapabilityName = CapabilityName> =
  C extends CapabilityName ? `${C}.${PhaseOf<C>}` : never

// A compile-time assertion, not a runtime one: if `CapabilityEvent` ever
// stopped satisfying `EventName`, this line would fail to build.
type _CapabilityEventsAreEvents = CapabilityEvent extends EventName ? true : never

// ── Providers ────────────────────────────────────────────────────────────────

/**
 * A provider is an industry module's implementation of one capability.
 *
 * `restaurant.reservation` and `hotel.stay` are two providers of `booking`.
 * Both emit `booking.cancelled`; they differ in `providerId`, which travels in
 * the event payload so a workflow can narrow to one of them.
 */
export interface CapabilityProvider<C extends CapabilityName = CapabilityName> {
  /** Which behaviour this implements. Constrains `phases` below. */
  readonly capability: C

  /**
   * Stable identity, `<module>.<thing>` — `hotel.stay`, `spa.appointment`.
   * Appears in event payloads and in workflow trigger filters, so it is a
   * public contract: renaming one breaks existing workflows.
   */
  readonly providerId: string

  /** The module contributing it, for attribution and entitlement checks. */
  readonly moduleId: string

  /** Shown in the workflow builder. */
  readonly label: string

  /**
   * The phases this provider actually emits.
   *
   * Typed against its own capability: a `booking` provider claiming
   * `'captured'` is a compile error, because `'captured'` belongs to
   * `payments`. This is what makes an invalid registration unbuildable
   * rather than undiscovered.
   */
  readonly phases: readonly PhaseOf<C>[]

  /**
   * Whether this provider is available for a given venue.
   *
   * A resort runs `hotel.stay`, `restaurant.reservation` and
   * `spa.appointment` at once; a café runs none of them. Scoping is per venue
   * rather than global for exactly this reason.
   */
  readonly availableFor?: (venueId: string) => Promise<boolean>
}

/** A provider bound to one phase — what a trigger descriptor is built from. */
export interface CapabilityTrigger<C extends CapabilityName = CapabilityName> {
  readonly capability: C
  readonly phase: PhaseOf<C>
  readonly providerId: string
  readonly event: CapabilityEvent<C>
}

// ── Registry contract ────────────────────────────────────────────────────────

/**
 * The interface a future implementation will satisfy.
 *
 * Deliberately not instantiated. When the second industry module arrives, an
 * implementation of this interface is written against two real providers and
 * the engine gains capability-aware trigger discovery. Until then the engine
 * keeps matching plain event names, which already works.
 */
export interface CapabilityRegistry {
  /**
   * Registers a provider. Generic over the capability so the compiler checks
   * the phases against it at the call site.
   */
  register<C extends CapabilityName>(provider: CapabilityProvider<C>): void

  /**
   * Every provider of a capability — an array, never a single value.
   *
   * Multi-provider is the default assumption rather than a later extension:
   * resorts make it the normal case, and a registry that returns one provider
   * cannot be widened later without changing every caller.
   */
  providersOf<C extends CapabilityName>(
    capability: C,
    scope?: { venueId?: string }
  ): Promise<readonly CapabilityProvider<C>[]>

  /** One specific provider, or null when the module is not installed. */
  resolve<C extends CapabilityName>(
    capability: C,
    providerId: string
  ): CapabilityProvider<C> | null

  /** Whether any provider offers this capability for a venue. */
  supports(capability: CapabilityName, scope?: { venueId?: string }): Promise<boolean>

  /** Trigger descriptors contributed by registered providers. */
  triggers(scope?: { venueId?: string }): Promise<readonly CapabilityTrigger[]>
}

// ── How providers will emit ──────────────────────────────────────────────────

/**
 * The payload shape a capability provider attaches to its events.
 *
 * `provider` is the important field. Two modules emitting `booking.cancelled`
 * are distinguished by it — and because the engine's existing trigger filter
 * already compares payload keys, a workflow can narrow to one provider today
 * with `triggerConfig: { provider: 'hotel.stay' }`. No engine change is needed
 * to support multi-provider dispatch; the mechanism is already there.
 */
export interface CapabilityEventPayload {
  /** The emitting provider's stable id. */
  provider: string
  /** The module that owns it. */
  module: string
  /**
   * The provider's own record id — a reservation id, a stay id. Opaque to the
   * engine, meaningful to the module that reads it back.
   */
  subjectId?: string
  /** Industry-specific detail. The engine never inspects this. */
  [key: string]: unknown
}

/**
 * Illustrative only — not registered, not exported from the package index,
 * and not referenced by any running code.
 *
 * It exists so the shape is concrete rather than hypothetical, and so the
 * compile-time checks above have something to prove themselves against.
 */
export const EXAMPLE_HOTEL_BOOKING_PROVIDER: CapabilityProvider<'booking'> = {
  capability: 'booking',
  providerId: 'hotel.stay',
  moduleId: 'hotel',
  label: 'Hotel stay',
  phases: ['created', 'confirmed', 'cancelled', 'completed', 'no_show'],
}
