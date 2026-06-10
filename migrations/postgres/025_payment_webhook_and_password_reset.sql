CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id TEXT PRIMARY KEY,
  transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  event_timestamp TIMESTAMPTZ NOT NULL,
  payload_sha256 TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'processing' CHECK (processing_status IN ('processing', 'processed', 'failed')),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_transaction_id ON payment_webhook_events (transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received_at ON payment_webhook_events (received_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_processing_status ON payment_webhook_events (processing_status);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
