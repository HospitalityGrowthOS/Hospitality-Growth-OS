'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normaliseEmail, suggestEmailCorrection } from '@/lib/email-suggest'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const supabase = createClient()

  async function sendLink(address: string) {
    setLoading(true)
    setError('')
    setSuggestion(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    })

    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Trailing spaces and capitals from autofill silently break sign-in.
    const address = normaliseEmail(email)
    if (address !== email) setEmail(address)

    // A mistyped domain is well-formed, so nothing else catches it: the link
    // would be sent to a real address that simply isn't theirs. Ask once —
    // never block, since an unusual domain must still get through.
    const maybeTypo = suggestEmailCorrection(address)
    if (maybeTypo && maybeTypo !== suggestion) {
      setSuggestion(maybeTypo)
      return
    }

    await sendLink(address)
  }

  function acceptSuggestion() {
    if (!suggestion) return
    setEmail(suggestion)
    void sendLink(suggestion)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="8" fill="#E85D26"/>
            <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
            <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="font-display font-semibold text-[18px] text-ink leading-tight">Hospitality Growth</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-mid">AI Revenue Platform</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E0D4] rounded-2xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#2A9D5C]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h2 className="font-display text-xl font-semibold text-ink mb-2">Check your email</h2>
              <p className="text-sm text-mid leading-relaxed">
                We sent a magic link to <span className="font-medium text-ink">{email}</span>. Click it to sign in — no password needed.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-5 text-xs text-mid hover:text-ember transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-ink mb-1">Welcome back</h1>
              <p className="text-sm text-mid mb-6">Sign in to your Growth OS dashboard</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    setSuggestion(null)
                  }}
                  placeholder="marco@ristorante-milano.de"
                  required
                  error={error || undefined}
                />

                {suggestion && (
                  <div className="-mt-1 rounded-lg border border-[#C8A45A]/40 bg-[#C8A45A]/[0.08] px-3.5 py-2.5">
                    <p className="text-[12px] text-ink leading-relaxed">
                      Did you mean{' '}
                      <button
                        type="button"
                        onClick={acceptSuggestion}
                        className="font-semibold text-ember hover:underline"
                      >
                        {suggestion}
                      </button>
                      ?
                    </p>
                    <p className="text-[11px] text-mid mt-0.5">
                      Press Send again to use the address you typed.
                    </p>
                  </div>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  Send magic link
                </Button>
              </form>

              <p className="text-[11px] text-mid text-center mt-5 leading-relaxed">
                No account yet?{' '}
                <a href="mailto:hello@hospitalitygrowth.io" className="text-ember hover:underline">
                  Contact us to get started
                </a>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-mid mt-6">
          © 2026 Hospitality Growth OS · Turn every guest into revenue.
        </p>
      </div>
    </div>
  )
}
