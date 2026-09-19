-- Migration: 002_specialists
-- (1:1 extension of users, not a separate login)
CREATE TABLE specialists (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             BIGINT NOT NULL,
  specialization      VARCHAR(100) NOT NULL,
  bio                 TEXT,
  license_number      VARCHAR(100),
  license_document    VARCHAR(255),
  years_experience    SMALLINT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  rejection_reason    VARCHAR(255),
  verified_by         BIGINT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_specialists_user UNIQUE (user_id),
  CONSTRAINT fk_specialists_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_specialists_verifier
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_specialists_status ON specialists (verification_status, specialization);

CREATE TRIGGER specialists_updated_at
  BEFORE UPDATE ON specialists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();