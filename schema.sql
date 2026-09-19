-- =====================================================================
-- Safe Mind — MySQL 8 schema
-- Charset utf8mb4 / utf8mb4_unicode_ci throughout (Arabic content).
-- Split into db/migrations/00N_*.sql in creation order.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS safe_mind
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE safe_mind;

-- ---------------------------------------------------------------------
-- 001 users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nickname        VARCHAR(50)  NOT NULL,
  full_name       VARCHAR(100) NULL,
  email           VARCHAR(150) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('user','specialist','admin') NOT NULL DEFAULT 'user',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  reset_token     VARCHAR(255) NULL,
  reset_expires   DATETIME     NULL,
  last_login_at   DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role, is_active),
  KEY idx_users_reset (reset_token)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 002 specialists  (1:1 extension of users, not a separate login)
-- ---------------------------------------------------------------------
CREATE TABLE specialists (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             INT UNSIGNED NOT NULL,
  specialization      VARCHAR(100) NOT NULL,
  bio                 TEXT NULL,
  license_number      VARCHAR(100) NULL,
  license_document    VARCHAR(255) NULL,
  years_experience    TINYINT UNSIGNED NULL,
  verification_status ENUM('pending','approved','rejected')
                      NOT NULL DEFAULT 'pending',
  rejection_reason    VARCHAR(255) NULL,
  verified_by         INT UNSIGNED NULL,
  verified_at         DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_specialists_user (user_id),
  KEY idx_specialists_status (verification_status, specialization),
  CONSTRAINT fk_specialists_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_specialists_verifier
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 003 emergency_contacts
-- Max 3 per user and exactly one is_primary: enforced in the service layer.
-- ---------------------------------------------------------------------
CREATE TABLE emergency_contacts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20)  NULL,
  email         VARCHAR(150) NOT NULL,
  relationship  VARCHAR(50)  NULL,
  is_primary    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ec_user (user_id, is_primary),
  CONSTRAINT fk_ec_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 004 emergency_alerts  (append-only log, never updated)
-- ---------------------------------------------------------------------
CREATE TABLE emergency_alerts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  contact_id    INT UNSIGNED NULL,
  channel       ENUM('email','sms') NOT NULL DEFAULT 'email',
  status        ENUM('sent','failed','rate_limited') NOT NULL,
  error_message TEXT NULL,
  ip_address    VARCHAR(45) NULL,
  sent_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_alerts_user (user_id, sent_at),
  CONSTRAINT fk_alerts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_contact
    FOREIGN KEY (contact_id) REFERENCES emergency_contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 005 categories
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_ar     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 006 articles
-- ---------------------------------------------------------------------
CREATE TABLE articles (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED NOT NULL,
  author_id    INT UNSIGNED NULL,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) NOT NULL,
  excerpt      VARCHAR(500) NULL,
  content      LONGTEXT NOT NULL,
  cover_image  VARCHAR(255) NULL,
  status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
  views_count  INT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_listing (status, category_id, published_at),
  FULLTEXT KEY ft_articles (title, excerpt, content) WITH PARSER ngram,
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 007 mood_logs
-- ---------------------------------------------------------------------
CREATE TABLE mood_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  log_date      DATE NOT NULL,
  mood_level    TINYINT UNSIGNED NOT NULL,
  stress_level  TINYINT UNSIGNED NOT NULL,
  sleep_quality TINYINT UNSIGNED NOT NULL,
  sleep_hours   DECIMAL(3,1) NULL,
  note          TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mood_user_date (user_id, log_date),
  KEY idx_mood_range (user_id, log_date),
  CONSTRAINT chk_mood  CHECK (mood_level    BETWEEN 1 AND 5),
  CONSTRAINT chk_stress CHECK (stress_level BETWEEN 1 AND 5),
  CONSTRAINT chk_sleep  CHECK (sleep_quality BETWEEN 1 AND 5),
  CONSTRAINT fk_mood_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 008 appointments
-- Overlap prevention is a service-layer check; the index below supports it.
-- ---------------------------------------------------------------------
CREATE TABLE appointments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  specialist_id INT UNSIGNED NOT NULL,
  scheduled_at  DATETIME NOT NULL,
  duration_min  SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  status        ENUM('pending','accepted','rejected','cancelled','completed')
                NOT NULL DEFAULT 'pending',
  user_note     TEXT NULL,
  response_note TEXT NULL,
  responded_at  DATETIME NULL,
  cancelled_by  INT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_appt_specialist_slot (specialist_id, scheduled_at, status),
  KEY idx_appt_user (user_id, status, scheduled_at),
  CONSTRAINT fk_appt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_specialist
    FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_canceller
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 009 conversations  (one permanent thread per user-specialist pair)
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  specialist_id   INT UNSIGNED NOT NULL,
  appointment_id  INT UNSIGNED NULL,
  last_message_at DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_pair (user_id, specialist_id),
  KEY idx_conv_recent (specialist_id, last_message_at),
  CONSTRAINT fk_conv_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_specialist
    FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 010 messages
-- ---------------------------------------------------------------------
CREATE TABLE messages (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id       INT UNSIGNED NOT NULL,
  body            TEXT NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  read_at         DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_thread (conversation_id, created_at),
  KEY idx_msg_unread (conversation_id, is_read),
  CONSTRAINT fk_msg_conv
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 011 audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT UNSIGNED NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   INT UNSIGNED NULL,
  metadata    JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_actor (actor_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Seed: the eight awareness categories
-- ---------------------------------------------------------------------
INSERT INTO categories (name_ar, name_en, slug, sort_order) VALUES
  ('الاكتئاب',                 'Depression',            'depression',        1),
  ('القلق',                    'Anxiety',               'anxiety',           2),
  ('الصدمات والحروب',          'Trauma and War',        'trauma-war',        3),
  ('الوسواس القهري',           'OCD',                   'ocd',               4),
  ('الاضطرابات النمائية',      'Developmental Disorders','developmental',    5),
  ('مشاكل النوم',              'Sleep Problems',        'sleep',             6),
  ('الدعم الطارئ',             'Emergency Support',     'emergency-support', 7),
  ('الرعاية الذاتية',          'Self Care',             'self-care',         8);
