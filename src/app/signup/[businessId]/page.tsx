'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'

// ─── Types ────────────────────────────────────────────────────────────────────

type VenueInfo = { id: string; name: string; type: string; city: string | null }

type EnrolledMember = {
  id: string
  name: string
  points: number
  tier: string
  qr_code: string
  venue_name: string
  enrolled_at: string
  points_to_next_tier?: number
  next_tier?: string
  next_tier_threshold?: number
}

type FormState = {
  name: string
  phone: string
  email: string
  birthday: string
  consent: boolean
}

type Errors = Partial<Record<keyof FormState, string>>

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
      <rect width="56" height="56" rx="10" fill="#E85D26"/>
      <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
      <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
      <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
      <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B5F56]">
          {label}
        </label>
        {hint && <span className="text-[10px] text-[#6B5F56]/70">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] text-[#C0392B] mt-1">{error}</p>}
    </div>
  )
}

const inputCls = (err?: string) =>
  `w-full px-4 py-3.5 rounded-xl border text-[15px] text-[#1A1510] bg-[#F5F0E8] placeholder:text-[#6B5F56]/40 focus:outline-none focus:ring-2 focus:ring-[#E85D26]/30 transition-all ${
    err ? 'border-[#C0392B]' : 'border-[#E8E0D4] focus:border-[#E85D26]/40'
  }`

// ─── Success — Loyalty Card ───────────────────────────────────────────────────

