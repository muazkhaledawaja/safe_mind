const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./emergency.controller');
const schemas = require('./emergency.schemas');

const router = Router();

/**
 * @openapi
 * /emergency/resources:
 *   get:
 *     summary: Static list of crisis helplines
 *     tags: [Emergency]
 *     responses:
 *       200:
 *         description: List of resources
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
 *                       items: { $ref: '#/components/schemas/EmergencyResource' }
 */
router.get('/resources', controller.getResources);

router.use(requireAuth);

/**
 * @openapi
 * /emergency/contacts:
 *   get:
 *     summary: List the authenticated user's emergency contacts
 *     tags: [Emergency]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of contacts
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
 *                       items: { $ref: '#/components/schemas/EmergencyContact' }
 *   post:
 *     summary: Add an emergency contact (max 3, first one is always primary)
 *     tags: [Emergency]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateEmergencyContactRequest' }
 *     responses:
 *       201:
 *         description: Created contact
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/EmergencyContact' } }
 *       409:
 *         description: Contact limit reached (CONTACT_LIMIT_REACHED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/contacts', controller.listContacts);
router.post('/contacts', validate({ body: schemas.createContact }), controller.createContact);

/**
 * @openapi
 * /emergency/contacts/{id}:
 *   patch:
 *     summary: Update an emergency contact
 *     tags: [Emergency]
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
 *           schema: { $ref: '#/components/schemas/UpdateEmergencyContactRequest' }
 *     responses:
 *       200:
 *         description: Updated contact
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/EmergencyContact' } }
 *       404:
 *         description: Not found (or not owned by the caller)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   delete:
 *     summary: Remove an emergency contact
 *     tags: [Emergency]
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
 *         description: Not found (or not owned by the caller)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  '/contacts/:id',
  validate({ params: schemas.contactIdParam, body: schemas.updateContact }),
  controller.updateContact
);
router.delete('/contacts/:id', validate({ params: schemas.contactIdParam }), controller.deleteContact);

/**
 * @openapi
 * /emergency/alert:
 *   post:
 *     summary: Notify the user's primary emergency contact
 *     description: Only ever triggered by this explicit authenticated call — no automated or scheduled process may dispatch an alert. A mail-provider failure still returns 200 with status 'failed'; every attempt is logged to emergency_alerts.
 *     tags: [Emergency]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Alert dispatch result
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/EmergencyAlertResult' } }
 *       409:
 *         description: No primary emergency contact set (NO_PRIMARY_CONTACT)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Rate limited — 3 alerts per hour (RATE_LIMITED); the attempt is still logged
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/alert', controller.sendAlert);

module.exports = router;
