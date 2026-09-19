const crypto = require('crypto');

// Latin-only slugify. Arabic (and any other non-Latin) titles collapse to
// nothing after stripping, so fall back to a short hash of the title —
// still deterministic, always URL-safe, never empty.
function slugify(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base) return base;
  return crypto.createHash('sha1').update(title).digest('hex').slice(0, 10);
}

// Appends -2, -3, ... until `exists(candidate)` returns false.
async function uniqueSlug(title, exists) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
