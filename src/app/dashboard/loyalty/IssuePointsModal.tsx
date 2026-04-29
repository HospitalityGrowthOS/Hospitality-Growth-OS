'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  qr_code: string
  tier: string
  points_balance: number
  guest_name: string | null
}

type Props = {
  venueId: string
  members: Member[]
}

export default function IssuePointsModal({ venueId, members }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [points, setPoints]     = useState('')
  const [reason, setReason]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const reset = useCallback(() => {
    setMemberId(''); setPoints(''); setReason('')
    setError(''); setSuccess('')
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId) { setError('Please select a member'); return }
    if (!points || Number(points) < 1) { setError('Enter a valid point amount (min 1)'); return }
    if (!reason.trim()) { setError('Please enter a reason'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/loyalty/issue-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          venue_id:  venueId,
          points:    Number(points),
          reason:    reason.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to issue points')
        setLoading(false)
        return
      }

      const m = members.find(m => m.id === memberId)
      setSuccess(
        `✅ ${data.new_balance.toLocaleString()} pts — ${m?.guest_name ?? 'Member'} is now ${data.new_tier}`
      )
      setTimeout(() => {
        close()
        router.refresh()
      }, 1800)
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-ember text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Issue Points
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E0D4]">
              <h2 className="font-display font-semibold text-ink text-xl">Issue Bonus Points</h2>
              <button
                onClick={close}
                className="text-mid hover:text-ink transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {success ? (
                <div className="bg-[#2A9D5C]/10 border border-[#2A9D5C]/30 rounded-xl p-5 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-[#2A9D5C] font-semibold text-sm">{success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  {/* Member selector */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-mid mb-1.5">
                      Member
                    </label>
                    <select
                      value={memberId}
                      onChange={e => setMemberId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D4] text-[14px] text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all"
                    >
                      <option value="">Select a member…</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.guest_name ?? 'Unknown'} — {m.points_balance.toLocaleString()} pts ({m.tier}) · {m.qr_code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Points */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-mid mb-1.5">
                      Points to Issue
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={points}
                        onChange={e => setPoints(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D4] text-[14px] text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all"
                      />
                    </div>
                    {/* Quick picks */}
                    <div className="flex gap-2 mt-2">
                      {[10, 50, 100, 200].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPoints(String(n))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${points === String(n) ? 'bg-ember text-white border-ember' : 'border-[#E8E0D4] text-charcoal hover:border-ember/40'}`}
                        >
                          +{n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-mid mb-1.5">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Birthday bonus, Staff appreciation…"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E0D4] text-[14px] text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-ember/30 transition-all"
                    />
                    {/* Quick reasons */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Birthday bonus', 'Visit reward', 'Staff appreciation', 'Special occasion'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className="px-2.5 py-1 rounded-lg text-[11px] border border-[#E8E0D4] text-charcoal hover:border-ember/40 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="bg-[#C0392B]/5 border border-[#C0392B]/20 rounded-xl px-3 py-2.5 text-[12px] text-[#C0392B]">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={close}
                      className="flex-1 py-2.5 border border-[#E8E0D4] rounded-xl text-sm font-medium text-ink hover:bg-paper transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 bg-ember text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Issuing…
                        </>
                      ) : (
                        `Issue ${points ? `${Number(points).toLocaleString()} ` : ''}Points`
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
