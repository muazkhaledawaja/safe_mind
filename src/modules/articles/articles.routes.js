const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const validate = require('../../middleware/validate');
const controller = require('./articles.controller');
const schemas = require('./articles.schemas');

const router = Router();

/**
 * @openapi
 * /articles:
 *   get:
 *     summary: List published articles, with optional Arabic/English search and category filter
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Full-text search against title, excerpt, and content (Arabic and English)
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Category slug
 *     responses:
 *       200:
 *         description: Paginated list of published articles
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Article' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *   post:
 *     summary: Create an article (admin only)
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateArticleRequest' }
 *     responses:
 *       201:
 *         description: Created article
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Article' } }
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', validate({ query: schemas.listQuery }), controller.listPublished);
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: schemas.createArticle }),
  controller.create
);

/**
 * @openapi
 * /articles/admin:
 *   get:
 *     summary: List all articles including drafts (admin only)
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated list of all articles
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Article' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  validate({ query: schemas.listQuery }),
  controller.listAll
);

/**
 * @openapi
 * /articles/{id}:
 *   patch:
 *     summary: Update an article (admin only)
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateArticleRequest' }
 *     responses:
 *       200:
 *         description: Updated article
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Article' } }
 *       404:
 *         description: Article not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   delete:
 *     summary: Delete an article (admin only)
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deletion confirmed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties: { deleted: { type: boolean, example: true } }
 *       404:
 *         description: Article not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  '/:id(\\d+)',
  requireAuth,
  requireRole('admin'),
  validate({ params: schemas.articleIdParam, body: schemas.updateArticle }),
  controller.update
);
router.delete(
  '/:id(\\d+)',
  requireAuth,
  requireRole('admin'),
  validate({ params: schemas.articleIdParam }),
  controller.remove
);

/**
 * @openapi
 * /articles/{slug}:
 *   get:
 *     summary: Get a published article by slug
 *     description: Increments the article's view count on every successful read. Draft articles 404 here even if the slug is correct.
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The article
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Article' } }
 *       404:
 *         description: Not found or not published
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:slug', validate({ params: schemas.articleSlugParam }), controller.getBySlug);

module.exports = router;
