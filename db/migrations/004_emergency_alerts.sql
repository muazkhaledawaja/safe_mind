-- Migration: 004_emergency_alerts
-- (append-only log, never updated)
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
