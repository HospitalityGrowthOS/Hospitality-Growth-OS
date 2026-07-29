-- =============================================================================
-- AUTOMATION DRAIN — pg_cron schedule
--
-- Vercel Hobby only allows daily cron schedules, so the Vercel cron for
-- /api/cron/automation is a once-a-day safety net. The real cadence comes
-- from here: pg_cron calls the drain endpoint every 10 minutes.
--
-- ── Why the secret is inlined ────────────────────────────────────────────────
-- The obvious approach is a database-level setting read at runtime:
--
--     ALTER DATABASE postgres SET app.cron_secret = '...';
--     ... current_setting('app.cron_secret', true) ...
--
-- That does NOT work on Supabase. The SQL editor role lacks the privilege and
-- the statement fails with:
--
--     ERROR: 42501: permission denied to set parameter "app.cron_secret"
--
-- Worse, it fails silently in effect: current_setting(..., true) returns an
-- empty string rather than erroring, so the job builds a header of literally
-- "Bearer " and every call is rejected 401 while the job itself reports
-- success. That cost several hours to diagnose — the job looked healthy in
-- cron.job_run_details and only net._http_response revealed the rejections.
--
-- So the secret is inlined directly in the command, which is what
-- review_automation.sql ends up doing too.
--
-- ── Before running ───────────────────────────────────────────────────────────
-- Replace BOTH placeholders below with the real CRON_SECRET from Vercel
-- (Settings -> Environment Variables). Do NOT commit the real value: this
-- repository is public.
--
-- Verify afterwards with:
--     SELECT id, status_code, left(content::text, 90), created
--     FROM net._http_response ORDER BY id DESC LIMIT 8;
-- Expect {"success":true,...}. A 401 means the secret does not match.
--
-- Safe to run more than once.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('drain-automation-executions')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-automation-executions');

SELECT cron.schedule(
  'drain-automation-executions',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://www.hospitalitygrowthos.com/api/cron/automation',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer REPLACE_WITH_YOUR_CRON_SECRET'
               ),
    body    := '{}'::jsonb
  );
  $$
);
