-- Migration: 005_categories
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
