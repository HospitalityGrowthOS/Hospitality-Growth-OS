/**
 * Shared presentation for the Automation Center.
 *
 * Rendering only. Every decision these components display was made in
 * `src/lib/automation` — nothing here computes, evaluates or schedules.
 */

import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ActionResult, ConditionResult, Execution, ExecutionStatus, Workflow, WorkflowStatus } from '@/lib/automation'

// ── Status pills ─────────────────────────────────────────────────────────────

const WORKFLOW_VARIANT: Record<WorkflowStatus, 'success' | 'default' | 'warning'> = {
  active: 'success', draft: 'warning', disabled: 'default',
}

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return <Badge variant={WORKFLOW_VARIANT[status]} className="capitalize">{status}</Badge>
}

const EXECUTION_VARIANT: Record<ExecutionStatus, 'success' | 'danger' | 'warning' | 'default'> = {
  success: 'success', failed: 'danger', awaiting_approval: 'warning',
  pending: 'warning', running: 'warning', skipped: 'default', cancelled: 'default',
}

const EXECUTION_LABEL: Record<ExecutionStatus, string> = {
  success: 'Success', failed: 'Failed', awaiting_approval: 'Needs approval',
  pending: 'Scheduled', running: 'Running', skipped: 'Skipped', cancelled: 'Cancelled',
}

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  return <Badge variant={EXECUTION_VARIANT[status]}>{EXECUTION_LABEL[status]}</Badge>
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function Empty({ icon, title, body, action }: {
  icon: string; title: string; body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-[14px] font-medium text-ink mb-1">{title}</p>
      <p className="text-[13px] text-mid max-w-md mx-auto leading-relaxed">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-ember text-white text-[13px] font-medium hover:bg-ember/90 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

// ── Workflow row ─────────────────────────────────────────────────────────────

export function WorkflowRow({ workflow, scheduleLabel, triggerLabel }: {
  workflow: Workflow; scheduleLabel: string; triggerLabel: string
}) {
  return (
    <Link
      href={`/dashboard/automation/workflows/${workflow.id}`}
      className="block px-5 py-4 border-b border-border/60 last:border-0 hover:bg-paper/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[14px] font-medium text-ink truncate">{workflow.name}</span>
            <WorkflowStatusBadge status={workflow.status} />
            {workflow.dryRun && <Badge variant="default">Dry run</Badge>}
            {workflow.requiresApproval && <Badge variant="warning">Approval</Badge>}
          </div>
          <p className="text-[12px] text-mid">
            When <span className="text-ink">{triggerLabel}</span>
            {workflow.conditions.length > 0 && <> · {workflow.conditions.length} condition{workflow.conditions.length === 1 ? '' : 's'}</>}
            {' · '}{workflow.actions.length} action{workflow.actions.length === 1 ? '' : 's'}
            {' · '}{scheduleLabel.toLowerCase()}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-data text-[13px] text-ink">{workflow.executionCount}</div>
          <div className="text-[11px] text-mid">runs</div>
        </div>
      </div>
    </Link>
  )
}

// ── Execution row ────────────────────────────────────────────────────────────

export function ExecutionRow({ execution }: { execution: Execution }) {
  const when = execution.completedAt ?? execution.scheduledFor ?? execution.createdAt
  const failedActions = execution.actionsExecuted.filter(a => a.outcome === 'failed').length

  return (
    <Link
      href={`/dashboard/automation/executions?id=${execution.id}`}
      className="block px-5 py-3.5 border-b border-border/60 last:border-0 hover:bg-paper/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-0.5">
            <span className="text-[13px] font-medium text-ink truncate">
              {execution.workflowName ?? 'Workflow'}
            </span>
            <ExecutionStatusBadge status={execution.status} />
            {execution.dryRun && <Badge variant="default">Dry run</Badge>}
          </div>
          <p className="text-[11px] text-mid font-data truncate">
            {execution.eventName}
            {execution.durationMs !== null && <> · {execution.durationMs}ms</>}
            {failedActions > 0 && <> · {failedActions} action{failedActions === 1 ? '' : 's'} failed</>}
          </p>
        </div>
        <span className="text-[11px] text-mid shrink-0">
          {new Date(when).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </Link>
  )
}

// ── Execution detail ─────────────────────────────────────────────────────────

export function ConditionTrace({ conditions }: { conditions: ConditionResult[] }) {
  if (!conditions.length) {
    return <p className="text-[12px] text-mid">No conditions — this workflow runs on every matching event.</p>
  }
  return (
    <div className="space-y-1.5">
      {conditions.map((c, i) => (
        <div key={i} className="flex items-start gap-2.5 text-[12px]">
          <span className={cn('mt-0.5 shrink-0', c.passed ? 'text-[#2A9D5C]' : 'text-[#C0392B]')}>
            {c.passed ? '✓' : '✕'}
          </span>
          <span className="font-data text-mid">
            <span className="text-ink">{c.field}</span> {c.operator} {String(c.expected)}
            {' — observed '}
            <span className="text-ink">{c.observed === null || c.observed === undefined ? 'nothing' : String(c.observed)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

const OUTCOME_STYLE: Record<ActionResult['outcome'], string> = {
  executed: 'text-[#2A9D5C]', dry_run: 'text-teal', skipped: 'text-mid',
  not_implemented: 'text-gold', failed: 'text-[#C0392B]',
}

export function ActionTrace({ actions }: { actions: ActionResult[] }) {
  if (!actions.length) {
    return <p className="text-[12px] text-mid">No actions ran.</p>
  }
  return (
    <div className="space-y-2">
      {actions.map((a, i) => (
        <div key={i} className="text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-data text-ink">{a.type}</span>
            <span className={cn('text-[11px] uppercase tracking-wider', OUTCOME_STYLE[a.outcome])}>
              {a.outcome.replace('_', ' ')}
            </span>
          </div>
          <p className="text-mid mt-0.5 leading-relaxed">{a.detail}</p>
          {a.error && <p className="text-[#C0392B] mt-0.5">{a.error}</p>}
        </div>
      ))}
    </div>
  )
}
