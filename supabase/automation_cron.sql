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

SELECT cron.schedule(
  'drain-automation-executions',
  '*/10 * * * *',
  $$
  SELECT net.http_get(
    url     := 'https://www.hospitalitygrowthos.com/api/cron/automation',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
               )
  );
  $$
);