function LoyaltyCard({
  member,
  venueName,
}: {
  member: EnrolledMember
  venueName: string
}) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    const url = `${window.location.origin}/loyalty/${member.id}`
    QRCode.toDataURL(url, {
      width: 220,
      margin: 2,
      color: { dark: '#1A1510', light: '#FFFFFF' },
    }).then(setQrDataUrl).catch(() => {})
  }, [member.id])

  const firstName = member.name.split(' ')[0]
  const progressPct = member.next_tier_threshold
    ? Math.min(100, Math.round((member.points / member.next_tier_threshold) * 100))
    : 100
  const tierEmoji: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' }
  const tierLabel: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
  const cardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/loyalty/${member.id}`
    : `/loyalty/${member.id}`

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <Logo />
          <span className="font-display text-[14px] font-semibold text-[#1A1510]">{venueName}</span>
        </div>

        {/* Welcome */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#2A9D5C]/10 border-2 border-[#2A9D5C]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A1510] mb-1">
            Welcome, {firstName}!
          </h1>
          <p className="text-[13px] text-[#6B5F56]">
            You&apos;re now a member of <span className="font-semibold text-[#1A1510]">{venueName}</span>
          </p>
        </div>

        {/* Membership card */}
        <div className="bg-gradient-to-br from-[#1A1510] to-[#2C2520] rounded-2xl p-5 mb-4 shadow-[0_4px_24px_rgba(26,21,16,0.25)]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-0.5">Member</div>
              <div className="font-display text-xl font-semibold text-white">{member.name}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl leading-none">{tierEmoji[member.tier] ?? '🥉'}</div>
              <div className="text-[10px] text-white/50 mt-1">{tierLabel[member.tier] ?? 'Bronze'}</div>
            </div>
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-0.5">Points Balance</div>
              <div className="font-data text-4xl font-bold text-[#C8A45A] leading-none">{member.points}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-white/40 mb-0.5">Welcome bonus</div>
              <div className="font-data text-sm text-white/50">+{member.points} pts</div>
            </div>
          </div>

          {/* Progress bar */}
          {member.next_tier && member.next_tier_threshold && (
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[9px] text-white/40">Progress to {tierLabel[member.next_tier]}</span>
                <span className="font-data text-[9px] text-white/40">{member.points}/{member.next_tier_threshold}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C8A45A] rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-3">
            <div className="font-data text-[9px] text-white/25 tracking-widest">{member.qr_code}</div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white border border-[#E8E0D4] rounded-2xl p-5 mb-4 flex flex-col items-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6B5F56] mb-4">
            Your Loyalty QR Code
          </div>
          {qrDataUrl ? (
            <div className="p-3 bg-[#F5F0E8] rounded-xl mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Loyalty QR" width={176} height={176} className="rounded-lg" />
            </div>
          ) : (
            <div className="w-44 h-44 bg-[#F5F0E8] rounded-xl mb-3 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#E85D26] border-t-transparent rounded-full animate-spin"/>
            </div>
          )}
          <p className="text-[11px] text-[#6B5F56] text-center leading-relaxed">
            Show this to staff at <span className="font-semibold text-[#1A1510]">{venueName}</span> to earn & redeem points
          </p>
        </div>

        {/* Points to next tier */}
        {member.next_tier && (member.points_to_next_tier ?? 0) > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{tierEmoji[member.next_tier]}</span>
              <span className="text-[13px] font-semibold text-[#1A1510]">
                {member.points_to_next_tier} pts to {tierLabel[member.next_tier]}
              </span>
            </div>
            <p className="text-[11px] text-[#6B5F56]">Earn 10 points per €1 spent on your next visit</p>
          </div>
        )}

        {/* Save card CTA */}
        <a
          href={cardUrl}
          className="flex items-center justify-center gap-2 w-full bg-[#1A1510] text-white font-semibold py-3.5 rounded-xl text-[14px] hover:opacity-90 transition-opacity mb-3"
        >
          🔖 Save My Loyalty Card
        </a>
        <p className="text-center text-[11px] text-[#6B5F56] mb-6">
          Bookmark that page to check your points anytime
        </p>

        {/* How to earn */}
        <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B5F56] mb-3">
            How to earn more points
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { icon: '🍽️', label: 'Visit & dine',    pts: '10 pts per €1' },
              { icon: '⭐', label: 'Leave a review',  pts: '+50 pts' },
              { icon: '🎂', label: 'Birthday reward', pts: '+200 pts / year' },
              { icon: '👥', label: 'Refer a friend',  pts: '+100 pts' },
            ].map(({ icon, label, pts }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{icon}</span>
                <span className="text-[12px] text-[#2C2520] flex-1">{label}</span>
                <span className="text-[11px] font-data font-semibold text-[#E85D26]">{pts}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-[#6B5F56]">
          Powered by <span className="font-semibold text-[#2C2520]">Hospitality Growth OS</span>
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const { businessId } = useParams<{ businessId: string }>()

  const [venue, setVenue]               = useState<VenueInfo | null>(null)
  const [venueLoading, setVenueLoading] = useState(true)
  const [venueError, setVenueError]     = useState(false)

  const [form, setForm]       = useState<FormState>({ name: '', phone: '', email: '', birthday: '', consent: false })
  const [errors, setErrors]   = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [enrolled, setEnrolled] = useState<EnrolledMember | null>(null)

  useEffect(() => {
    fetch(`/api/signup/${businessId}`)
      .then(r => r.json())
      .then(d => { if (d.venue) setVenue(d.venue); else setVenueError(true) })
      .catch(() => setVenueError(true))
      .finally(() => setVenueLoading(false))
  }, [businessId])

  function set(field: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Please enter your full name'
    if (!form.phone.trim() || form.phone.trim().length < 7) e.phone = 'Please enter a valid phone number'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'
    if (!form.consent) e.consent = 'You must agree to join the loyalty programme'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch(`/api/signup/${businessId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          phone:    form.phone.trim(),
          email:    form.email.trim() || null,
          birthday: form.birthday || null,
          consent:  true,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      // Show loyalty card inline — no redirect
      setEnrolled(data.member)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('Connection error. Please check your internet and try again.')
      setSubmitting(false)
    }
  }

  // ── Enrolled: show loyalty card ────────────────────────────────────────────
  if (enrolled) {
    return <LoyaltyCard member={enrolled} venueName={venue?.name ?? enrolled.venue_name} />
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (venueLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#E85D26] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (venueError || !venue) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-display text-xl font-semibold text-[#1A1510] mb-2">Venue not found</h2>
          <p className="text-[13px] text-[#6B5F56]">This QR code link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  // ── Signup Form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo + venue */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Logo />
          <span className="font-display text-[15px] font-semibold text-[#1A1510]">{venue.name}</span>
        </div>

        {/* Hero headline */}
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold text-[#1A1510] mb-1.5">
            Join our loyalty programme
          </h1>
          <p className="text-[13px] text-[#6B5F56] leading-relaxed">
            Earn points on every visit. Get rewarded.
          </p>
        </div>

        {/* Benefits strip */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: '🎁', label: '50 welcome pts' },
            { icon: '⭐', label: '10 pts per €1' },
            { icon: '🥇', label: 'Gold rewards' },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-white border border-[#E8E0D4] rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-[11px] font-medium text-[#2C2520] leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white border border-[#E8E0D4] rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-[#1A1510] mb-5">
            Create your membership
          </h2>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            {/* Name */}
            <Field label="Full Name" error={errors.name}>
              <input
                type="text"
                inputMode="text"
                autoComplete="name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Maria Rossi"
                className={inputCls(errors.name)}
              />
            </Field>

            {/* Phone — required */}
            <Field label="Phone Number" error={errors.phone}>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+49 176 1234 5678"
                className={inputCls(errors.phone)}
              />
            </Field>

            {/* Email — optional */}
            <Field label="Email" hint="optional — get your card by email" error={errors.email}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="maria@example.com"
                className={inputCls(errors.email)}
              />
            </Field>

            {/* Birthday — optional */}
            <Field label="Birthday" hint="optional — birthday reward!" error={errors.birthday}>
              <input
                type="date"
                value={form.birthday}
                onChange={e => set('birthday', e.target.value)}
                className={inputCls()}
              />
            </Field>

            {/* Consent */}
            <div>
              <label className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border transition-colors ${errors.consent ? 'border-[#C0392B] bg-[#C0392B]/5' : 'border-[#E8E0D4] hover:border-[#E85D26]/30'}`}>
                <div className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={e => set('consent', e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${form.consent ? 'bg-[#E85D26] border-[#E85D26]' : 'border-[#D4C9BE]'}`}>
                    {form.consent && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[12px] text-[#2C2520] leading-relaxed">
                  I agree to join the {venue.name} loyalty programme and receive updates about my points and exclusive offers.
                </span>
              </label>
              {errors.consent && <p className="text-[11px] text-[#C0392B] mt-1">{errors.consent}</p>}
            </div>

            {submitError && (
              <div className="bg-[#C0392B]/5 border border-[#C0392B]/20 rounded-xl p-3 text-[12px] text-[#C0392B]">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E85D26] hover:bg-[#E85D26]/90 disabled:opacity-60 text-white font-semibold py-4 rounded-xl text-[15px] transition-all flex items-center justify-center gap-2 mt-1"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  Joining…
                </>
              ) : (
                <>Join &amp; Earn 50 Points 🎁</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#6B5F56] mt-5">
          Powered by <span className="font-semibold text-[#2C2520]">Hospitality Growth OS</span>
        </p>
      </div>
    </div>
  )
}
