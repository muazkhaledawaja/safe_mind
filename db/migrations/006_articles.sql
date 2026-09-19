-- Migration: 006_articles
-- Search was MySQL FULLTEXT WITH PARSER ngram; the Postgres equivalent for
-- Arabic is pg_trgm trigram indexes, which back ILIKE '%term%'.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE articles (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  BIGINT NOT NULL,
  author_id    BIGINT,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) NOT NULL UNIQUE,
  excerpt      VARCHAR(500),
  content      TEXT NOT NULL,
  cover_image  VARCHAR(255),
  status       article_status NOT NULL DEFAULT 'draft',
  views_count  BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_articles_listing ON articles (status, category_id, published_at);
CREATE INDEX idx_articles_title_trgm   ON articles USING gin (title   gin_trgm_ops);
CREATE INDEX idx_articles_excerpt_trgm ON articles USING gin (excerpt gin_trgm_ops);
CREATE INDEX idx_articles_content_trgm ON articles USING gin (content gin_trgm_ops);

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();