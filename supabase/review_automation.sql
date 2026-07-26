-- ─── Review automation ────────────────────────────────────────────────────────
-- Adds the columns the 45-minute delayed review flow needs, then schedules the
-- dispatcher with pg_cron (Vercel Hobby only allows daily crons, so the timer
-- lives in Postgres instead).
--
-- Run once in the Supabase SQL editor.

-- 1. Columns ------------------------------------------------------------------
ALTER TABLE review_requests
  ADD COLUMN IF NOT EXISTS visit_id     UUID REFERENCES visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel      TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_url   TEXT;

-- The dispatcher polls on (status, scheduled_for) — index it.
CREATE INDEX IF NOT EXISTS idx_review_requests_due
  ON review_requests (scheduled_for)
  WHERE status = 'pending';

-- Backfill anything created before this migration so nothing is stranded.
UPDATE review_requests
   SET scheduled_for = created_at + INTERVAL '45 minutes'
 WHERE scheduled_for IS NULL;

-- 2. Dispatcher schedule -------------------------------------------------------
-- pg_cron fires every 5 minutes and calls the Next.js endpoint, which does the
-- actual sending. pg_net makes the HTTP call asynchronously.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove a previous schedule if this file is re-run.
SELECT cron.unschedule('dispatch-review-requests')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-review-requests');

SELECT cron.schedule(
  'dispatch-review-requests',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://www.hospitalitygrowthos.com/api/reviews/send-request',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Cron secret ---------------------------------------------------------------
-- Must match CRON_SECRET in Vercel. Replace the value below before running.
ALTER DATABASE postgres SET app.cron_secret = 'REPLACE_WITH_YOUR_CRON_SECRET';
