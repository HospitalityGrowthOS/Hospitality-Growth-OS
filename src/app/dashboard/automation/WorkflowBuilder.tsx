'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type {
  Action, ActionDescriptor, ActionType, Condition, ConditionFieldDescriptor,
  ConditionOperator, Schedule, TriggerDescriptor, Workflow, WorkflowInput,
} from '@/lib/automation'

/**
 * Step-based workflow builder.
 *
 * Deliberately not drag-and-drop. The workflow it produces is a plain
 * `WorkflowInput` — the same object the API and the templates use — so a
 * canvas editor can replace this component later without the engine, the
 * schema or the API changing at all.
 */

const STEPS = ['Trigger', 'Conditions', 'Actions', 'Review'] as const
type Step = (typeof STEPS)[number]

interface Props {
  triggers: { category: string; triggers: TriggerDescriptor[] }[]
  fields: ConditionFieldDescriptor[]
  actions: ActionDescriptor[]
  existing?: Workflow
}

export default function WorkflowBuilder({ triggers, fields, actions, existing }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('Trigger')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [triggerEvent, setTriggerEvent] = useState(existing?.triggerEvent ?? '')
  const [conditions, setConditions] = useState<Condition[]>(existing?.conditions ?? [])
  const [chosenActions, setChosenActions] = useState<Action[]>(existing?.actions ?? [])
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? { kind: 'immediate' })
  const [dryRun, setDryRun] = useState(existing?.dryRun ?? false)
  const [requiresApproval, setRequiresApproval] = useState(existing?.requiresApproval ?? false)

  const selectedTrigger = triggers.flatMap(g => g.triggers).find(t => t.event === triggerEvent)

  function buildInput(status?: 'draft' | 'active'): WorkflowInput {
    return {
      name: name.trim(),
      description: description.trim() || null,
      status: status ?? existing?.status ?? 'draft',
      triggerEvent: triggerEvent as `${string}.${string}`,
      conditions,
      actions: chosenActions,
      schedule,
      dryRun,
      requiresApproval,
      templateKey: existing?.templateKey ?? null,
    }
  }

  async function save(status?: 'draft' | 'active') {
    setSaving(true); setError('')
    try {
      const url = existing ? `/api/automation/workflows/${existing.id}` : '/api/automation/workflows'
      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInput(status)),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save'); return }
      router.push(`/dashboard/automation/workflows/${data.workflow.id}`)
      router.refresh()
    } catch {
      setError('Could not reach the server')
    } finally {
      setSaving(false)
    }
  }

  // ── Step bodies ────────────────────────────────────────────────────────────

  const triggerStep = (
    <div className="space-y-4">
      <Field label="Workflow name">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Welcome new members"
          className={inputCls} />
      </Field>
      <Field label="Description" hint="optional">
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this is for"
          className={inputCls} />
      </Field>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-mid mb-2">When this happens</p>
        <div className="space-y-3">
          {triggers.map(group => (
            <div key={group.category}>
              <p className="text-[11px] text-mid/70 mb-1.5">{group.category}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.triggers.map(t => (
                  <button
                    key={t.event}
                    type="button"
                    onClick={() => setTriggerEvent(t.event)}
                    className={cn(
                      'text-left p-3 rounded-lg border transition-colors',
                      triggerEvent === t.event
                        ? 'border-ember bg-ember/5'
                        : 'border-border hover:border-ember/40 bg-white'
                    )}
                  >
                    <p className="text-[13px] font-medium text-ink">{t.label}</p>
                    <p className="text-[11px] text-mid mt-0.5 leading-snug">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const conditionsStep = (
    <div className="space-y-3">
      <p className="text-[12px] text-mid">
        All conditions must pass. With none, the workflow runs on every matching event.
      </p>
      {conditions.map((c, i) => {
        const descriptor = fields.find(f => f.field === c.field)
        return (
          <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-paper/40">
            <select
              value={c.field}
              onChange={e => updateCondition(i, { ...c, field: e.target.value })}
              className={selectCls}
            >
              <option value="">Choose a field…</option>
              {fields.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
            <select
              value={c.operator}
              onChange={e => updateCondition(i, { ...c, operator: e.target.value as ConditionOperator })}
              className={selectCls}
            >
              {(descriptor?.operators ?? ['eq']).map(op => (
                <option key={op} value={op}>{OPERATOR_LABEL[op] ?? op}</option>
              ))}
            </select>
            {!['is_set', 'is_not_set'].includes(c.operator) && (
              descriptor?.options
                ? (
                  <select
                    value={String(c.value ?? '')}
                    onChange={e => updateCondition(i, { ...c, value: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Choose…</option>
                    {descriptor.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    value={String(c.value ?? '')}
                    onChange={e => updateCondition(i, { ...c, value: e.target.value })}
                    placeholder="Value"
                    className={cn(inputCls, 'flex-1')}
                  />
                )
            )}
            <button type="button" onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
              className="text-mid hover:text-ember px-1 shrink-0">✕</button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => setConditions([...conditions, { field: '', operator: 'eq', value: '' }])}
        className="text-[13px] text-teal hover:underline"
      >
        + Add condition
      </button>
    </div>
  )

  const actionsStep = (
    <div className="space-y-4">
      <div className="space-y-3">
        {chosenActions.map((a, i) => {
          const descriptor = actions.find(d => d.type === a.type)
          return (
            <div key={i} className="p-3.5 rounded-lg border border-border bg-paper/40 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{descriptor?.label ?? a.type}</span>
                  {descriptor && !descriptor.implemented && <Badge variant="warning">Not connected</Badge>}
                </div>
                <button type="button" onClick={() => setChosenActions(chosenActions.filter((_, j) => j !== i))}
                  className="text-mid hover:text-ember">✕</button>
              </div>
              {descriptor?.configFields.map(f => (
                <div key={f.key}>
                  <label className="text-[11px] text-mid block mb-1">
                    {f.label}{f.required && <span className="text-ember"> *</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={String(a.config?.[f.key] ?? '')}
                      onChange={e => updateAction(i, { ...a, config: { ...a.config, [f.key]: e.target.value } })}
                      rows={3}
                      className={cn(inputCls, 'resize-y font-sans')}
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={String(a.config?.[f.key] ?? '')}
                      onChange={e => updateAction(i, {
                        ...a,
                        config: { ...a.config, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value },
                      })}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
              <p className="text-[11px] text-mid">
                Use <span className="font-data">{'{{ guest.name }}'}</span> to insert values.
              </p>
            </div>
          )
        })}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-mid mb-2">Add an action</p>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(d => (
            <button
              key={d.type}
              type="button"
              onClick={() => setChosenActions([...chosenActions, { type: d.type as ActionType, config: {} }])}
              className="text-left p-2.5 rounded-lg border border-border hover:border-ember/40 bg-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-ink">{d.label}</span>
                {!d.implemented && <span className="text-[10px] text-gold">soon</span>}
              </div>
              <p className="text-[11px] text-mid mt-0.5 leading-snug">{d.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const reviewStep = (
    <div className="space-y-4">
      <Summary label="Name" value={name || '—'} />
      <Summary label="Trigger" value={selectedTrigger?.label ?? triggerEvent ?? '—'} />
      <Summary label="Conditions" value={conditions.length ? `${conditions.length} — all must pass` : 'None — runs on every matching event'} />
      <Summary label="Actions" value={chosenActions.length ? chosenActions.map(a => actions.find(d => d.type === a.type)?.label ?? a.type).join(', ') : 'None'} />

      <div>
        <p className="text-[11px] uppercase tracking-wider text-mid mb-2">When to run</p>
        <div className="flex items-center gap-2">
          <select value={schedule.kind} onChange={e => setSchedule({ kind: e.target.value as Schedule['kind'] })} className={selectCls}>
            <option value="immediate">Immediately</option>
            <option value="delayed">After a delay</option>
            <option value="at">At a specific time</option>
          </select>
          {schedule.kind === 'delayed' && (
            <input type="number" min={1} value={schedule.delayMinutes ?? 60}
              onChange={e => setSchedule({ kind: 'delayed', delayMinutes: Number(e.target.value) })}
              className={cn(inputCls, 'w-28')} placeholder="Minutes" />
          )}
          {schedule.kind === 'at' && (
            <input type="datetime-local"
              onChange={e => setSchedule({ kind: 'at', runAt: new Date(e.target.value).toISOString() })}
              className={inputCls} />
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <Toggle checked={dryRun} onChange={setDryRun}
          label="Dry run"
          hint="Evaluate and record everything, perform nothing. Nothing reaches a guest." />
        <Toggle checked={requiresApproval} onChange={setRequiresApproval}
          label="Require approval"
          hint="Hold every run until you approve it." />
      </div>

      {error && <p className="text-[12px] text-[#C0392B]">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => save('draft')} disabled={saving}
          className="px-4 py-2 rounded-lg border border-border text-[13px] text-ink hover:bg-paper transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button onClick={() => save('active')} disabled={saving}
          className="px-4 py-2 rounded-lg bg-ember text-white text-[13px] font-medium hover:bg-ember/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save and activate'}
        </button>
      </div>
    </div>
  )

  function updateCondition(i: number, next: Condition) {
    setConditions(conditions.map((c, j) => (j === i ? next : c)))
  }
  function updateAction(i: number, next: Action) {
    setChosenActions(chosenActions.map((a, j) => (j === i ? next : a)))
  }

  const bodies: Record<Step, React.ReactNode> = {
    Trigger: triggerStep, Conditions: conditionsStep, Actions: actionsStep, Review: reviewStep,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors',
                step === s ? 'bg-ember/10 text-ink font-medium' : 'text-mid hover:text-ink'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-data',
                step === s ? 'bg-ember text-white' : 'bg-paper text-mid'
              )}>{i + 1}</span>
              {s}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        {bodies[step]}
        {step !== 'Review' && (
          <div className="flex justify-end pt-4 mt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
              className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink/90 transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Small presentational helpers ─────────────────────────────────────────────

const inputCls = 'w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-ember focus:ring-2 focus:ring-ember/10 transition-all'
const selectCls = 'bg-white border border-border rounded-lg px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ember transition-all'

const OPERATOR_LABEL: Record<string, string> = {
  eq: 'is', neq: 'is not', gt: 'is more than', gte: 'is at least',
  lt: 'is less than', lte: 'is at most', in: 'is one of', not_in: 'is not one of',
  contains: 'contains', is_set: 'is set', is_not_set: 'is not set',
  within_days: 'within the last (days)', older_than_days: 'more than (days) ago',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-mid block mb-1.5">
        {label}{hint && <span className="normal-case tracking-normal text-mid/70"> — {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <span className="text-mid">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        <span className="text-[13px] text-ink">{label}</span>
        <span className="block text-[11px] text-mid">{hint}</span>
      </span>
    </label>
  )
}
