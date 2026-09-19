-- Migration: 008_appointments
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
