-- =============================================================================
-- REVIEW REQUEST STATUS — allow the lifecycle the product actually writes
--
-- The application models a review request in four stages:
--
--   pending    queued, not yet delivered to the guest
--   sent       delivered, waiting on the guest
--   failed     delivery failed (no WhatsApp, bad number, provider error)
--   clicked    the guest tapped through from the WhatsApp message
--   positive / negative / completed   the guest answered
--
-- The original constraint allowed only pending | positive | negative |
-- completed. So `src/app/api/review-requests/route.ts`, which sets 'sent' on a
-- successful send and 'failed' on a failed one, had BOTH of its branches
-- rejected by the database. The write went through tryWrite(), which logs and
-- continues, so nothing surfaced: every request stayed 'pending' forever and
-- sent_at was never recorded.
--
-- That fed a second, worse bug. The intelligence layer computed its completion
-- rate over statuses ('sent','positive','negative'). Since 'sent' could never
-- exist, the denominator collapsed onto the answered rows and the dashboard
-- reported a 100% review response rate to every venue, permanently.
--
-- Found by seeding the Golden Demo Venue: 535 requests, 136 answered, and the
-- product insisting the rate was 136/136.
--
-- 'clicked' is here for the same reason: the WhatsApp webhook records it when a
-- guest taps through, and that write was being rejected too, losing both the
-- status and the clicked_at timestamp.
--
-- Safe to run more than once.
-- =============================================================================

-- ── 1. Widen the constraint ─────────────────────────────────────────────────
ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_status_check;

ALTER TABLE review_requests
  ADD CONSTRAINT review_requests_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'clicked', 'positive', 'negative', 'completed'));

-- ── 2. Backfill rows the old constraint stranded ────────────────────────────
-- Anything carrying a sent_at was delivered; the status update is what failed.
UPDATE review_requests
   SET status = 'sent'
 WHERE status = 'pending'
   AND sent_at IS NOT NULL;

-- A request whose scheduled send time passed long ago and which never picked
-- up a sent_at was never actually delivered. Left as 'pending' deliberately
-- rather than guessed at — an unknown outcome should not be recorded as a
-- failure, and the completion rate now excludes it either way.

-- ── 3. Index the working set ────────────────────────────────────────────────
-- The drain and the dashboard both filter on outstanding requests.
CREATE INDEX IF NOT EXISTS review_requests_pending_idx
  ON review_requests(venue_id, scheduled_for)
  WHERE status = 'pending';
