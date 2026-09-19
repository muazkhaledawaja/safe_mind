-- Migration: 009_conversations
-- (one permanent thread per user-specialist pair)
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
