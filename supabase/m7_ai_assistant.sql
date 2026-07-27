-- ─── Milestone 7: AI Guest Assistant ──────────────────────────────────────────
-- Run once in the Supabase SQL editor.
--
-- The application tolerates this not having been run: intent/sentiment simply
-- aren't stored, reservation capture returns null, and the interaction log
-- stays empty. Guest replies still work. Run it to get the full feature.

-- 1. Intent and sentiment on messages ------------------------------------------
-- Stored as columns rather than inside metadata because the dashboard
-- aggregates by them.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS intent    TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_venue_intent
  ON messages (venue_id, intent)
  WHERE intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_venue_sentiment
  ON messages (venue_id, sentiment)
  WHERE sentiment IS NOT NULL;

-- 2. Reservation requests ------------------------------------------------------
-- Captured only. No availability check, no booking system: a person or a later
-- integration turns these into real reservations.
CREATE TABLE IF NOT EXISTS reservation_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  guest_id       UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name     TEXT,
  guest_phone    TEXT,
  requested_date DATE,
  requested_time TIME,
  party_size     INTEGER,
  notes          TEXT,
  source_message TEXT,
  channel        TEXT NOT NULL DEFAULT 'whatsapp',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  handled_by     UUID,
  handled_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_requests_venue
  ON reservation_requests (venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_requests_pending
  ON reservation_requests (venue_id)
  WHERE status = 'pending';

-- 3. AI interaction log --------------------------------------------------------
-- One row per model call: powers the activity statistics and gives an audit
-- trail of what the assistant did on a venue's behalf.
CREATE TABLE IF NOT EXISTS ai_interactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       UUID REFERENCES venues(id) ON DELETE CASCADE,
  feature        TEXT NOT NULL,
  model          TEXT NOT NULL,
  success        BOOLEAN NOT NULL DEFAULT true,
  latency_ms     INTEGER,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_venue
  ON ai_interactions (venue_id, created_at DESC);

-- 4. Row level security --------------------------------------------------------
-- Both tables are reached through the service role only, matching the pattern
-- used by whatsapp_messages.
ALTER TABLE reservation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions      ENABLE ROW LEVEL SECURITY;

-- 5. updated_at trigger --------------------------------------------------------
DROP TRIGGER IF EXISTS trg_reservation_requests_updated_at ON reservation_requests;
CREATE TRIGGER trg_reservation_requests_updated_at
  BEFORE UPDATE ON reservation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
