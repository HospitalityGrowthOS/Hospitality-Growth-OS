import Sidebar from '@/components/layout/Sidebar'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const venue = await getCurrentVenue()

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
