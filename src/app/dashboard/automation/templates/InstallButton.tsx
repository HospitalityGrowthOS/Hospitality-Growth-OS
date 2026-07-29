'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InstallButton({ templateKey, alreadyInstalled }: {
  templateKey: string; alreadyInstalled: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function install() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/automation/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: templateKey }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not install'); return }
      router.push(`/dashboard/automation/workflows/${data.workflow.id}`)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        onClick={install}
        disabled={busy}
        className="px-3.5 py-2 rounded-lg border border-border text-[12px] font-medium text-ink hover:bg-white transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? 'Installing…' : alreadyInstalled ? 'Install again' : 'Use template'}
      </button>
      {error && <p className="text-[11px] text-[#C0392B] mt-1.5">{error}</p>}
    </div>
  )
}
