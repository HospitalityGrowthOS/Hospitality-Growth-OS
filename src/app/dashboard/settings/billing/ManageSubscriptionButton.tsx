'use client'
import { useState } from 'react'

export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleManage() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      window.location.href = data.url
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleManage}
        disabled={loading}
        className="px-4 py-2 bg-ink text-paper rounded-lg text-sm font-medium hover:bg-charcoal transition-colors disabled:opacity-60"
      >
        {loading ? 'Loading…' : 'Manage Subscription'}
      </button>
      {error && <p className="text-ember text-xs mt-1">{error}</p>}
    </div>
  )
}
