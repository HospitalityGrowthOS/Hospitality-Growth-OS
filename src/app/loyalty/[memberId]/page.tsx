/**
 * /loyalty/[memberId] — Customer-facing loyalty card page.
 * Public — no auth required.
 * Mobile-first. Guests bookmark this page to check points anytime.
 * Staff scan the QR to identify the member.
 */
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const TIERS = {
  bronze: { label: 'Bronze', emoji: '🥉', color: '#B3773A', bar: 'bg-[#B3773A]', next: 'silver' as const, threshold: 500 },
  silver: { label: 'Silver', emoji: '🥈', color: '#6B5F56', bar: 'bg-mid',       next: 'gold'   as const, threshold: 1500 },
  gold:   { label: 'Gold',   emoji: '🥇', color: '#C8A45A', bar: 'bg-gold',      next: null,              threshold: null },
  none:   { label: 'Bronze', emoji: '🥉', color: '#B3773A', bar: 'bg-[#B3773A]', next: 'silver' as const, threshold: 500 },
}

type TierKey = keyof typeof TIERS

function HGOSLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
      <rect width="56" height="56" rx="10" fill="#E85D26"/>
      <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
      <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
      <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
      <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

export default async function LoyaltyCardPage({
  params,
}: {
  params: { memberId: string }
}) {
  const supabase = getAdminClient()

  const [{ data: member }, { data: transactions }] = await Promise.all([
    supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('id', params.memberId)
      .single(),
    supabase
      .from('loyalty_transactions')
      .select('id, type, points, description, created_at')
      .eq('member_id', params.memberId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  if (!member) notFound()

  // Fetch venue separately
  const { data: venue } = await supabase
    .from('venues')
    .select('name, city')
    .eq('id', member.venue_id)
    .single()

  const tier = TIERS[(member.tier as TierKey) ?? 'bronze'] ?? TIERS.bronze
  const guest = member.guests as { name: string | null } | null
  const guestName = guest?.name || 'Member'

  // Generate QR code pointing to this page (staff scans to pull up the profile)
  const cardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/loyalty/${params.memberId}`
  const qrDataUrl = await QRCode.toDataURL(cardUrl, {
    width: 220,
    margin: 2,
    color: { dark: '#1A1510', light: '#FFFFFF' },
  })

  const progressPct = tier.threshold
    ? Math.min(100, Math.round((member.points_balance / tier.threshold) * 100))
    : 100
  const pointsToNext = tier.threshold
    ? Math.max(0, tier.threshold - member.points_balance)
    : 0
  const nextTierLabel = tier.next ? TIERS[tier.next].label : null

  const txList = transactions ?? []

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <HGOSLogo />
          <span className="font-display text-[14px] font-semibold text-[#1A1510]">
            {venue?.name ?? 'Loyalty Card'}
          </span>
        </div>

        {/* Membership Card */}
        <div className="bg-gradient-to-br from-[#1A1510] to-[#2C2520] rounded-2xl p-5 mb-4 shadow-[0_4px_24px_rgba(26,21,16,0.25)]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-0.5">Member</div>
              <div className="font-display text-xl font-semibold text-white leading-tight">{guestName}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl leading-none">{tier.emoji}</div>
              <div className="text-[10px] font-semibold text-white/50 mt-1">{tier.label}</div>
            </div>
          </div>

          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-0.5">Points Balance</div>
              <div className="font-data text-4xl font-bold text-[#C8A45A] leading-none">
                {member.points_balance.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-0.5">Total Earned</div>
              <div className="font-data text-lg font-semibold text-white/60">
                {member.points_earned_total.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {tier.next && (
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[9px] font-medium text-white/40">
                  Progress to {nextTierLabel}
                </span>
                <span className="text-[9px] font-data text-white/40">
                  {member.points_balance}/{tier.threshold}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C8A45A] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-3">
            <div className="font-data text-[9px] text-white/25 tracking-widest">
              {member.qr_code}
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white border border-[#E8E0D4] rounded-2xl p-5 mb-4 flex flex-col items-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6B5F56] mb-4">
            Your Loyalty QR Code
          </div>
          <div className="p-3 bg-[#F5F0E8] rounded-xl mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Loyalty QR Code"
              width={176}
              height={176}
              className="rounded-lg"
            />
          </div>
          <p className="text-[11px] text-[#6B5F56] text-center leading-relaxed">
            Show this to staff at <span className="font-semibold text-[#1A1510]">{venue?.name ?? 'the venue'}</span> to earn & redeem points
          </p>
        </div>

        {/* Progress to next tier */}
        {tier.next && pointsToNext > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{TIERS[tier.next].emoji}</span>
              <span className="text-[13px] font-semibold text-[#1A1510]">
                {pointsToNext.toLocaleString()} pts to {nextTierLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#6B5F56]">
              Keep visiting to unlock {nextTierLabel} tier rewards
            </p>
          </div>
        )}

        {!tier.next && (
          <div className="bg-[#C8A45A]/10 border border-[#C8A45A]/30 rounded-xl p-4 mb-4 text-center">
            <div className="text-xl mb-1">🥇</div>
            <div className="text-[13px] font-semibold text-[#1A1510]">You've reached Gold status!</div>
            <p className="text-[11px] text-[#6B5F56] mt-1">Enjoy exclusive Gold member perks</p>
          </div>
        )}

        {/* How to earn */}
        <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B5F56] mb-3">
            How to earn points
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { icon: '🍽️', label: 'Visit & dine',    pts: '10 pts per €1' },
              { icon: '🎁', label: 'Welcome bonus',   pts: '50 pts' },
              { icon: '⭐', label: 'Leave a review',  pts: '+50 pts' },
              { icon: '🎂', label: 'Birthday reward', pts: '+200 pts / year' },
            ].map(({ icon, label, pts }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{icon}</span>
                <span className="text-[12px] text-[#2C2520] flex-1">{label}</span>
                <span className="text-[11px] font-data font-medium text-[#E85D26]">{pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        {txList.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-xl mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E0D4]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B5F56]">
                Recent Activity
              </div>
            </div>
            {txList.map((tx, i) => {
              const isDeduct = tx.type === 'redeem' || tx.type === 'expire'
              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between px-4 py-3 ${i < txList.length - 1 ? 'border-b border-[#E8E0D4]' : ''}`}
                >
                  <div>
                    <div className="text-[12px] text-[#1A1510] leading-snug">
                      {tx.description || tx.type}
                    </div>
                    <div className="text-[10px] text-[#6B5F56]">
                      {new Date(tx.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className={`font-data text-[13px] font-semibold ${isDeduct ? 'text-[#C0392B]' : 'text-[#2A9D5C]'}`}>
                    {isDeduct ? '−' : '+'}{tx.points} pts
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-[10px] text-[#6B5F56] pb-4">
          Powered by{' '}
          <span className="font-semibold text-[#2C2520]">Hospitality Growth OS</span>
        </p>
      </div>
    </div>
  )
}
