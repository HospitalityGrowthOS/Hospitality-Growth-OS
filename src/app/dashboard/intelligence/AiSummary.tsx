'use client'

import { useState } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

type Period = 'daily' | 'weekly'
type State = 'idle' | 'working' | 'error'

/**
 * Written briefings, produced from figures already computed server-side.
 * Generated on request so a page view does not cost a model call.
 */
export default function AiSummary({ configured }: { configured: boolean }) {
  const [summaries, setSummaries] = useState<Partial<Record<Period, string>>>({})
  const [state, setState] = useState<State>('idle')
  const [active, setActive] = useState<Period | null>(null)
  const [error, setError] = useState('')

  async function generate(period: Period) {
    setState('working')
    setActive(period)
    setError('')
    try {
      const res = await fetch('/api/intelligence/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not generate a briefing')
        setState('error')
        return
      }
      setSummaries(prev => ({ ...prev, [period]: data.summary }))
      setState('idle')
    } catch {
      setError('Network error')
      setState('error')
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Briefing</h2>
          <p className="text-xs text-mid mt-0.5">
            Written from your own figures — no number appears that wasn&rsquo;t measured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => generate('daily')}
            loading={state === 'working' && active === 'daily'}
            disabled={!configured || state === 'working'}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => generate('weekly')}
            loading={state === 'working' && active === 'weekly'}
            disabled={!configured || state === 'working'}
          >
            This month
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {!configured && (
          <p className="text-[13px] text-mid">
            Briefings need an API key. Add <code className="font-data text-[11px]">ANTHROPIC_API_KEY</code> to
            enable them.
          </p>
        )}

        {state === 'error' && <p className="text-[13px] text-ember">{error}</p>}

        {(['daily', 'weekly'] as Period[]).map(period =>
          summaries[period] ? (
            <div key={period} className="p-3.5 rounded-lg bg-paper border border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-mid mb-1.5">
                {period === 'daily' ? 'Today' : 'This month'}
              </p>
              <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
                {summaries[period]}
              </p>
            </div>
          ) : null
        )}

        {configured && !summaries.daily && !summaries.weekly && state !== 'error' && (
          <p className="text-[13px] text-mid">
            Generate a briefing to see what your numbers add up to in plain language.
          </p>
        )}
      </CardBody>
    </Card>
  )
}
