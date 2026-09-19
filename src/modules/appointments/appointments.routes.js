const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const controller = require('./appointments.controller');
const schemas = require('./appointments.schemas');

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /appointments:
 *   post:
 *     summary: Request an appointment with an approved specialist
 *     description: Refused if the specialist isn't approved yet. Status starts 'pending' — the specialist must accept via /appointments/{id}/respond.
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateAppointmentRequest' }
 *     responses:
 *       201:
 *         description: Created appointment (status pending)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Appointment' } }
 *       403:
 *         description: Specialist is not yet approved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   get:
 *     summary: List the caller's own appointments (as user, or as specialist if approved)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, rejected, cancelled, completed] }
 *     responses:
 *       200:
 *         description: Paginated list of appointments
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
 *                       items: { $ref: '#/components/schemas/Appointment' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 */
router.post('/', validate({ body: schemas.createAppointment }), controller.create);
router.get('/', validate({ query: schemas.listQuery }), controller.list);

/**
 * @openapi
 * /appointments/{id}/respond:
 *   patch:
 *     summary: Specialist accepts or rejects a pending appointment
 *     description: Overlap is only checked on accept, against the specialist's other accepted appointments in the same time window.
 *     tags: [Appointments]
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
 *           schema: { $ref: '#/components/schemas/RespondAppointmentRequest' }
 *     responses:
 *       200:
 *         description: Updated appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Appointment' } }
 *       403:
 *         description: Not part of this appointment
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: >
 *           Either already responded to (APPOINTMENT_NOT_PENDING) or overlaps an existing
 *           accepted appointment (APPOINTMENT_CONFLICT)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  '/:id/respond',
  validate({ params: schemas.appointmentIdParam, body: schemas.respondAppointment }),
  controller.respond
);

/**
 * @openapi
 * /appointments/{id}/cancel:
 *   patch:
 *     summary: Either party cancels an appointment before it starts
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated appointment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Appointment' } }
 *       403:
 *         description: Not part of this appointment, or it has already started
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Appointment cannot be cancelled from its current status (APPOINTMENT_NOT_CANCELLABLE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/cancel', validate({ params: schemas.appointmentIdParam }), controller.cancel);

module.exports = router;
