const { Router } = require('express');
const requireAuth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { authLimiter } = require('../../middleware/rateLimit');
const controller = require('./auth.controller');
const schemas = require('./auth.schemas');

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Always creates role 'user'. Becoming a specialist or admin happens later, never at registration.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *     responses:
 *       201:
 *         description: Created user and token
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AuthResult' } }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already registered (EMAIL_TAKEN)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', validate({ body: schemas.register }), controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: User and token
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AuthResult' } }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Account deactivated (ACCOUNT_INACTIVE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many attempts
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     description: Always returns 200 with the same generic message, whether or not the email is registered, to avoid leaking account existence.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ForgotPasswordRequest' }
 *     responses:
 *       200:
 *         description: Generic confirmation message
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
 *                       properties: { message: { type: string } }
 *       429:
 *         description: Too many attempts
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: schemas.forgotPassword }),
  controller.forgotPassword
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a token from the forgot-password email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ResetPasswordRequest' }
 *     responses:
 *       200:
 *         description: Confirmation message
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
 *                       properties: { message: { type: string } }
 *       400:
 *         description: Invalid or expired token (INVALID_TOKEN)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password', validate({ body: schemas.resetPassword }), controller.resetPassword);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: Log in or register with a Google ID token
 *     description: Verifies the ID token with Google. First login for a given Google account auto-creates role 'user'. If a password account with the same email already exists, it is linked instead of duplicated.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties: { idToken: { type: string } }
 *     responses:
 *       200:
 *         description: User and token
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/AuthResult' } }
 *       401:
 *         description: Invalid Google token or unverified email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Account deactivated (ACCOUNT_INACTIVE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/google', authLimiter, validate({ body: schemas.google }), controller.google);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the authenticated user's own profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The current user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties: { success: { type: boolean, example: true } }
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/User' } }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/me', requireAuth, controller.me);

module.exports = router;
