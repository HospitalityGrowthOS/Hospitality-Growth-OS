'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

export interface ReviewDraftItem {
  id: string
  rating: number
  content: string | null
  authorName: string | null
  draft: string | null
  reviewDate: string | null
}

type State = 'idle' | 'working' | 'error'

/**
 * A review alongside its AI draft. The draft is always editable and is never
 * published from here — the owner copies it to the review platform.
 */
export default function ReviewDraftCard({ review }: { review: ReviewDraftItem }) {
  const router = useRouter()
  const [draft, setDraft] = useState(review.draft ?? '')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setState('working')
    setError('')
    try {
      const res = await fetch('/api/reviews/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not generate a draft')
        setState('error')
        return
      }
      setDraft(data.draft)
      setState('idle')
      router.refresh()
    } catch {
      setError('Network error')
      setState('error')
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <div className="p-4 rounded-lg border border-border bg-paper/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-ink">
              {review.authorName || 'Anonymous'}
            </span>
            <span className="text-[12px] text-gold">
              {'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}
            </span>
            {review.rating <= 3 && <Badge variant="warning">Needs care</Badge>}
          </div>
          {review.content && (
            <p className="text-xs text-mid mt-1.5 leading-relaxed">{review.content}</p>
          )}
        </div>
        <span className="text-[11px] text-mid shrink-0">
          {review.reviewDate ? new Date(review.reviewDate).toLocaleDateString('en-GB') : ''}
        </span>
      </div>

      {draft ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            className="w-full text-[13px] text-ink bg-white border border-border rounded-lg p-3 leading-relaxed resize-y focus:outline-none focus:border-ember/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy reply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={generate} loading={state === 'working'}>
              Rewrite
            </Button>
            <span className="text-[11px] text-mid">Edit before posting — nothing is published for you.</span>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={generate} loading={state === 'working'}>
            Draft a reply
          </Button>
          {state === 'error' && <span className="text-[12px] text-ember">{error}</span>}
        </div>
      )}

      {draft && state === 'error' && <p className="text-[12px] text-ember">{error}</p>}
    </div>
  )
}
