'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, type PlanKey } from '@/lib/stripe'
import Link from 'next/link'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState('')

  async function handleSelect(plan: PlanKey) {
    setError('')
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()

      if (res.status === 401) {
        router.push('/login?next=/pricing')
        return
      }
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="8" fill="#E85D26"/>
            <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
            <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="font-display font-semibold text-[17px]">Hospitality Growth OS</span>
        </Link>
        <Link href="/login" className="text-sm text-mid hover:text-paper transition-colors">Sign in →</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-ember/10 border border-ember/20 rounded-full px-4 py-1.5 text-ember text-xs font-semibold uppercase tracking-widest mb-6">
            Simple Pricing
          </div>
          <h1 className="font-display text-5xl font-bold text-paper mb-4">
            Turn every guest into revenue.
          </h1>
          <p className="text-mid text-lg max-w-xl mx-auto">
            One platform. Reviews, loyalty, AI, campaigns. Cancel anytime.
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => (
            <div
              key={key}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.badge
                  ? 'bg-ember/5 border-ember/40 ring-1 ring-ember/30'
                  : 'bg-white/[0.03] border-white/[0.08]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-ember text-white text-[11px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-mid mb-3">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-data text-5xl font-bold text-paper">€{plan.price}</span>
                  <span className="text-mid text-sm">/month</span>
                </div>
                <div className="text-[11px] text-mid/60">Billed monthly · Cancel anytime</div>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[13px] text-paper/80">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(key)}
                disabled={loading !== null}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${
                  plan.badge
                    ? 'bg-ember text-white hover:opacity-90'
                    : 'bg-white/[0.08] text-paper hover:bg-white/[0.14] border border-white/[0.1]'
                }`}
              >
                {loading === key ? 'Redirecting…' : `Start with ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Trust */}
        <div className="mt-16 text-center">
          <p className="text-mid text-sm mb-6">Trusted by independent restaurants in Germany & Canada</p>
          <div className="flex justify-center gap-8 text-mid/60 text-xs">
            {['🔒 Secure payments via Stripe', '✓ No setup fees', '✓ Cancel anytime', '✓ 14-day free trial'].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
