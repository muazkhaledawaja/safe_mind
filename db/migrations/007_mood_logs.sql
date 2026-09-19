-- Migration: 007_mood_logs
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
