'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'

export interface AiConfigValues {
  assistantName: string
  tone: string
  length: string
  houseRules: string
}

type State = 'idle' | 'saving' | 'saved' | 'error'

export default function AiConfigForm({
  initial,
  tones,
  lengths,
  model,
}: {
  initial: AiConfigValues
  tones: { value: string; label: string }[]
  lengths: { value: string; label: string }[]
  model: string
}) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  function set<K extends keyof AiConfigValues>(key: K, value: AiConfigValues[K]) {
    setValues(v => ({ ...v, [key]: value }))
    setState('idle')
  }

  async function save() {
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/venue/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_persona_name: values.assistantName,
          ai: {
            tone: values.tone,
            length: values.length,
            house_rules: values.houseRules,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save')
        setState('error')
        return
      }
      setState('saved')
      router.refresh()
    } catch {
      setError('Network error')
      setState('error')
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Voice</h2>
          <p className="text-xs text-mid mt-0.5">
            How your assistant sounds to guests. Applies on every channel.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Assistant name" hint="The name it uses when speaking to guests.">
            <Input
              value={values.assistantName}
              onChange={e => set('assistantName', e.target.value)}
              placeholder="Sofia"
              className="w-56"
            />
          </Field>

          <Field label="Brand tone">
            <div className="flex flex-wrap gap-2">
              {tones.map(t => (
                <Choice
                  key={t.value}
                  selected={values.tone === t.value}
                  onClick={() => set('tone', t.value)}
                  label={t.label}
                />
              ))}
            </div>
          </Field>

          <Field label="Response length">
            <div className="flex flex-wrap gap-2">
              {lengths.map(l => (
                <Choice
                  key={l.value}
                  selected={values.length === l.value}
                  onClick={() => set('length', l.value)}
                  label={l.label}
                />
              ))}
            </div>
          </Field>

          <Field
            label="House rules"
            hint="Anything the assistant should always or never do. Added to every reply instruction."
          >
            <textarea
              value={values.houseRules}
              onChange={e => set('houseRules', e.target.value)}
              rows={3}
              placeholder="e.g. Never quote prices. Always mention our Sunday roast when someone asks about weekends."
              className="w-full text-[13px] text-ink bg-white border border-border rounded-lg p-3 leading-relaxed resize-y focus:outline-none focus:border-ember/50"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} loading={state === 'saving'} disabled={state === 'saving'}>
              Save configuration
            </Button>
            {state === 'saved' && <span className="text-[13px] text-success">Saved</span>}
            {state === 'error' && <span className="text-[13px] text-ember">{error}</span>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Model</h2>
          <p className="text-xs text-mid mt-0.5">Set by your environment, not per venue.</p>
        </CardHeader>
        <CardBody className="space-y-3">
          <Row label="Active model" value={model} />
          <Row
            label="Language"
            value="Automatic"
            note="The assistant already replies in whatever language the guest writes in."
          />
          <Row
            label="Temperature"
            value="Not available"
            note="Current models reject this setting, so there is nothing to tune."
            muted
          />
          <Row
            label="AI provider"
            value="Anthropic"
            note="Provider selection arrives with multi-model support."
            planned
          />
        </CardBody>
      </Card>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-mid mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-mid/70 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  )
}

function Choice({
  selected,
  onClick,
  label,
}: {
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] rounded-full px-3 py-1.5 border transition-colors ${
        selected
          ? 'bg-ember/10 border-ember/40 text-ink font-medium'
          : 'bg-white border-border text-mid hover:text-ink hover:border-border-strong'
      }`}
    >
      {label}
    </button>
  )
}

function Row({
  label,
  value,
  note,
  planned,
  muted,
}: {
  label: string
  value: string
  note?: string
  planned?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] text-ink">{label}</p>
        {note && <p className="text-[11px] text-mid/70 mt-0.5 leading-relaxed">{note}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {planned && <Badge variant="default">Planned</Badge>}
        <span className={`font-data text-[12px] ${muted ? 'text-mid/60' : 'text-ink'}`}>{value}</span>
      </div>
    </div>
  )
}
