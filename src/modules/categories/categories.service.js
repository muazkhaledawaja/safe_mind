const { query } = require('../../config/db');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { uniqueSlug } = require('../../utils/slug');

function toView(row) {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

async function list() {
  const rows = await query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
  return rows.map(toView);
}

async function findById(id) {
  const rows = await query('SELECT * FROM categories WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('Category not found');
  return rows[0];
}

async function create(data) {
  const slug = await uniqueSlug(data.nameEn, async (candidate) => {
    const rows = await query('SELECT id FROM categories WHERE slug = ?', [candidate]);
    return rows.length > 0;
  });

  const result = await query(
    'INSERT INTO categories (name_ar, name_en, slug, description, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [data.nameAr, data.nameEn, slug, data.description || null, data.sortOrder]
  );

  return toView(await findById(result[0].id));
}

async function update(id, updates) {
  await findById(id);

  const fields = [];
  const params = [];
  if (updates.nameAr !== undefined) { fields.push('name_ar = ?'); params.push(updates.nameAr); }
  if (updates.nameEn !== undefined) { fields.push('name_en = ?'); params.push(updates.nameEn); }
  if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description); }
  if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); params.push(updates.sortOrder); }

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return toView(await findById(id));
}

async function remove(id) {
  await findById(id);
  try {
    await query('DELETE FROM categories WHERE id = ?', [id]);
  } catch (err) {
    // fk_articles_category is ON DELETE RESTRICT — a category with articles
    // cannot be deleted, by design. 23503 is Postgres' foreign_key_violation.
    if (err.code === '23503') {
      throw new ConflictError('CATEGORY_IN_USE', 'This category still has articles and cannot be deleted');
    }
    throw err;
  }
}

module.exports = { list, findById, create, update, remove, toView };
