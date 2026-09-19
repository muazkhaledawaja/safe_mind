-- Migration: 001_users
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
