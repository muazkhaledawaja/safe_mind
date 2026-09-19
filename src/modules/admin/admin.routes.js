const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const validate = require('../../middleware/validate');
const controller = require('./admin.controller');
const schemas = require('./admin.schemas');

const router = Router();

router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all users, optionally filtered by role
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, specialist, admin] }
 *     responses:
 *       200:
 *         description: Paginated list of users
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
 *                       items: { $ref: '#/components/schemas/AdminUser' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/users', validate({ query: schemas.listUsersQuery }), controller.listUsers);

/**
 * @openapi
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a user account
 *     description: Audited as user_activate/user_deactivate. A deactivated account cannot log in until reactivated.
 *     tags: [Admin]
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
 *           schema: { $ref: '#/components/schemas/UpdateUserStatusRequest' }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AdminUser' } }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  '/users/:id/status',
  validate({ params: schemas.userIdParam, body: schemas.updateUserStatus }),
  controller.setUserStatus
);

/**
 * @openapi
 * /admin/specialists:
 *   get:
 *     summary: List specialist applications, optionally filtered by status
 *     tags: [Admin]
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
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *     responses:
 *       200:
 *         description: Paginated list of specialist applications
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
 *                       items: { $ref: '#/components/schemas/AdminSpecialist' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/specialists', validate({ query: schemas.listSpecialistsQuery }), controller.listSpecialists);

/**
 * @openapi
 * /admin/specialists/{id}/verify:
 *   patch:
 *     summary: Approve or reject a pending specialist application
 *     description: Approving flips the applicant's role from 'user' to 'specialist' — the only place that happens. Rejecting requires a rejectionReason and leaves the role unchanged. Always audited and emails the applicant.
 *     tags: [Admin]
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
 *           schema: { $ref: '#/components/schemas/VerifySpecialistRequest' }
 *     responses:
 *       200:
 *         description: Updated specialist application
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AdminSpecialist' } }
 *       400:
 *         description: Missing rejectionReason when rejecting
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Already reviewed (ALREADY_REVIEWED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch(
  '/specialists/:id/verify',
  validate({ params: schemas.specialistIdParam, body: schemas.verifySpecialist }),
  controller.verifySpecialist
);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Platform-wide counts for the admin dashboard
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Stats
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AdminStats' } }
 */
router.get('/stats', controller.getStats);

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     summary: Filterable audit log of privileged actions
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: actorId
 *         schema: { type: integer }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of audit log entries
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
 *                       items: { $ref: '#/components/schemas/AuditLogEntry' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/audit-logs', validate({ query: schemas.auditLogsQuery }), controller.listAuditLogs);

module.exports = router;
