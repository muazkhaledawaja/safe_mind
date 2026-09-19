-- Migration: 009_conversations
-- (one permanent thread per user-specialist pair)
CREATE TABLE conversations (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  specialist_id   BIGINT NOT NULL,
  appointment_id  BIGINT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conv_pair UNIQUE (user_id, specialist_id),
  CONSTRAINT fk_conv_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_specialist
    FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

CREATE INDEX idx_conv_recent ON conversations (specialist_id, last_message_at);