'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The human decision on a held execution. Approving is the moment the actions
 * actually happen — nothing reached a guest before this click.
 */
export default function ApprovalControls({ executionId }: { executionId: string }) {
  const [busy, setBusy] = useState<'approve' | 'cancel' | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function decide(action: 'approve' | 'cancel') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/automation/executions/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      router.refresh()
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="shrink-0 text-right">
      <div className="flex items-center gap-2">
        <button
          onClick={() => decide('cancel')}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-mid hover:text-ink hover:bg-paper transition-colors disabled:opacity-50"
        >
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </button>
        <button
          onClick={() => decide('approve')}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded-lg bg-ember text-white text-[12px] font-medium hover:bg-ember/90 transition-colors disabled:opacity-50"
        >
          {busy === 'approve' ? 'Running…' : 'Approve and run'}
        </button>
      </div>
      {error && <p className="text-[11px] text-[#C0392B] mt-1.5">{error}</p>}
    </div>
  )
}
