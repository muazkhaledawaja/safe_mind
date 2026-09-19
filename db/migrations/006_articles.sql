-- Migration: 006_articles
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
