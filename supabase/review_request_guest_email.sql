-- =============================================================================
-- REVIEW REQUEST — carry an email the way the table already carries a phone
--
-- review_requests denormalises `guest_phone` so a request can be sent to
-- someone who has no row in `guests` — a walk-in whose name and number were
-- typed at the counter. There was never an equivalent for email.
--
-- With email now a real channel that asymmetry is a hole: a request created
-- without a linked guest can never be dispatched by email, because there is
-- nowhere to put the address. The dispatcher looks up `guests.email`, finds no
-- guest, resolves no channel, and marks the request 'unreachable'.
--
-- Found by sending a real review request to a live inbox: the mail arrived
-- (it was sent directly), but the dispatcher had already given up on the same
-- row, and the feedback page then told the guest their response "had already
-- been recorded" — which was false twice over.
--
-- Safe to run more than once.
-- =============================================================================

ALTER TABLE review_requests
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

COMMENT ON COLUMN review_requests.guest_email IS
  'Denormalised address for requests with no linked guest row. Mirrors guest_phone.';
