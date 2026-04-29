'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckoutSuccessClient() {
  const router = useRouter()
  const [counting, setCounting] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCounting(c => {
        if (c <= 1) {
          clearInterval(timer)
          router.push('/dashboard')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-[#2A9D5C]/10 flex items-center justify-center mx-auto mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-ink mb-3">You're all set!</h1>
        <p className="text-mid mb-2">Your subscription is now active. Welcome to Hospitality Growth OS.</p>
        <p className="text-mid/60 text-sm mb-10">Redirecting to your dashboard in {counting}s…</p>

        <div className="bg-white border border-[#E8E0D4] rounded-2xl p-6 mb-6 text-left space-y-3">
          {[
            'Review automation activated',
            'QR loyalty system ready',
            'AI assistant configured',
            'Dashboard unlocked',
          ].map(text => (
            <div key={text} className="flex items-center gap-3 text-sm text-ink">
              <span className="text-[#2A9D5C] font-bold">✓</span>
              {text}
            </div>
          ))}
        </div>

        <Link href="/dashboard" className="block w-full bg-ember text-white font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
          Go to Dashboard →
        </Link>
      </div>
    </div>
  )
}
