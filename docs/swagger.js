const swaggerJsdoc = require('swagger-jsdoc');

// Shared response envelope shapes (see CLAUDE.md §5) and reusable request
// bodies, referenced from each route file's @openapi block via $ref.
const schemas = {
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Human-readable error message' },
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 10 },
      total: { type: 'integer', example: 42 },
    },
  },

  User: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      nickname: { type: 'string' },
      fullName: { type: 'string', nullable: true },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['user', 'specialist', 'admin'] },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AuthResult: {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      token: { type: 'string' },
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['nickname', 'email', 'password'],
    properties: {
      nickname: { type: 'string', minLength: 2, maxLength: 50 },
      fullName: { type: 'string', maxLength: 100 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 72 },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
  ForgotPasswordRequest: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } },
  },
  ResetPasswordRequest: {
    type: 'object',
    required: ['token', 'password'],
    properties: {
      token: { type: 'string' },
      password: { type: 'string', minLength: 8, maxLength: 72 },
    },
  },
  UpdateMeRequest: {
    type: 'object',
    properties: {
      nickname: { type: 'string', minLength: 2, maxLength: 50 },
      fullName: { type: 'string', maxLength: 100 },
      password: { type: 'string', minLength: 8, maxLength: 72 },
      currentPassword: { type: 'string', description: 'Required if password is set' },
    },
  },

  EmergencyContact: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      relationship: { type: 'string', nullable: true },
      isPrimary: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateEmergencyContactRequest: {
    type: 'object',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', maxLength: 100 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', maxLength: 20 },
      relationship: { type: 'string', maxLength: 50 },
      isPrimary: { type: 'boolean', default: false },
    },
  },
  UpdateEmergencyContactRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 100 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', maxLength: 20 },
      relationship: { type: 'string', maxLength: 50 },
      isPrimary: { type: 'boolean' },
    },
  },
  EmergencyAlertResult: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['sent', 'failed'] },
      sentAt: { type: 'string', format: 'date-time' },
    },
  },
  EmergencyResource: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string' },
      url: { type: 'string' },
      region: { type: 'string' },
      available: { type: 'string' },
    },
  },

  Category: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      nameAr: { type: 'string' },
      nameEn: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string', nullable: true },
      sortOrder: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateCategoryRequest: {
    type: 'object',
    required: ['nameAr', 'nameEn'],
    properties: {
      nameAr: { type: 'string', maxLength: 100 },
      nameEn: { type: 'string', maxLength: 100 },
      description: { type: 'string' },
      sortOrder: { type: 'integer', default: 0 },
    },
  },
  UpdateCategoryRequest: {
    type: 'object',
    properties: {
      nameAr: { type: 'string', maxLength: 100 },
      nameEn: { type: 'string', maxLength: 100 },
      description: { type: 'string' },
      sortOrder: { type: 'integer' },
    },
  },

  Article: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      categoryId: { type: 'integer' },
      title: { type: 'string' },
      slug: { type: 'string' },
      excerpt: { type: 'string', nullable: true },
      content: { type: 'string' },
      coverImage: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['draft', 'published'] },
      viewsCount: { type: 'integer' },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateArticleRequest: {
    type: 'object',
    required: ['categoryId', 'title', 'content'],
    properties: {
      categoryId: { type: 'integer' },
      title: { type: 'string', maxLength: 255 },
      excerpt: { type: 'string', maxLength: 500 },
      content: { type: 'string' },
      coverImage: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
    },
  },
  UpdateArticleRequest: {
    type: 'object',
    properties: {
      categoryId: { type: 'integer' },
      title: { type: 'string', maxLength: 255 },
      excerpt: { type: 'string', maxLength: 500 },
      content: { type: 'string' },
      coverImage: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'published'] },
    },
  },

  MoodLog: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      logDate: { type: 'string', format: 'date' },
      moodLevel: { type: 'integer', minimum: 1, maximum: 5 },
      stressLevel: { type: 'integer', minimum: 1, maximum: 5 },
      sleepQuality: { type: 'integer', minimum: 1, maximum: 5 },
      sleepHours: { type: 'number', nullable: true },
      note: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateMoodRequest: {
    type: 'object',
    required: ['moodLevel', 'stressLevel', 'sleepQuality'],
    properties: {
      moodLevel: { type: 'integer', minimum: 1, maximum: 5 },
      stressLevel: { type: 'integer', minimum: 1, maximum: 5 },
      sleepQuality: { type: 'integer', minimum: 1, maximum: 5 },
      sleepHours: { type: 'number', minimum: 0, maximum: 24 },
      note: { type: 'string', maxLength: 2000 },
    },
  },
  UpdateMoodRequest: {
    type: 'object',
    properties: {
      moodLevel: { type: 'integer', minimum: 1, maximum: 5 },
      stressLevel: { type: 'integer', minimum: 1, maximum: 5 },
      sleepQuality: { type: 'integer', minimum: 1, maximum: 5 },
      sleepHours: { type: 'number', minimum: 0, maximum: 24 },
      note: { type: 'string', maxLength: 2000 },
    },
  },
  MoodSummaryPoint: {
    type: 'object',
    properties: {
      period: { type: 'string', format: 'date' },
      entries: { type: 'integer' },
      avgMood: { type: 'number', nullable: true },
      avgStress: { type: 'number', nullable: true },
      avgSleepQuality: { type: 'number', nullable: true },
      avgSleepHours: { type: 'number', nullable: true },
    },
  },

  Specialist: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      nickname: { type: 'string' },
      specialization: { type: 'string' },
      bio: { type: 'string', nullable: true },
      yearsExperience: { type: 'integer', nullable: true },
      verificationStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
    },
  },
  ApplySpecialistRequest: {
    type: 'object',
    required: ['specialization'],
    properties: {
      specialization: { type: 'string', maxLength: 100 },
      bio: { type: 'string', maxLength: 2000 },
      licenseNumber: { type: 'string', maxLength: 100 },
      yearsExperience: { type: 'integer', minimum: 0, maximum: 80 },
    },
  },

  Appointment: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      specialistId: { type: 'integer' },
      scheduledAt: { type: 'string', format: 'date-time' },
      durationMin: { type: 'integer' },
      status: {
        type: 'string',
        enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      },
      userNote: { type: 'string', nullable: true },
      responseNote: { type: 'string', nullable: true },
      respondedAt: { type: 'string', format: 'date-time', nullable: true },
      cancelledBy: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateAppointmentRequest: {
    type: 'object',
    required: ['specialistId', 'scheduledAt'],
    properties: {
      specialistId: { type: 'integer' },
      scheduledAt: { type: 'string', format: 'date-time' },
      durationMin: { type: 'integer', default: 45, maximum: 240 },
      userNote: { type: 'string', maxLength: 2000 },
    },
  },
  RespondAppointmentRequest: {
    type: 'object',
    required: ['decision'],
    properties: {
      decision: { type: 'string', enum: ['accepted', 'rejected'] },
      responseNote: { type: 'string', maxLength: 2000 },
    },
  },

  Conversation: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      specialistId: { type: 'integer' },
      appointmentId: { type: 'integer', nullable: true },
      lastMessageAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Message: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      conversationId: { type: 'integer' },
      senderId: { type: 'integer' },
      body: { type: 'string' },
      isRead: { type: 'boolean' },
      readAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  SendMessageRequest: {
    type: 'object',
    required: ['body'],
    properties: { body: { type: 'string', minLength: 1, maxLength: 5000 } },
  },
  UnreadCount: {
    type: 'object',
    properties: { count: { type: 'integer' } },
  },

  AdminUser: {
    allOf: [
      { $ref: '#/components/schemas/User' },
      {
        type: 'object',
        properties: { lastLoginAt: { type: 'string', format: 'date-time', nullable: true } },
      },
    ],
  },
  UpdateUserStatusRequest: {
    type: 'object',
    required: ['isActive'],
    properties: { isActive: { type: 'boolean' } },
  },
  AdminSpecialist: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      nickname: { type: 'string' },
      email: { type: 'string', format: 'email' },
      specialization: { type: 'string' },
      bio: { type: 'string', nullable: true },
      licenseNumber: { type: 'string', nullable: true },
      yearsExperience: { type: 'integer', nullable: true },
      verificationStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
      rejectionReason: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  VerifySpecialistRequest: {
    type: 'object',
    required: ['decision'],
    properties: {
      decision: { type: 'string', enum: ['approved', 'rejected'] },
      rejectionReason: { type: 'string', maxLength: 255, description: 'Required when decision is rejected' },
    },
  },
  AdminStats: {
    type: 'object',
    properties: {
      totalUsers: { type: 'integer' },
      totalApprovedSpecialists: { type: 'integer' },
      totalPublishedArticles: { type: 'integer' },
      appointmentsByStatus: {
        type: 'object',
        properties: {
          pending: { type: 'integer' },
          accepted: { type: 'integer' },
          rejected: { type: 'integer' },
          cancelled: { type: 'integer' },
          completed: { type: 'integer' },
        },
      },
      emergencyAlertsLast30Days: { type: 'integer' },
    },
  },
  AuditLogEntry: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      actorId: { type: 'integer', nullable: true },
      action: { type: 'string' },
      entityType: { type: 'string' },
      entityId: { type: 'integer', nullable: true },
      metadata: { type: 'object', nullable: true },
      ipAddress: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Safe Mind API',
      version: '1.0.0',
      description: 'Backend API for the Safe Mind mental health awareness platform',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas,
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
