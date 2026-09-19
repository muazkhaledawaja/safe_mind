-- Migration: 003_emergency_contacts
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
