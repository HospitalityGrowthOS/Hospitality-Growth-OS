'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { INTENT_LABELS, isIntent, type Intent, type Sentiment } from '@/lib/ai/types'

export interface ConsoleGuest {
  id: string
  label: string
  tier: string | null
  points: number | null
}

interface Reservation {
  date: string | null
  time: string | null
  partySize: number | null
  notes: string | null
}

interface Exchange {
  id: string
  question: string
  askedAt: string
  /** Absent while the reply is still in flight. */
  answer?: string
  intent?: Intent
  sentiment?: Sentiment
  escalated?: boolean
  escalationReason?: string | null
  reservation?: Reservation | null
  loyalty?: { name: string | null; tier: string | null; points: number | null } | null
  model?: string
  latencyMs?: number
  answeredAt?: string
  error?: string
}

const SENTIMENT_VARIANT: Record<Sentiment, 'success' | 'default' | 'danger'> = {
  positive: 'success',
  neutral:  'default',
  negative: 'danger',
}

const SUGGESTIONS = [
  'What time do you open on Monday?',
  'Do you have parking nearby?',
  'Table for 4 on Friday at 8pm',
  'Does the lasagne contain nuts?',
  'How many loyalty points do I have?',
]

export default function Console({
  configured,
  guests,
}: {
  configured: boolean
  guests: ConsoleGuest[]
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string>('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return

    const id = crypto.randomUUID()
    setExchanges(prev => [...prev, { id, question, askedAt: new Date().toISOString() }])
    setDraft('')
    setBusy(true)

    try {
      const res = await fetch('/api/ai/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          conversation_id: conversationId ?? undefined,
          guest_id: guestId || undefined,
        }),
      })
      const data = await res.json()

      if (data.conversation_id) setConversationId(data.conversation_id)

      setExchanges(prev =>
        prev.map(e =>
          e.id !== id
            ? e
            : res.ok
              ? {
                  ...e,
                  answer: data.reply,
                  intent: data.intent,
                  sentiment: data.sentiment,
                  escalated: data.escalated,
                  escalationReason: data.escalation_reason,
                  reservation: data.reservation,
                  loyalty: data.loyalty,
                  model: data.model,
                  latencyMs: data.latency_ms,
                  answeredAt: data.at,
                }
              : { ...e, error: data.error || 'The assistant could not reply.' }
        )
      )
    } catch {
      setExchanges(prev =>
        prev.map(e => (e.id === id ? { ...e, error: 'Network error' } : e))
      )
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setExchanges([])
    setConversationId(null)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-mid">
              Answer as
            </label>
            <select
              value={guestId}
              onChange={e => setGuestId(e.target.value)}
              className="text-[13px] bg-white border border-border rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-ember/50"
            >
              <option value="">Anonymous guest</option>
              {guests.map(g => (
                <option key={g.id} value={g.id}>
                  {g.label}
                  {g.points !== null ? ` · ${g.points} pts` : ''}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-mid">
            {conversationId ? 'Continuing a thread' : 'New conversation'}
          </span>

          <div className="ml-auto">
            <Button size="sm" variant="ghost" onClick={reset} disabled={!exchanges.length}>
              Start over
            </Button>
          </div>
        </CardBody>
      </Card>

      {!configured && (
        <Card className="border-l-2 border-l-ember">
          <CardBody className="py-3.5">
            <p className="text-[13px] font-medium text-ink">The assistant is not configured</p>
            <p className="text-xs text-mid mt-1 leading-relaxed">
              Add <code className="font-data text-[11px]">ANTHROPIC_API_KEY</code> to your
              environment variables and redeploy. Messages sent here will be stored but not answered.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Transcript */}
      <Card>
        <CardBody className="min-h-[320px] space-y-4">
          {exchanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="font-display font-semibold text-ink mb-1">
                Ask the assistant anything
              </h3>
              <p className="text-[13px] text-mid max-w-md leading-relaxed mb-5">
                This runs the same pipeline as WhatsApp — the same analysis, prompts and
                escalation rules — so what you see here is what a guest would get.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[12px] text-mid hover:text-ink border border-border hover:border-border-strong rounded-full px-3 py-1.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            exchanges.map(e => <ExchangeView key={e.id} exchange={e} />)
          )}
          <div ref={endRef} />
        </CardBody>
      </Card>

      {/* Composer */}
      <Card>
        <CardBody className="flex items-center gap-3 py-3">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            placeholder="Type a message a guest might send…"
            className="flex-1"
          />
          <Button onClick={() => send(draft)} loading={busy} disabled={!draft.trim() || busy}>
            Send
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

function ExchangeView({ exchange: e }: { exchange: Exchange }) {
  const pending = !e.answer && !e.error

  return (
    <div className="space-y-2">
      {/* Guest */}
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-ember text-white rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-[13px] leading-relaxed">{e.question}</p>
          <p className="text-[10px] text-white/60 mt-1">{fmtTime(e.askedAt)}</p>
        </div>
      </div>

      {/* Assistant */}
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full">
          <div className="bg-paper border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
            {pending ? (
              <p className="text-[13px] text-mid italic">Thinking…</p>
            ) : e.error ? (
              <p className="text-[13px] text-ember">{e.error}</p>
            ) : (
              <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{e.answer}</p>
            )}
          </div>

          {!pending && !e.error && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {e.intent && (
                  <Badge variant="teal">
                    {isIntent(e.intent) ? INTENT_LABELS[e.intent] : e.intent}
                  </Badge>
                )}
                {e.sentiment && (
                  <Badge variant={SENTIMENT_VARIANT[e.sentiment]}>{e.sentiment}</Badge>
                )}
                {e.escalated && <Badge variant="danger">Escalated</Badge>}
                {e.reservation && <Badge variant="gold">Reservation captured</Badge>}
                {e.loyalty && (
                  <Badge variant="default">
                    {e.loyalty.tier ?? 'no tier'} · {e.loyalty.points ?? 0} pts
                  </Badge>
                )}
              </div>

              {e.escalated && e.escalationReason && (
                <p className="text-[11px] text-mid">
                  Handed over: {e.escalationReason}
                </p>
              )}

              {e.reservation && (
                <div className="text-[11px] text-mid bg-white border border-border rounded-lg px-3 py-2">
                  <span className="font-medium text-ink">Extracted: </span>
                  {e.reservation.partySize ? `${e.reservation.partySize} people` : 'party size not given'}
                  {' · '}
                  {e.reservation.date ?? 'no date given'}
                  {e.reservation.time ? ` at ${e.reservation.time}` : ''}
                  {e.reservation.notes ? ` · ${e.reservation.notes}` : ''}
                </div>
              )}

              <p className="text-[10px] text-mid/70 font-data">
                {e.model}
                {e.latencyMs !== undefined ? ` · ${(e.latencyMs / 1000).toFixed(1)}s` : ''}
                {e.answeredAt ? ` · ${fmtTime(e.answeredAt)}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
