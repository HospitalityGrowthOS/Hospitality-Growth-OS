'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export interface FilterState {
  channel: string
  intent: string
  sentiment: string
  status: string
  q: string
}

/**
 * Filters are held in the URL so a filtered view can be linked or reloaded,
 * and so the page stays a server component.
 */
export default function ConversationFilters({
  channels,
  intents,
  intentLabels,
  sentiments,
  current,
}: {
  channels: string[]
  intents: string[]
  intentLabels: Record<string, string>
  sentiments: string[]
  current: FilterState
}) {
  const router = useRouter()
  const [state, setState] = useState<FilterState>(current)

  function apply(next: FilterState) {
    setState(next)
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    router.push(`/dashboard/ai/conversations${params.toString() ? `?${params}` : ''}`)
  }

  const hasFilters = Object.values(state).some(Boolean)

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-3 py-3">
        <Field label="Search">
          <form
            onSubmit={e => { e.preventDefault(); apply(state) }}
            className="flex items-center gap-2"
          >
            <Input
              value={state.q}
              onChange={e => setState({ ...state, q: e.target.value })}
              placeholder="Message text…"
              className="w-52"
            />
            <Button size="sm" variant="secondary" type="submit">Search</Button>
          </form>
        </Field>

        <Field label="Channel">
          <Select
            value={state.channel}
            onChange={v => apply({ ...state, channel: v })}
            options={[{ value: '', label: 'All' }, ...channels.map(c => ({ value: c, label: c }))]}
          />
        </Field>

        <Field label="Intent">
          <Select
            value={state.intent}
            onChange={v => apply({ ...state, intent: v })}
            options={[
              { value: '', label: 'All' },
              ...intents.map(i => ({ value: i, label: intentLabels[i] ?? i })),
            ]}
          />
        </Field>

        <Field label="Sentiment">
          <Select
            value={state.sentiment}
            onChange={v => apply({ ...state, sentiment: v })}
            options={[{ value: '', label: 'All' }, ...sentiments.map(s => ({ value: s, label: s }))]}
          />
        </Field>

        <Field label="Status">
          <Select
            value={state.status}
            onChange={v => apply({ ...state, status: v })}
            options={[
              { value: '', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'escalated', label: 'Escalated' },
            ]}
          />
        </Field>

        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => apply({ channel: '', intent: '', sentiment: '', status: '', q: '' })}
          >
            Clear
          </Button>
        )}
      </CardBody>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-mid mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[13px] bg-white border border-border rounded-lg px-2.5 py-2 text-ink capitalize focus:outline-none focus:border-ember/50"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
