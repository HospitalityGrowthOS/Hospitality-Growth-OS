import Sidebar from '@/components/layout/Sidebar'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue, listOwnedVenues } from '@/lib/venue'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [venue, ownedVenues] = await Promise.all([getCurrentVenue(), listOwnedVenues()])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Owner'
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const venueName = venue?.name || 'Your Venue'
  const venueInitials = venueName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  // Check subscription status
  let subscriptionStatus: string | null = null
  let planName: string | null = null
  if (user) {
    const admin = await createAdminClient()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .single()
    subscriptionStatus = sub?.status || null
    planName = sub?.plan || null
  }

  // Real nav badge counts — these were hardcoded, showing "3" and "2" forever.
  let reviewsBadge = 0
  let aiBadge = 0
  let reservationsBadge = 0
  if (venue) {
    const admin = await createAdminClient()
    const [{ count: negative }, { count: escalated }, { count: unanswered }] = await Promise.all([
      admin.from('action_items').select('id', { count: 'exact', head: true })
        .eq('venue_id', venue.id).eq('type', 'negative_feedback').eq('status', 'pending'),
      admin.from('action_items').select('id', { count: 'exact', head: true })
        .eq('venue_id', venue.id).eq('type', 'conversation_escalation').eq('status', 'pending'),
      // A booking request nobody has replied to is the most time-sensitive
      // thing in the product — the guest is waiting on an answer.
      admin.from('reservation_requests').select('id', { count: 'exact', head: true })
        .eq('venue_id', venue.id).eq('status', 'pending'),
    ])
    reviewsBadge = negative ?? 0
    aiBadge = escalated ?? 0
    reservationsBadge = unanswered ?? 0
  }

  const isTrialing = !subscriptionStatus || subscriptionStatus === 'trial' || subscriptionStatus === 'trialing'
  const isPastDue = subscriptionStatus === 'past_due'

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar
        userName={userName}
        userInitials={userInitials}
        userEmail={user?.email || ''}
        venueName={venueName}
        venueInitials={venueInitials}
        planName={planName}
        currentVenueId={venue?.id ?? null}
        venues={ownedVenues.map(v => ({ id: v.id, name: v.name }))}
        reviewsBadge={reviewsBadge}
        aiBadge={aiBadge}
        reservationsBadge={reservationsBadge}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Trial banner */}
        {isTrialing && (
          <div className="bg-teal/10 border-b border-teal/20 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
            <p className="text-[12px] text-teal font-medium">
              🎉 You're on a free trial — explore everything risk-free.
            </p>
            <Link
              href="/pricing"
              className="text-[11px] font-semibold bg-teal text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
            >
              Upgrade →
            </Link>
          </div>
        )}

        {/* Past due banner */}
        {isPastDue && (
          <div className="bg-[#D4871A]/10 border-b border-[#D4871A]/20 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
            <p className="text-[12px] text-[#D4871A] font-medium">
              ⚠️ Your last payment failed. Please update your billing details to keep your account active.
            </p>
            <Link
              href="/dashboard/settings/billing"
              className="text-[11px] font-semibold bg-[#D4871A] text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
            >
              Fix Now →
            </Link>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
