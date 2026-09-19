-- Migration: 008_appointments
-- Overlap prevention is a service-layer check; the index below supports it.
CREATE TABLE appointments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  specialist_id BIGINT NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_min  SMALLINT NOT NULL DEFAULT 45,
  status        appointment_status NOT NULL DEFAULT 'pending',
  user_note     TEXT,
  response_note TEXT,
  responded_at  TIMESTAMPTZ,
  cancelled_by  BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_appt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_specialist
    FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_canceller
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_appt_specialist_slot ON appointments (specialist_id, scheduled_at, status);
CREATE INDEX idx_appt_user ON appointments (user_id, status, scheduled_at);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();