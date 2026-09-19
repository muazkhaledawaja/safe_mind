-- Migration: 012_google_auth
ALTER TABLE users
  MODIFY password_hash VARCHAR(255) NULL,
  ADD COLUMN google_id VARCHAR(255) NULL AFTER password_hash,
  ADD UNIQUE KEY uq_users_google_id (google_id);
