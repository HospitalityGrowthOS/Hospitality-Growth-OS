-- =============================================================================
-- AUTOMATION DRAIN — pg_cron schedule
--
-- Vercel Hobby only allows daily cron schedules, so the Vercel cron for
-- /api/cron/automation is a once-a-day safety net. The real cadence comes
-- from here: pg_cron calls the drain endpoint every 10 minutes, exactly as
-- review_automation.sql already does for the review dispatcher.
--
-- Requires app.cron_secret to be set (review_automation.sql section 3).
-- Safe to run more than once.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('drain-automation-executions')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-automation-executions');

-- http_post, not http_get: pg_net's http_get was observed dropping the
-- Authorization header (every call returned 401 while the review dispatcher's
-- http_post calls authenticated fine). This mirrors the dispatcher exactly.
SELECT cron.schedule(
  'drain-automation-executions',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://www.hospitalitygrowthos.com/api/cron/automation',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
               ),
    body    := '{}'::jsonb
  );
  $$
);
