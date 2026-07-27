'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export interface VenueSettingsValues {
  name: string
  city: string
  address: string
  google_review_url: string
  ai_persona_name: string
  review_delay_minutes: number
  points_per_euro: number
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsForm({ initial }: { initial: VenueSettingsValues }) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState('')

  function set<K extends keyof VenueSettingsValues>(key: K, value: VenueSettingsValues[K]) {
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
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save')
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
    <div className="max-w-2xl space-y-5">
      {/* Venue details */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Venue details</h2>
          <p className="text-xs text-mid mt-0.5">Shown to guests on signup pages and in messages.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Venue name">
            <Input value={values.name} onChange={e => set('name', e.target.value)} placeholder="Ristorante Milano" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input value={values.city} onChange={e => set('city', e.target.value)} placeholder="Cologne" />
            </Field>
            <Field label="Address">
              <Input value={values.address} onChange={e => set('address', e.target.value)} placeholder="Venloer Str. 1" />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Review automation</h2>
          <p className="text-xs text-mid mt-0.5">
            Guests who rate 4–5 stars are sent to Google. Lower ratings stay private and appear as an action item.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field
            label="Google review link"
            hint="Google Maps → your venue → Share → copy link. Without this, happy guests see a thank-you instead of a review prompt."
          >
            <Input
              value={values.google_review_url}
              onChange={e => set('google_review_url', e.target.value)}
              placeholder="https://g.page/r/..."
            />
          </Field>
          <Field label="Delay after visit" hint="How long to wait before asking for feedback.">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={1440}
                value={values.review_delay_minutes}
                onChange={e => set('review_delay_minutes', Number(e.target.value))}
                className="w-28"
              />
              <span className="text-[13px] text-mid">minutes</span>
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* Loyalty + AI */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Loyalty &amp; assistant</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Points per €1 spent">
            <Input
              type="number"
              min={0}
              value={values.points_per_euro}
              onChange={e => set('points_per_euro', Number(e.target.value))}
              className="w-28"
            />
          </Field>
          <Field label="AI assistant name" hint="The name your assistant uses when replying to guests on WhatsApp.">
            <Input
              value={values.ai_persona_name}
              onChange={e => set('ai_persona_name', e.target.value)}
              placeholder="Sofia"
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={state === 'saving'} disabled={state === 'saving'}>
          Save changes
        </Button>
        {state === 'saved' && <span className="text-[13px] text-success">Saved</span>}
        {state === 'error' && <span className="text-[13px] text-ember">{error}</span>}
      </div>
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
