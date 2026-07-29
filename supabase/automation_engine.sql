-- =============================================================================
-- AUTOMATION ENGINE — Phase 1
--
-- Two tables. Everything else the engine needs already exists:
--   • events        -> analytics_events (venue_id, guest_id, event_type,
--                      properties, occurred_at) is already an event envelope
--   • notifications -> notifications
--   • tasks         -> action_items
--   • suggestions   -> ai_recommendations
--   • messaging     -> whatsapp_messages
--
-- Safe to run more than once.
-- =============================================================================

-- ── Workflows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_workflows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id           UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  name               TEXT NOT NULL,
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'draft',

  -- The engine matches on this string and never interprets it. Industry
  -- modules add new event names without the engine changing.
  trigger_event      TEXT NOT NULL,
  trigger_config     JSONB NOT NULL DEFAULT '{}'::JSONB,

  conditions         JSONB NOT NULL DEFAULT '[]'::JSONB,
  actions            JSONB NOT NULL DEFAULT '[]'::JSONB,
  schedule           JSONB NOT NULL DEFAULT '{"kind":"immediate"}'::JSONB,

  dry_run            BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval  BOOLEAN NOT NULL DEFAULT FALSE,
  retry_policy       JSONB NOT NULL DEFAULT '{"max_attempts":1}'::JSONB,

  -- Set when the workflow was created from a built-in template, so a template
  -- can be recognised later without constraining how it is edited.
  template_key       TEXT,

  last_executed_at   TIMESTAMPTZ,
  execution_count    INTEGER NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT automation_workflows_status_check
    CHECK (status IN ('draft', 'active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_automation_workflows_venue
  ON automation_workflows(venue_id);

-- The hot path: on every emitted event, find active workflows listening for it.
CREATE INDEX IF NOT EXISTS idx_automation_workflows_dispatch
  ON automation_workflows(venue_id, trigger_event, status);

DROP TRIGGER IF EXISTS set_automation_workflows_updated_at ON automation_workflows;
CREATE TRIGGER set_automation_workflows_updated_at
  BEFORE UPDATE ON automation_workflows
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── Executions (the permanent audit log) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_executions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  workflow_id          UUID NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,

  event_name           TEXT NOT NULL,
  event_payload        JSONB NOT NULL DEFAULT '{}'::JSONB,

  status               TEXT NOT NULL DEFAULT 'pending',

  -- Every condition with the value observed, so a decision stays explainable
  -- months later without re-running anything.
  conditions_evaluated JSONB NOT NULL DEFAULT '[]'::JSONB,
  actions_executed     JSONB NOT NULL DEFAULT '[]'::JSONB,

  error                TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0,

  scheduled_for        TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  duration_ms          INTEGER,

  target_guest_id      UUID REFERENCES guests(id) ON DELETE SET NULL,
  target_channel       TEXT,
  dry_run              BOOLEAN NOT NULL DEFAULT FALSE,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT automation_executions_status_check
    CHECK (status IN ('pending', 'awaiting_approval', 'running',
                      'success', 'failed', 'skipped', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_venue_created
  ON automation_executions(venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_workflow
  ON automation_executions(workflow_id, created_at DESC);

-- The scheduler drain query: due work, oldest first.
CREATE INDEX IF NOT EXISTS idx_automation_executions_due
  ON automation_executions(status, scheduled_for)
  WHERE status = 'pending';

-- ── Row level security ───────────────────────────────────────────────────────
-- Matches the venue-isolation pattern used by every other tenant table.
-- The service role bypasses RLS, which is how the engine itself reads and
-- writes; these policies govern direct access from an owner's session.
ALTER TABLE automation_workflows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_workflows_venue_isolation" ON automation_workflows;
CREATE POLICY "automation_workflows_venue_isolation" ON automation_workflows
  FOR ALL USING (venue_id = get_my_venue_id());

DROP POLICY IF EXISTS "automation_executions_venue_isolation" ON automation_executions;
CREATE POLICY "automation_executions_venue_isolation" ON automation_executions
  FOR ALL USING (venue_id = get_my_venue_id());

GRANT ALL ON automation_workflows  TO authenticated;
GRANT ALL ON automation_executions TO authenticated;
