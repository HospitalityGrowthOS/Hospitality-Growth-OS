'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Workflow } from '@/lib/automation'

/** Enable/disable, test run and delete. Everything here is reversible except delete. */
export default function WorkflowControls({ workflow }: { workflow: Workflow }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function setStatus(status: 'active' | 'disabled' | 'draft') {
    setBusy('status'); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/automation/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not change status'); return }
      router.refresh()
    } finally { setBusy('') }
  }

  async function testRun() {
    setBusy('test'); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/automation/workflows/${workflow.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: {} }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Test failed'); return }
      const e = data.execution
      setMessage(
        e.status === 'skipped'
          ? 'Conditions did not pass — see the run below for which one stopped it.'
          : `Dry run complete: ${e.actionsExecuted.length} action(s) resolved. Nothing was sent.`
      )
      router.refresh()
    } finally { setBusy('') }
  }

  async function remove() {
    if (!confirm(`Delete "${workflow.name}"? Its execution history goes with it.`)) return
    setBusy('delete')
    try {
      const res = await fetch(`/api/automation/workflows/${workflow.id}`, { method: 'DELETE' })
      if (!res.ok) { setError('Could not delete'); return }
      router.push('/dashboard/automation/workflows')
      router.refresh()
    } finally { setBusy('') }
  }

  return (
    <div className="shrink-0 text-right">
      <div className="flex items-center gap-2">
        <button onClick={testRun} disabled={busy !== ''}
          className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-ink hover:bg-paper transition-colors disabled:opacity-50">
          {busy === 'test' ? 'Running…' : 'Test run'}
        </button>
        {workflow.status === 'active' ? (
          <button onClick={() => setStatus('disabled')} disabled={busy !== ''}
            className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-ink hover:bg-paper transition-colors disabled:opacity-50">
            Disable
          </button>
        ) : (
          <button onClick={() => setStatus('active')} disabled={busy !== ''}
            className="px-3 py-1.5 rounded-lg bg-ember text-white text-[12px] font-medium hover:bg-ember/90 transition-colors disabled:opacity-50">
            Activate
          </button>
        )}
        <button onClick={remove} disabled={busy !== ''}
          className="px-2 py-1.5 text-[12px] text-mid hover:text-ember transition-colors disabled:opacity-50">
          Delete
        </button>
      </div>
      {message && <p className="text-[11px] text-teal mt-1.5 max-w-xs">{message}</p>}
      {error && <p className="text-[11px] text-[#C0392B] mt-1.5 max-w-xs">{error}</p>}
    </div>
  )
}
