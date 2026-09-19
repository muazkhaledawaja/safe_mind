-- =====================================================================
-- Safe Mind — PostgreSQL 15 schema (Supabase)
-- UTF-8 throughout (Arabic content). The executable source of truth is
-- db/migrations/00N_*.sql, applied in order by `node db/migrate.js`.
-- This file is the consolidated, single-source reference for the ERD.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums + updated_at helper
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('user', 'specialist', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE alert_channel AS ENUM ('email', 'sms');
CREATE TYPE alert_status AS ENUM ('sent', 'failed', 'rate_limited');
CREATE TYPE article_status AS ENUM ('draft', 'published');
CREATE TYPE appointment_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'completed');

-- Emulates MySQL's ON UPDATE CURRENT_TIMESTAMP.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 001 users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nickname      VARCHAR(50)  NOT NULL,
  full_name     VARCHAR(100),
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255),
  auth_uid      UUID UNIQUE,
  role          user_role    NOT NULL DEFAULT 'user',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  reset_token   VARCHAR(255),
  reset_expires TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX idx_users_role_active ON users (role, is_active);
CREATE INDEX idx_users_reset ON users (reset_token);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 002 specialists  (1:1 extension of users, not a separate login)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 003 emergency_contacts
-- ---------------------------------------------------------------------
CREATE TABLE emergency_contacts (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(150) NOT NULL,
  relationship  VARCHAR(50),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ec_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ec_user ON emergency_contacts (user_id, is_primary);

CREATE TRIGGER emergency_contacts_updated_at
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 004 emergency_alerts  (append-only log, never updated)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 005 categories
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_ar     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 006 articles
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE articles (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  BIGINT NOT NULL,
  author_id    BIGINT,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) NOT NULL UNIQUE,
  excerpt      VARCHAR(500),
  content      TEXT NOT NULL,
  cover_image  VARCHAR(255),
  status       article_status NOT NULL DEFAULT 'draft',
  views_count  BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_articles_listing ON articles (status, category_id, published_at);
CREATE INDEX idx_articles_title_trgm   ON articles USING gin (title   gin_trgm_ops);
CREATE INDEX idx_articles_excerpt_trgm ON articles USING gin (excerpt gin_trgm_ops);
CREATE INDEX idx_articles_content_trgm ON articles USING gin (content gin_trgm_ops);

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 007 mood_logs
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 008 appointments
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 009 conversations  (one permanent thread per user-specialist pair)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 010 messages
-- ---------------------------------------------------------------------
CREATE TABLE messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id       BIGINT NOT NULL,
  body            TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_msg_conv
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_msg_thread ON messages (conversation_id, created_at);
CREATE INDEX idx_msg_unread ON messages (conversation_id, is_read);

-- ---------------------------------------------------------------------
-- 011 audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    BIGINT,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   BIGINT,
  metadata    JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 012 Realtime: RLS gates who receives streaming rows
-- ---------------------------------------------------------------------
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Participants can receive message rows. auth.uid() is the Supabase Auth user
-- id — mapped to our BIGINT users.id through users.auth_uid.
CREATE POLICY messages_participants_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = c.user_id AND u.auth_uid = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM specialists s
            JOIN users su ON su.id = s.user_id
            WHERE s.id = c.specialist_id AND su.auth_uid = auth.uid()
          )
        )
    )
  );

CREATE POLICY conversations_participants_select ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_id AND u.auth_uid = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM specialists s
      JOIN users su ON su.id = s.user_id
      WHERE s.id = specialist_id AND su.auth_uid = auth.uid()
    )
  );

-- Stream INSERT/UPDATE/DELETE on these tables to Realtime subscribers.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;