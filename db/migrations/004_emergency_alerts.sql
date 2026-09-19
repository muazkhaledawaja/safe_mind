-- Migration: 004_emergency_alerts
-- (append-only log, never updated)
CREATE TABLE emergency_alerts (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  contact_id    BIGINT,
  channel       alert_channel NOT NULL DEFAULT 'email',
  status        alert_status  NOT NULL,
  error_message TEXT,
  ip_address    VARCHAR(45),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_alerts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_contact
    FOREIGN KEY (contact_id) REFERENCES emergency_contacts(id) ON DELETE SET NULL
);

CREATE INDEX idx_alerts_user ON emergency_alerts (user_id, sent_at);