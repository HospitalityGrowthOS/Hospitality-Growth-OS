import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Venue } from '@/types/database'

/**
 * Returns the venue owned by the currently authenticated user.
 * Uses admin client to bypass RLS, after verifying user identity.
 */
export async function getCurrentVenue(): Promise<Venue | null> {
  try {
    // Verify the user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Use admin client to bypass RLS for the venue lookup
    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('venues')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (error) {
      console.error('[getCurrentVenue] error:', error.message, error.code)
      return null
    }
    return data as Venue
  } catch (e) {
    console.error('[getCurrentVenue] exception:', e)
    return null
  }
}
