-- ─── whatsapp_messages ────────────────────────────────────────────────────────
-- Logs every outbound WhatsApp message sent via Twilio.
-- Status is updated by the Twilio status webhook (/api/whatsapp/status).

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  guest_id      UUID        REFERENCES guests(id) ON DELETE SET NULL,
  phone         TEXT        NOT NULL,
  message_type  TEXT        NOT NULL
                            CHECK (message_type IN ('loyalty_welcome','review_request','campaign','manual')),
  body          TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent','failed','delivered','read')),
  twilio_sid    TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_messages_venue_id   ON whatsapp_messages(venue_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_twilio_sid ON whatsapp_messages(twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wa_messages_updated_at ON whatsapp_messages;
CREATE TRIGGER trg_wa_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: service role only (no anon access)
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
