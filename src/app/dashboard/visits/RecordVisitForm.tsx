'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type State = 'idle' | 'saving' | 'saved' | 'error'

export default function RecordVisitForm({ delayMinutes, currencySym }: { delayMinutes: number; currencySym: string }) {
  const router = useRouter()
  const [phone, setPhone]   = useState('')
  const [spend, setSpend]   = useState('')
  const [party, setParty]   = useState('2')
  const [table, setTable]   = useState('')
  const [state, setState]   = useState<State>('idle')
  const [error, setError]   = useState('')

  const canSubmit = phone.trim().length >= 7 && state !== 'saving'

  async function submit() {
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/visits/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_phone:  phone.trim(),
          spend_amount: spend ? Number(spend) : 0,
          party_size:   party ? Number(party) : 1,
          table_number: table.trim() || undefined,
          source:       'walkin',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not record this visit')
        setState('error')
        return
      }
      setPhone(''); setSpend(''); setTable(''); setParty('2')
      setState('saved')
      router.refresh()
    } catch {
      setError('Network error')
      setState('error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-[15px] font-semibold text-ink">Record a visit</h2>
        <p className="text-xs text-mid mt-0.5">
          Points are awarded straight away. The review request goes out {delayMinutes} minutes later.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Guest WhatsApp number" hint="With country code, e.g. +49 155 1234567">
            <Input
              value={phone}
              onChange={e => { setPhone(e.target.value); setState('idle') }}
              placeholder="+49 155 1234567"
              inputMode="tel"
            />
          </Field>
          <Field label="Amount spent">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-mid">{currencySym}</span>
              <Input
                type="number" min={0} step="0.01"
                value={spend}
                onChange={e => { setSpend(e.target.value); setState('idle') }}
                placeholder="0.00"
              />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Party size">
            <Input
              type="number" min={1}
              value={party}
              onChange={e => setParty(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Table" hint="Optional">
            <Input
              value={table}
              onChange={e => setTable(e.target.value)}
              placeholder="12"
              className="w-24"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={submit} loading={state === 'saving'} disabled={!canSubmit}>
            Record visit
          </Button>
          {state === 'saved' && (
            <span className="text-[13px] text-success">
              Visit recorded — review request queued
            </span>
          )}
          {state === 'error' && <span className="text-[13px] text-ember">{error}</span>}
        </div>
      </CardBody>
    </Card>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-mid mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-mid/70 mt-1.5">{hint}</p>}
    </div>
  )
}
