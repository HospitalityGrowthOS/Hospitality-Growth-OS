/**
 * Loyalty points engine.
 *
 * Shared by the visit-recording route and the award-points API so that
 * awarding points never depends on one route calling the other over HTTP —
 * a server-to-server fetch carries no session cookie and would fail auth.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { sendText } from '@/lib/whatsapp'
import { calcLoyaltyTier, getTierEmoji } from '@/lib/utils'

export interface AwardPointsResult {
  ok: boolean
  error?: string
  points_earned?: number
  new_balance?: number
  tier_upgraded?: boolean
  new_tier?: string
}

export async function awardPoints(params: {
  memberId: string
  venueId: string
  spendAmount: number
  visitId?: string
}): Promise<AwardPointsResult> {
  const { memberId, venueId, spendAmount, visitId } = params
  const supabase = await createAdminClient()

  const [{ data: member }, { data: venue }] = await Promise.all([
    supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('id', memberId)
      .eq('venue_id', venueId)   // never award across venues
      .single(),
    supabase.from('venues').select('*').eq('id', venueId).single(),
  ])

  if (!member) return { ok: false, error: 'Member not found' }
  if (!venue)  return { ok: false, error: 'Venue not found' }

  const settings = (venue.settings || {}) as Record<string, unknown>
  const pointsPerEuro = (settings.points_per_euro as number) ?? 10
  const thresholds =
    (settings.tier_thresholds as { silver: number; gold: number }) ??
    { silver: 500, gold: 1500 }

  const pointsEarned = Math.floor(spendAmount * pointsPerEuro)
  if (pointsEarned <= 0) return { ok: true, points_earned: 0 }

  const newBalance  = member.points_balance + pointsEarned
  const oldTier     = member.tier as string
  const newTier     = calcLoyaltyTier(newBalance, thresholds)
  const tierUpgraded = newTier !== oldTier

  await Promise.all([
    supabase.from('loyalty_transactions').insert({
      venue_id: venueId,
      member_id: memberId,
      type: 'earn',
      points: pointsEarned,
      description: `Visit spend €${spendAmount.toFixed(2)}`,
      reference_id: visitId || null,
    }),
    supabase.from('loyalty_members').update({
      points_balance: newBalance,
      points_earned_total: member.points_earned_total + pointsEarned,
      tier: newTier,
      last_activity_at: new Date().toISOString(),
    }).eq('id', memberId),
    supabase.from('guests').update({
      loyalty_points: newBalance,
      loyalty_tier: newTier,
    }).eq('id', member.guest_id),
  ])

  // Notify the guest. Only valid inside WhatsApp's 24h service window, so a
  // failure here is expected and must not fail the points award.
  const guest = member.guests as { name?: string; phone?: string } | null
  if (guest?.phone && venue.whatsapp_phone_number_id && venue.whatsapp_access_token) {
    const firstName = guest.name?.split(' ')[0] || 'there'
    const emoji = getTierEmoji(newTier)
    const message = tierUpgraded
      ? `🎉 Congratulations ${firstName}!\n\nYou've reached *${newTier.charAt(0).toUpperCase() + newTier.slice(1)} status* at ${venue.name}! ${emoji}\n\nBalance: *${newBalance} points*`
      : `Thanks for visiting ${venue.name}, ${firstName}! ${emoji}\n\n+${pointsEarned} points earned\nTotal: *${newBalance} points*`

    try {
      await sendText(
        venue.whatsapp_phone_number_id,
        venue.whatsapp_access_token,
        guest.phone,
        message
      )
    } catch (err) {
      console.error('[loyalty] points notification failed (non-fatal):', err)
    }
  }

  return {
    ok: true,
    points_earned: pointsEarned,
    new_balance: newBalance,
    tier_upgraded: tierUpgraded,
    new_tier: newTier,
  }
}
