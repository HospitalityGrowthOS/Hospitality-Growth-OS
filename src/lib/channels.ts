/**
 * Which channel can actually reach a guest.
 *
 * `review_requests.channel` has stored `whatsapp | email` since the table was
 * created, and nothing ever read it — every request was sent as a WhatsApp
 * template regardless of what the column said. In the Golden Demo Venue that
 * left 42 requests marked `email` that could never be delivered and 16 guests
 * the product could not reach at all.
 *
 * The routing is derived from contact details and opt-in state rather than a
 * per-guest preference setting. Opt-in already carries the intent, and a
 * preference screen is a customer request, not a prerequisite — see
 * docs/capabilities/email-channel.md.
 */

export type Channel = 'whatsapp' | 'email'

export interface Reachable {
  phone?: string | null
  email?: string | null
  whatsappOptedIn?: boolean | null
}

/**
 * WhatsApp is preferred where the guest opted in — it is the channel guests
 * answer, and the long-term primary. Email is the fallback that keeps the
 * product working while Meta verification is pending, not a repositioning.
 *
 * Returns null when no channel can carry a message. That is a real outcome and
 * callers must handle it: it is the difference between a request that is
 * waiting and one that will never be delivered.
 */
export function resolveChannel(guest: Reachable): Channel | null {
  // Only an explicit false is an opt-out. A missing flag means the contact
  // details came with the request itself and no preference was ever recorded.
  if (guest.phone && guest.whatsappOptedIn !== false) return 'whatsapp'
  if (guest.email) return 'email'
  return null
}

/**
 * Honours a channel already recorded on the row, but only if it can still
 * work. A request marked `email` for a guest with no address is not a routing
 * instruction, it is stale data — and sending nothing because of it would be
 * obeying a mistake.
 */
export function usableChannel(recorded: string | null | undefined, guest: Reachable): Channel | null {
  if (recorded === 'whatsapp' && guest.phone && guest.whatsappOptedIn !== false) return 'whatsapp'
  if (recorded === 'email' && guest.email) return 'email'
  return resolveChannel(guest)
}
