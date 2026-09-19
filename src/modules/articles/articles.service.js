const { query } = require('../../config/db');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');
const { uniqueSlug } = require('../../utils/slug');
const { toMeta } = require('../../utils/pagination');

// Public/listing view — never exposes author_id or draft-only internals.
function toView(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.cover_image,
    status: row.status,
    viewsCount: row.views_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Escapes LIKE metacharacters in free-text input for an ILIKE search. Used
// instead of a full-text index: pg_trgm gives Arabic substring matching that
// similar to MySQL is ngram-based and prefix (not exact-token) matching.
function toLikePattern(text) {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

async function findById(id) {
  const rows = await query('SELECT * FROM articles WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('Article not found');
  return rows[0];
}

async function findBySlugForAdmin(slug) {
  const rows = await query('SELECT * FROM articles WHERE slug = ?', [slug]);
  if (!rows[0]) throw new NotFoundError('Article not found');
  return rows[0];
}

// Public read: only published articles are visible, and a fetch by slug
// increments the view counter.
async function findPublishedBySlug(slug) {
  const rows = await query('SELECT * FROM articles WHERE slug = ? AND status = ?', [slug, 'published']);
  const article = rows[0];
  if (!article) throw new NotFoundError('Article not found');

  await query('UPDATE articles SET views_count = views_count + 1 WHERE id = ?', [article.id]);
  article.views_count += 1;
  return toView(article);
}

// Public listing: published only, optional Arabic/English full-text search
// and category-slug filter, paginated.
async function listPublished({ page, limit, search, category }) {
  const where = ['status = ?'];
  const params = ['published'];

  if (category) {
    const categoryRows = await query('SELECT id FROM categories WHERE slug = ?', [category]);
    if (categoryRows.length === 0) return { items: [], meta: toMeta(page, limit, 0) };
    where.push('category_id = ?');
    params.push(categoryRows[0].id);
  }

  if (search) {
    where.push('(title ILIKE ? OR excerpt ILIKE ? OR content ILIKE ?)');
    params.push(toLikePattern(search), toLikePattern(search), toLikePattern(search));
  }

  const whereSql = ` WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [{ count: total }] = await query(`SELECT COUNT(*) AS count FROM articles${whereSql}`, params);
  const rows = await query(
    `SELECT * FROM articles${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows.map(toView), meta: toMeta(page, limit, total) };
}

// Admin listing: all statuses, no public filtering restrictions.
async function listAll({ page, limit }) {
  const offset = (page - 1) * limit;
  const [{ count: total }] = await query('SELECT COUNT(*) AS count FROM articles');
  const rows = await query('SELECT * FROM articles ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  return { items: rows.map(toView), meta: toMeta(page, limit, total) };
}

async function create(authorId, data) {
  const slug = await uniqueSlug(data.title, async (candidate) => {
    const rows = await query('SELECT id FROM articles WHERE slug = ?', [candidate]);
    return rows.length > 0;
  });

  const publishedAt = data.status === 'published' ? new Date() : null;

  const result = await query(
    `INSERT INTO articles (category_id, author_id, title, slug, excerpt, content, cover_image, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      data.categoryId,
      authorId,
      data.title,
      slug,
      data.excerpt || null,
      data.content,
      data.coverImage || null,
      data.status,
      publishedAt,
    ]
  );

  return toView(await findById(result[0].id));
}

async function update(id, updates) {
  const current = await findById(id);

  const fields = [];
  const params = [];
  if (updates.categoryId !== undefined) { fields.push('category_id = ?'); params.push(updates.categoryId); }
  if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
  if (updates.excerpt !== undefined) { fields.push('excerpt = ?'); params.push(updates.excerpt); }
  if (updates.content !== undefined) { fields.push('content = ?'); params.push(updates.content); }
  if (updates.coverImage !== undefined) { fields.push('cover_image = ?'); params.push(updates.coverImage); }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    params.push(updates.status);
    // Publishing for the first time stamps published_at; unpublishing clears it.
    if (updates.status === 'published' && current.status !== 'published') {
      fields.push('published_at = NOW()');
    } else if (updates.status === 'draft') {
      fields.push('published_at = NULL');
    }
  }

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return toView(await findById(id));
}

async function remove(id) {
  await findById(id);
  await query('DELETE FROM articles WHERE id = ?', [id]);
}

module.exports = {
  findById,
  findBySlugForAdmin,
  findPublishedBySlug,
  listPublished,
  listAll,
  create,
  update,
  remove,
  toView,
};
