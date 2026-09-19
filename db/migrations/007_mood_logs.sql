-- Migration: 007_mood_logs
CREATE TABLE mood_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  log_date      DATE NOT NULL,
  mood_level    SMALLINT NOT NULL,
  stress_level  SMALLINT NOT NULL,
  sleep_quality SMALLINT NOT NULL,
  sleep_hours   NUMERIC(3,1),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_mood_user_date UNIQUE (user_id, log_date),
  CONSTRAINT chk_mood   CHECK (mood_level    BETWEEN 1 AND 5),
  CONSTRAINT chk_stress CHECK (stress_level BETWEEN 1 AND 5),
  CONSTRAINT chk_sleep  CHECK (sleep_quality BETWEEN 1 AND 5),
  CONSTRAINT fk_mood_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mood_range ON mood_logs (user_id, log_date);

CREATE TRIGGER mood_logs_updated_at
  BEFORE UPDATE ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();