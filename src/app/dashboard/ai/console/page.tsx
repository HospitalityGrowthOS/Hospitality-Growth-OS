export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { isAiConfigured } from '@/lib/ai'
import Console, { type ConsoleGuest } from './Console'

export default async function ConsolePage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  // Offering real guests lets loyalty answers be tested with real figures
  // rather than a hypothetical.
  const supabase = await createAdminClient()
  const { data: guestRows } = await supabase
    .from('guests')
    .select('id, name, phone, loyalty_tier, loyalty_points')
    .eq('venue_id', venue.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const guests: ConsoleGuest[] = (guestRows ?? []).map(g => ({
    id: g.id,
    label: g.name || g.phone || 'Unnamed guest',
    tier: g.loyalty_tier,
    points: g.loyalty_points,
  }))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Console configured={isAiConfigured()} guests={guests} />
    </div>
  )
}
