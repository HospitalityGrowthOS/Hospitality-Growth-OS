/**
 * Demo venues never send anything outward.
 *
 * A demo venue's guests are invented. Every message addressed to one is at best
 * wasted quota, and at worst a real message to a stranger whose number or
 * address a fixture happened to land on.
 *
 * This is not hypothetical. Seeding the Golden Demo Venue put 446 review
 * requests into the queue, and the dispatcher — which selects pending requests
 * across every venue, with no filter — sent all of them to Meta. They were
 * rejected only because the sending number was still in development mode and
 * the recipients were not on its allow-list. On a verified number they would
 * have gone out.
 *
 * The venue's own WhatsApp credentials being empty is not a defence: the moment
 * someone connects WhatsApp to the demo venue to show the feature off, every
 * send path starts working. So the check lives at the transport layer, below
 * every dispatcher, where it cannot be forgotten.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** True when the settings blob marks the venue as a demo. */
export function isDemoSettings(settings: unknown): boolean {
  return (settings as Record<string, unknown> | null)?.is_demo === true
}

// Sending happens in tight loops — a campaign is one lookup per recipient
// otherwise. Cached for the life of the process, which is a request on Vercel.
const cache = new Map<string, boolean>()

/**
 * Whether this venue is a demo.
 *
 * Fails *open* on a lookup error — a database blip should not silently stop a
 * real venue's messages. The seeded venue is the thing being protected against,
 * and its lookups succeed.
 */
export async function isDemoVenue(venueId: string | null | undefined): Promise<boolean> {
  if (!venueId) return false

  const cached = cache.get(venueId)
  if (cached !== undefined) return cached

  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await supabase
      .from('venues').select('settings').eq('id', venueId).single()

    if (error) {
      console.error('[demo] venue lookup failed, treating as live:', error.message)
      return false
    }
    const result = isDemoSettings(data?.settings)
    cache.set(venueId, result)
    return result
  } catch (err) {
    console.error('[demo] venue lookup threw, treating as live:', err)
    return false
  }
}

/** Shared log line, so suppressed sends are greppable across channels. */
export function logSuppressed(channel: string, venueId: string, to: string): void {
  console.log(`[${channel}] suppressed — venue ${venueId} is a demo venue (would have sent to ${to})`)
}
