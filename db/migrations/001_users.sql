-- Migration: 001_users
-- Postgres port of the MySQL schema. auth_uid links this row to the
-- Supabase Auth user (uuid); Supabase owns password/google identity, so
-- password_hash is merely retained, nullable, and unused.

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