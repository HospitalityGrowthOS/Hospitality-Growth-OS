'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

export interface KnowledgeField {
  topic: string
  label: string
  hint: string
  /** Owner-written value. Empty means the topic falls back or stays unanswered. */
  value: string
  /** Value derived from venue data when the owner hasn't written one. */
  derived: string | null
}

/**
 * Knowledge groups. Adding a category is a matter of adding a topic to
 * FAQ_TOPICS and listing it here — no new UI.
 */
export interface KnowledgeSection {
  title: string
  description: string
  fields: KnowledgeField[]
}

type State = 'idle' | 'saving' | 'saved' | 'error'

export default function KnowledgeEditor({ sections }: { sections: KnowledgeSection[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sections.flatMap(s => s.fields.map(f => [f.topic, f.value]))
    )
  )
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  function set(topic: string, value: string) {
    setValues(v => ({ ...v, [topic]: value }))
    setState('idle')
  }

  async function save() {
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/venue/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faq: values }),
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

  const answered = Object.values(values).filter(v => v.trim()).length
  const total = sections.reduce((n, s) => n + s.fields.length, 0)

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardBody className="flex items-center justify-between py-3.5">
          <div>
            <p className="text-[13px] font-medium text-ink">
              {answered} of {total} topics answered
            </p>
            <p className="text-xs text-mid mt-0.5">
              Anything left blank, the assistant says it will check with your team rather than
              guessing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {state === 'saved' && <span className="text-[13px] text-success">Saved</span>}
            {state === 'error' && <span className="text-[13px] text-ember">{error}</span>}
            <Button onClick={save} loading={state === 'saving'} disabled={state === 'saving'}>
              Save knowledge
            </Button>
          </div>
        </CardBody>
      </Card>

      {sections.map(section => (
        <Card key={section.title}>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">{section.title}</h2>
            <p className="text-xs text-mid mt-0.5">{section.description}</p>
          </CardHeader>
          <CardBody className="space-y-4">
            {section.fields.map(field => {
              const value = values[field.topic] ?? ''
              const usingDerived = !value.trim() && field.derived
              return (
                <div key={field.topic}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-mid">
                      {field.label}
                    </label>
                    {usingDerived && <Badge variant="default">Automatic</Badge>}
                    {!value.trim() && !field.derived && <Badge variant="warning">Unanswered</Badge>}
                  </div>
                  <textarea
                    value={value}
                    onChange={e => set(field.topic, e.target.value)}
                    rows={2}
                    placeholder={field.derived ? `Currently: ${field.derived}` : 'Not answered yet'}
                    className="w-full text-[13px] text-ink bg-white border border-border rounded-lg p-3 leading-relaxed resize-y focus:outline-none focus:border-ember/50"
                  />
                  <p className="text-[11px] text-mid/70 mt-1.5">{field.hint}</p>
                </div>
              )
            })}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
