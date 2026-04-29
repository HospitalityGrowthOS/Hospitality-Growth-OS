'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface RequestInfo {
  id: string
  guest_name: string | null
  venue_name: string
}

type PageState = 'loading' | 'ready' | 'submitting' | 'positive' | 'negative' | 'error' | 'already_done'

export default function FeedbackPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const router = useRouter()

  const [state, setPageState] = useState<PageState>('loading')
  const [info, setInfo] = useState<RequestInfo | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/feedback/${requestId}`)
        if (res.status === 409) {
          setPageState('already_done')
          return
        }
        if (!res.ok) {
          setPageState('error')
          return
        }
        const data = await res.json()
        setInfo(data)
        setPageState('ready')
      } catch {
        setPageState('error')
      }
    }
    load()
  }, [requestId])

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    setError('')
    setPageState('submitting')

    try {
      const res = await fetch(`/api/feedback/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback: feedback.trim() || undefined }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_completed') {
          setPageState('already_done')
          return
        }
        setPageState('error')
        return
      }

      setPageState(data.status === 'positive' ? 'positive' : 'negative')
    } catch {
      setPageState('error')
    }
  }

  // ── States ────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-ember/20 border-t-ember animate-spin" />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <Screen>
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">Link not found</h1>
        <p className="text-mid text-sm text-center">This feedback link may be invalid or expired.</p>
      </Screen>
    )
  }

  if (state === 'already_done') {
    return (
      <Screen>
        <div className="text-5xl mb-4">✅</div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">Already submitted</h1>
        <p className="text-mid text-sm text-center">Your feedback has already been recorded. Thank you!</p>
      </Screen>
    )
  }

  if (state === 'positive') {
    return (
      <Screen>
        <div className="text-6xl mb-5">🌟</div>
        <h1 className="font-display text-2xl font-bold text-ink mb-3 text-center">
          We're so glad you had a great experience!
        </h1>
        <p className="text-mid text-sm text-center mb-8 px-2">
          Would you mind sharing your experience on Google? It helps others find us and means the world to our team.
        </p>
        <a
          href="https://g.page/r/PLACEHOLDER_GOOGLE_REVIEW_LINK"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-ember text-white text-center font-semibold py-4 rounded-xl text-base mb-3 active:opacity-90 transition-opacity"
        >
          Leave a Google Review ⭐
        </a>
        <p className="text-[11px] text-mid/60 text-center mt-2">
          Takes less than a minute
        </p>
      </Screen>
    )
  }

  if (state === 'negative') {
    return (
      <Screen>
        <div className="text-6xl mb-5">🙏</div>
        <h1 className="font-display text-2xl font-bold text-ink mb-3 text-center">
          Thank you for your feedback
        </h1>
        <p className="text-mid text-sm text-center px-2">
          We take every piece of feedback seriously. Our team will review your comments and use them to improve your next visit.
        </p>
        <div className="mt-8 bg-white rounded-xl border border-black/[0.06] p-4 text-center">
          <p className="text-xs text-mid">We hope to see you again soon 💛</p>
        </div>
      </Screen>
    )
  }

  // ── Main feedback form ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center px-5 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-ember/20">
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
            <rect x="5" y="7" width="6" height="20" rx="1" fill="white"/>
            <rect x="23" y="7" width="6" height="20" rx="1" fill="white"/>
            <rect x="5" y="14" width="24" height="6" rx="1" fill="rgba(0,0,0,0.3)"/>
            <path d="M26 4L34 4L34 12" stroke="#C8A45A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 6L34 4" stroke="#C8A45A" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          {info?.guest_name ? `Hi ${info.guest_name.split(' ')[0]}!` : 'How was your visit?'}
        </h1>
        <p className="text-mid text-sm mt-1">
          {info?.venue_name}
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-black/[0.06] p-6">
        <p className="text-sm font-medium text-ink/80 text-center mb-5">
          How would you rate your experience?
        </p>

        {/* Star rating */}
        <div className="flex justify-center gap-3 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="text-4xl transition-transform active:scale-95 hover:scale-110"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            >
              <span className={`transition-colors ${
                star <= (hovered || rating) ? 'text-gold' : 'text-black/20'
              }`}>★</span>
            </button>
          ))}
        </div>

        {/* Rating label */}
        {rating > 0 && (
          <p className="text-center text-sm font-medium text-ember mb-4 -mt-2">
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Great'}
            {rating === 5 && 'Excellent!'}
          </p>
        )}

        {/* Optional text feedback */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-mid mb-1.5 uppercase tracking-wide">
            Tell us more <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What did you enjoy? What could we improve?"
            rows={3}
            maxLength={2000}
            className="w-full bg-paper border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm text-ink placeholder-mid/50 resize-none focus:outline-none focus:ring-2 focus:ring-ember/30 focus:border-ember/40 transition"
          />
        </div>

        {error && (
          <p className="text-ember text-xs text-center mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={state === 'submitting'}
          className="w-full bg-ember text-white font-semibold py-3.5 rounded-xl text-sm active:opacity-90 hover:opacity-95 transition-opacity disabled:opacity-60"
        >
          {state === 'submitting' ? 'Sending…' : 'Submit Feedback'}
        </button>
      </div>

      <p className="text-[11px] text-mid/50 mt-6 text-center">
        Your feedback is private and helps us improve your next visit.
      </p>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xs w-full">
        {children}
      </div>
    </div>
  )
}
