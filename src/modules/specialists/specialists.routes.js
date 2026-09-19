const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./specialists.controller');
const schemas = require('./specialists.schemas');

const router = Router();

/**
 * @openapi
 * /specialists:
 *   get:
 *     summary: List approved specialists, optionally filtered by specialization
 *     tags: [Specialists]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: specialization
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of approved specialists
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
 *                       items: { $ref: '#/components/schemas/Specialist' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/', validate({ query: schemas.listQuery }), controller.list);

/**
 * @openapi
 * /specialists/apply:
 *   post:
 *     summary: Apply to become a specialist
 *     description: Creates a pending verification request. Registration always creates role 'user'; this is the only way to start becoming a specialist, and an admin approval (Phase 6) is the only way the role actually changes.
 *     tags: [Specialists]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ApplySpecialistRequest' }
 *     responses:
 *       201:
 *         description: Pending specialist application
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Specialist' } }
 *       409:
 *         description: Already applied (ALREADY_APPLIED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/apply', requireAuth, validate({ body: schemas.apply }), controller.apply);

/**
 * @openapi
 * /specialists/{id}:
 *   get:
 *     summary: Get one approved specialist's public profile
 *     tags: [Specialists]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The specialist
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Specialist' } }
 *       404:
 *         description: Not found or not approved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', validate({ params: schemas.specialistIdParam }), controller.getById);

module.exports = router;
