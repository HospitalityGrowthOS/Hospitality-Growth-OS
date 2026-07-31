-- =============================================================================
-- REVIEW REQUEST — a terminal status for "we cannot reach this guest"
--
-- The dispatcher has always written status = 'opted_out' for a guest it cannot
-- message, and the constraint has always rejected it. The write goes through
-- tryWrite, which logs and continues, so the request stayed 'pending' and the
-- five-minute cron picked it up again, and again, for a full day until the
-- staleness cutoff finally abandoned it. Nothing surfaced.
--
-- 'unreachable' replaces it rather than simply legalising 'opted_out', because
-- with email as a second channel the two are no longer the same thing. A guest
-- who opted out of WhatsApp but has an email address is perfectly reachable.
-- What ends a request is having no usable channel at all.
--
-- Safe to run more than once.
-- =============================================================================

ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_status_check;

ALTER TABLE review_requests
  ADD CONSTRAINT review_requests_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'clicked', 'unreachable',
                    'positive', 'negative', 'completed'));

-- Requests that have been retried past the staleness window and were never
-- going to be deliverable. Left alone if they still have time on the clock.
UPDATE review_requests
   SET status = 'unreachable'
 WHERE status = 'pending'
   AND sent_at IS NULL
   AND scheduled_for < now() - interval '24 hours';
