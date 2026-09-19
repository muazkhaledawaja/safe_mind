const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./mood.controller');
const schemas = require('./mood.schemas');

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /mood:
 *   post:
 *     summary: Log today's mood (one entry per day)
 *     tags: [Mood]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateMoodRequest' }
 *     responses:
 *       201:
 *         description: Created mood entry
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/MoodLog' } }
 *       409:
 *         description: Already logged today (MOOD_ALREADY_LOGGED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   get:
 *     summary: List the user's own mood entries within a date range
 *     tags: [Mood]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of mood entries
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
 *                       items: { $ref: '#/components/schemas/MoodLog' }
 */
router.post('/', validate({ body: schemas.createMood }), controller.create);
router.get('/', validate({ query: schemas.rangeQuery }), controller.listRange);

/**
 * @openapi
 * /mood/summary:
 *   get:
 *     summary: Aggregated mood/stress/sleep averages for charting
 *     tags: [Mood]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: ['7d', '30d', '90d'], default: '30d' }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week], default: day }
 *     responses:
 *       200:
 *         description: Averages grouped by day or week
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
 *                       items: { $ref: '#/components/schemas/MoodSummaryPoint' }
 */
router.get('/summary', validate({ query: schemas.summaryQuery }), controller.summary);

/**
 * @openapi
 * /mood/{date}:
 *   patch:
 *     summary: Edit today's mood entry
 *     description: The date in the path must equal today's date server-side. A user's own past entries cannot be backdated or edited.
 *     tags: [Mood]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Must be today's date (YYYY-MM-DD)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateMoodRequest' }
 *     responses:
 *       200:
 *         description: Updated mood entry
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/MoodLog' } }
 *       403:
 *         description: Date is not today
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: No mood entry for that date
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:date', validate({ params: schemas.dateParam, body: schemas.updateMood }), controller.update);

module.exports = router;
