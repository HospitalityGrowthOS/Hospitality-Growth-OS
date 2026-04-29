'use client'
import { useState } from 'react'
import Button from '@/components/ui/Button'

interface Props {
  venueId: string
}

export default function CreateReviewRequestButton({ venueId }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ feedback_url: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/review-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, guest_name: name.trim(), guest_phone: phone.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setResult(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    if (!result) return
    const full = `${window.location.origin}${result.feedback_url}`
    navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setOpen(false)
    setName('')
    setPhone('')
    setResult(null)
    setError('')
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ New Request</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={reset}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            {!result ? (
              <>
                <h2 className="font-display font-semibold text-ink text-lg mb-1">New Review Request</h2>
                <p className="text-[12px] text-mid mb-5">Generate a feedback link for a guest</p>

                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-mid mb-1">Guest Name *</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Maria Rossi"
                      className="w-full border border-[#E8E0D4] rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 bg-paper"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-mid mb-1">Phone <span className="font-normal normal-case">(optional)</span></label>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+49 176 1234 5678"
                      className="w-full border border-[#E8E0D4] rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 bg-paper"
                    />
                  </div>
                </div>

                {error && <p className="text-ember text-xs mb-3">{error}</p>}

                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={loading} className="flex-1">
                    {loading ? 'Creating…' : 'Create Link'}
                  </Button>
                  <Button variant="secondary" onClick={reset}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="text-4xl mb-3">🔗</div>
                  <h2 className="font-display font-semibold text-ink text-lg mb-1">Link Created!</h2>
                  <p className="text-[12px] text-mid">Share this with {name} to collect their feedback</p>
                </div>

                <div className="bg-paper border border-[#E8E0D4] rounded-xl p-3 mb-4 font-data text-[11px] text-mid break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}${result.feedback_url}` : result.feedback_url}
                </div>

                <div className="flex gap-2">
                  <Button onClick={copyLink} className="flex-1">
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </Button>
                  <Button variant="secondary" onClick={reset}>Done</Button>
                </div>

                <p className="text-[10px] text-mid/60 text-center mt-3">
                  WhatsApp delivery coming soon via n8n
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
