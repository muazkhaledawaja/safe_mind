-- Migration: 002_specialists
-- (1:1 extension of users, not a separate login)
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
