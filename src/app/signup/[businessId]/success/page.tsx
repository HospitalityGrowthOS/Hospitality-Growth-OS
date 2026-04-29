'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type MemberResult = {
  id: string; name: string; points: number; tier: string
  qr_code: string; venue_name: string; enrolled_at: string
  points_to_next_tier?: number; next_tier?: string; next_tier_threshold?: number
}

const tierEmoji: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' }
const tierLabel: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

export default function SignupSuccess() {
  const { businessId } = useParams<{ businessId: string }>()
  const [member, setMember] = useState<MemberResult | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('hgos_member')
    if (raw) {
      try { setMember(JSON.parse(raw)) } catch {}
    }
  }, [])

  if (!member) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-display text-xl font-semibold text-ink mb-2">You're enrolled!</h2>
          <p className="text-[13px] text-mid mb-5">Your loyalty membership is active. Start earning points on your next visit.</p>
          <Link href={`/signup/${businessId}`} className="text-[13px] text-ember hover:underline">Back to signup</Link>
        </div>
      </div>
    )
  }

  const progressPct = member.next_tier_threshold && member.points_to_next_tier !== undefined
    ? Math.min(100, Math.round((member.points / member.next_tier_threshold) * 100))
    : 100

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="10" fill="#E85D26"/>
            <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
            <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Success animation */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#2A9D5C]/10 border-2 border-[#2A9D5C]/30 flex items-center justify-center mx-auto mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">Welcome, {member.name.split(' ')[0]}!</h1>
          <p className="text-[13px] text-mid">You're now a member of <span className="font-medium text-ink">{member.venue_name}</span></p>
        </div>

        {/* Membership card */}
        <div className="bg-gradient-to-br from-ink to-[#2C2520] rounded-2xl p-5 mb-4 text-white shadow-[0_4px_20px_rgba(26,21,16,0.25)]">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-0.5">Member</div>
              <div className="font-display text-lg font-semibold">{member.name}</div>
            </div>
            <div className="text-2xl">{tierEmoji[member.tier] || '🎁'}</div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-0.5">Points Balance</div>
              <div className="font-data text-3xl font-bold text-gold">{member.points}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-0.5">Tier</div>
              <div className="text-sm font-semibold">{tierLabel[member.tier] || 'Bronze'}</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="font-data text-[10px] text-white/40 tracking-widest">{member.qr_code}</div>
          </div>
        </div>

        {/* Progress to next tier */}
        {member.next_tier && member.points_to_next_tier !== undefined && member.points_to_next_tier > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-ink">Progress to {tierLabel[member.next_tier]}</span>
              <span className="font-data text-[12px] text-mid">{member.points}/{member.next_tier_threshold} pts</span>
            </div>
            <div className="h-2 bg-paper rounded-full overflow-hidden">
              <div
                className="h-full bg-ember rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-mid mt-2">
              Earn <span className="font-semibold text-ember">{member.points_to_next_tier} more points</span> to reach {tierLabel[member.next_tier]}
            </p>
          </div>
        )}

        {/* How to earn */}
        <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-5">
          <h3 className="text-[12px] font-semibold text-ink mb-3">How to earn more points</h3>
          <div className="flex flex-col gap-2">
            {[
              { icon: '🍽️', label: 'Visit & dine',     points: '1 pt per €1 spent' },
              { icon: '⭐', label: 'Leave a review',   points: '+50 pts bonus' },
              { icon: '🎂', label: 'Birthday reward',  points: '+200 pts / year' },
              { icon: '👥', label: 'Refer a friend',   points: '+100 pts / referral' },
            ].map(({ icon, label, points }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{icon}</span>
                <span className="text-[12px] text-charcoal flex-1">{label}</span>
                <span className="text-[11px] font-data font-medium text-ember">{points}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-3">
          <p className="text-[12px] text-mid">Show this screen to staff on your next visit to earn points</p>
          <a
            href={`/loyalty/${member.id}`}
            className="block w-full bg-ink text-white font-semibold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Save My Loyalty Card →
          </a>
          <p className="text-[11px] text-mid">Bookmark the loyalty card page to check your points anytime</p>
        </div>
      </div>
    </div>
  )
}
