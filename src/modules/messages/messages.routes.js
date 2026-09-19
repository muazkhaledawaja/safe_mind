const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./messages.controller');
const schemas = require('./messages.schemas');

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /conversations:
 *   get:
 *     summary: List the caller's conversations
 *     description: A conversation only exists once an appointment between that user and specialist has been accepted.
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of conversations
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
 *                       items: { $ref: '#/components/schemas/Conversation' }
 */
router.get('/', controller.listConversations);

/**
 * @openapi
 * /conversations/unread-count:
 *   get:
 *     summary: Count of unread messages across all the caller's conversations
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/UnreadCount' } }
 */
router.get('/unread-count', controller.unreadCount);

/**
 * @openapi
 * /conversations/{id}/messages:
 *   get:
 *     summary: List messages in a conversation the caller is part of
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated list of messages
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
 *                       items: { $ref: '#/components/schemas/Message' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       403:
 *         description: Not a participant in this conversation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   post:
 *     summary: Send a message in a conversation the caller is part of
 *     tags: [Messages]
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
 *           schema: { $ref: '#/components/schemas/SendMessageRequest' }
 *     responses:
 *       201:
 *         description: Created message
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Message' } }
 *       403:
 *         description: Not a participant in this conversation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  '/:id/messages',
  validate({ params: schemas.conversationIdParam, query: schemas.listQuery }),
  controller.listMessages
);
router.post(
  '/:id/messages',
  validate({ params: schemas.conversationIdParam, body: schemas.sendMessage }),
  controller.sendMessage
);

module.exports = router;
