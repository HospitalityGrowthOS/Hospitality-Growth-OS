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
                 'Authorization', 'Bearer REPLACE_WITH_YOUR_CRON_SECRET'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Cron secret ---------------------------------------------------------------
-- The secret is inlined in the command above, NOT read from a database setting.
--
-- This file used to end with:
--
--     ALTER DATABASE postgres SET app.cron_secret = '...';
--
-- which Supabase rejects — the SQL editor role lacks the privilege and the
-- statement fails with "42501: permission denied to set parameter". The damage
-- is that it fails quietly in effect: current_setting(..., true) then returns
-- an empty string instead of erroring, the job sends a header of literally
-- "Bearer ", and every call is rejected 401 while cron.job_run_details reports
-- the run as a success. The same trap cost hours on the automation cron before
-- net._http_response revealed what was actually happening.
--
-- Replace the placeholder above with the real CRON_SECRET from Vercel before
-- running this file. Do NOT commit the real value — this repository is public.
--
-- Verify afterwards with:
--     SELECT id, status_code, left(content::text, 90), created
--     FROM net._http_response ORDER BY id DESC LIMIT 8;
-- A 401 means the secret does not match.
