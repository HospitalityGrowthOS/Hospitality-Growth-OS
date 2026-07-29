/**
 * Automation Engine — public surface.
 *
 * Product code needs exactly one thing from this module: `emitEvent`. Anything
 * that reaches past it into the executor or the action registry is coupling
 * itself to the engine's internals and should be reconsidered.
 *
 * The engine contains no industry-specific logic. It matches opaque event
 * names against stored workflows, evaluates declarative conditions against a
 * generic context, and runs registered action handlers. A future industry
 * module contributes events, condition fields and actions — never engine code.
 */

export * from './types'

// The one call product code should make.
export { emitEvent, recentEvents, KNOWN_EVENTS, type KnownEvent } from './events'

// Dispatch pipeline.
export { dispatch, testWorkflow } from './engine'
export { runWorkflow, resumeExecution } from './executor'

// Catalogues the builder renders from.
export { TRIGGERS, describeTrigger, triggersByCategory, triggerMatches } from './triggers'
export { CONDITION_FIELDS, describeField, evaluateCondition, evaluateConditions, buildContext, readField } from './conditions'
export { ACTIONS, describeAction, runAction, interpolate } from './actions'

// Persistence.
export {
  listWorkflows, getWorkflow, workflowsListeningFor,
  createWorkflow, updateWorkflow, setWorkflowStatus, deleteWorkflow,
} from './workflow'

// Scheduling and history.
export { resolveRunAt, describeSchedule, dueExecutions, drain, type DrainResult } from './scheduler'
export {
  listExecutions, getExecution, automationStats,
  approveExecution, cancelExecution, toExecution, type AutomationStats,
} from './history'

// Templates and validation.
export { TEMPLATES, getTemplate, templatesByCategory, type WorkflowTemplate } from './templates'
export { validateWorkflow, workflowWarnings } from './validation'

/**
 * Capability Registry — types only, and deliberately so.
 *
 * `export type` is erased at compile time, so this adds nothing to the bundle
 * and changes no behaviour. The registry is not implemented and has no call
 * site; see docs/adr/0001-capability-registry.md for why implementation waits
 * for a second Industry Module.
 */
export type {
  CapabilityName,
  CapabilityLifecycle,
  PhaseOf,
  CapabilityEvent,
  CapabilityProvider,
  CapabilityTrigger,
  CapabilityRegistry,
  CapabilityEventPayload,
} from './capabilities'
