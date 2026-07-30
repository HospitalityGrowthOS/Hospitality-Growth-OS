import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Venue } from '@/types/database'

/**
 * Which venue the operator is currently looking at.
 *
 * Held in a cookie rather than the database because it is a property of the
 * browsing session, not of the account: the same owner may have one venue open
 * on a laptop and another on a phone.
 */
export const SELECTED_VENUE_COOKIE = 'hgos_selected_venue'

/**
 * Every venue this user owns, oldest first.
 *
 * Ordering is stable and deliberate — the first venue an owner created stays
 * their default, so adding a second venue never silently moves them somewhere
 * else on next sign-in.
 */
export async function listOwnedVenues(): Promise<Venue[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Admin client bypasses RLS; the owner filter below is what scopes it.
    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('venues')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[listOwnedVenues] error:', error.message, error.code)
      return []
    }
    return (data ?? []) as Venue[]
  } catch (e) {
    console.error('[listOwnedVenues] exception:', e)
    return []
  }
}

/**
 * Returns the venue the operator is currently working in.
 *
 * Previously this used `.single()`, which errors with PGRST116 the moment an
 * owner has more than one venue — so creating a second venue would have broken
 * the dashboard entirely rather than degrading. It now resolves the selected
 * venue from a cookie and falls back to the oldest owned venue, which keeps
 * single-venue accounts behaving exactly as before.
 *
 * The signature is unchanged: 42 call sites depend on it returning
 * `Venue | null`.
 */
export async function getCurrentVenue(): Promise<Venue | null> {
  const venues = await listOwnedVenues()
  if (!venues.length) return null
  if (venues.length === 1) return venues[0]

  try {
    const selected = (await cookies()).get(SELECTED_VENUE_COOKIE)?.value
    if (selected) {
      // Only ever resolves to a venue this user owns — a stale or forged
      // cookie naming someone else's venue falls through to the default.
      const match = venues.find(v => v.id === selected)
      if (match) return match
    }
  } catch {
    // cookies() is unavailable in some contexts; the default is still correct.
  }

  return venues[0]
}

/** Whether this user owns a given venue. Used before honouring a switch. */
export async function ownsVenue(venueId: string): Promise<boolean> {
  const venues = await listOwnedVenues()
  return venues.some(v => v.id === venueId)
}
