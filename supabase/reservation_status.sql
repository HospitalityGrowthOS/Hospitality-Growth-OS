-- =============================================================================
-- RESERVATION STATUS — the states a service actually goes through
--
-- The constraint allowed pending | confirmed | cancelled | declined. That set
-- has no way to record a no-show, which is one of the few things about a
-- booking a restaurant genuinely wants to track: it costs a covered table, it
-- predicts repeat behaviour, and it is the reason venues take deposits.
--
-- Added:
--   seated     the party arrived and was seated
--   completed  the booking finished normally
--   no_show    the party never arrived
--
-- 'seated' and 'completed' are here so that no_show has a meaningful opposite.
-- Without them the only way to close out a booking that went fine is to leave
-- it 'confirmed' forever, and a no-show rate computed against "confirmed"
-- silently counts every future booking as a success.
--
-- Found while seeding the Golden Demo Venue: the seed tried to write no_show
-- for 21 bookings, every insert was rejected, and the script reported them as
-- created because it never checked the error.
--
-- Safe to run more than once.
-- =============================================================================

ALTER TABLE reservation_requests
  DROP CONSTRAINT IF EXISTS reservation_requests_status_check;

ALTER TABLE reservation_requests
  ADD CONSTRAINT reservation_requests_status_check
  CHECK (status IN ('pending', 'confirmed', 'seated', 'completed',
                    'cancelled', 'declined', 'no_show'));

-- The reservations screen lists by service date, filtered by venue.
CREATE INDEX IF NOT EXISTS reservation_requests_venue_date_idx
  ON reservation_requests(venue_id, requested_date DESC);

-- The AI page counts outstanding requests on every render.
CREATE INDEX IF NOT EXISTS reservation_requests_pending_idx
  ON reservation_requests(venue_id)
  WHERE status = 'pending';
