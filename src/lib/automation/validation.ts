/**
 * Workflow validation.
 *
 * Runs before a workflow is saved and again before it is activated. The second
 * check matters more: a draft with a broken action is harmless, but an active
 * one fails silently on every event, and silent failure is the defect class
 * this platform has spent the most time removing.
 */

import { ACTION_TYPES, CONDITION_OPERATORS, type WorkflowInput } from './types'
import { describeAction } from './actions'

/** Returns human-readable problems. Empty means valid. */
export function validateWorkflow(input: WorkflowInput): string[] {
  const problems: string[] = []

  if (!input.name?.trim()) problems.push('Give the workflow a name.')
  if (input.name && input.name.length > 120) problems.push('Name is too long.')

  // The engine matches trigger names as opaque strings, so the only structural
  // requirement is the namespace — it is what keeps future industry modules
  // from colliding with core events.
  if (!input.triggerEvent?.trim()) {
    problems.push('Choose a trigger.')
  } else if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(input.triggerEvent)) {
    problems.push('Trigger must be a namespaced event name, like "loyalty.tier_changed".')
  }

  const conditions = input.conditions ?? []
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i]
    const n = i + 1
    if (!condition.field?.trim()) problems.push(`Condition ${n} has no field.`)
    if (!CONDITION_OPERATORS.includes(condition.operator)) {
      problems.push(`Condition ${n} uses an unknown operator "${condition.operator}".`)
    }
    const needsValue = !['is_set', 'is_not_set'].includes(condition.operator)
    if (needsValue && (condition.value === undefined || condition.value === null || condition.value === '')) {
      problems.push(`Condition ${n} needs a value.`)
    }
  }

  const actions = input.actions ?? []
  if (!actions.length) problems.push('Add at least one action — a workflow that does nothing is not worth running.')

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const n = i + 1
    if (!ACTION_TYPES.includes(action.type)) {
      problems.push(`Action ${n} has an unknown type "${action.type}".`)
      continue
    }
    const descriptor = describeAction(action.type)
    for (const field of descriptor?.configFields ?? []) {
      if (!field.required) continue
      const value = (action.config ?? {})[field.key]
      if (value === undefined || value === null || String(value).trim() === '') {
        problems.push(`Action ${n} (${descriptor?.label}) needs "${field.label}".`)
      }
    }
  }

  const schedule = input.schedule
  if (schedule) {
    if (schedule.kind === 'delayed' && !(Number(schedule.delayMinutes) > 0)) {
      problems.push('A delayed workflow needs a delay greater than zero.')
    }
    if (schedule.kind === 'at' && !schedule.runAt) {
      problems.push('A scheduled workflow needs a date and time.')
    }
    if (schedule.kind === 'recurring' && !schedule.cron?.trim()) {
      problems.push('A recurring workflow needs a schedule expression.')
    }
  }

  return problems
}

/**
 * Warnings that should not block saving but the owner ought to see.
 *
 * Kept separate from problems: refusing to save a workflow because it uses an
 * unimplemented action would make the placeholders useless for planning.
 */
export function workflowWarnings(input: WorkflowInput): string[] {
  const warnings: string[] = []

  for (const action of input.actions ?? []) {
    const descriptor = describeAction(action.type)
    if (descriptor && !descriptor.implemented) {
      warnings.push(`"${descriptor.label}" is not connected yet — it will be recorded but not performed.`)
    }
  }

  if (input.schedule?.kind === 'recurring') {
    warnings.push('Recurring schedules are stored but not yet executed on a timer.')
  }

  if (!(input.conditions ?? []).length) {
    warnings.push('No conditions — this runs on every matching event.')
  }

  return warnings
}
