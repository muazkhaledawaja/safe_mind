const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./messages.controller');
const schemas = require('./messages.schemas');

const router = Router();

/**
 * @openapi
 * /messages/{id}/read:
 *   patch:
 *     summary: Mark a message as read
 *     description: Any participant of the message's conversation can mark it read, not only the recipient.
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated message
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Message' } }
 *       403:
 *         description: Not a participant in this message's conversation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/read', requireAuth, validate({ params: schemas.messageIdParam }), controller.markRead);

module.exports = router;
