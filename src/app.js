const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../docs/swagger');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const emergencyRoutes = require('./modules/emergency/emergency.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const articlesRoutes = require('./modules/articles/articles.routes');
const moodRoutes = require('./modules/mood/mood.routes');
const specialistsRoutes = require('./modules/specialists/specialists.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');
const conversationsRoutes = require('./modules/messages/messages.routes');
const messageActionsRoutes = require('./modules/messages/messageActions.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const v1 = express.Router();
v1.use('/auth', authRoutes);
v1.use('/users', usersRoutes);
v1.use('/emergency', emergencyRoutes);
v1.use('/categories', categoriesRoutes);
v1.use('/articles', articlesRoutes);
v1.use('/mood', moodRoutes);
v1.use('/specialists', specialistsRoutes);
v1.use('/appointments', appointmentsRoutes);
v1.use('/conversations', conversationsRoutes);
v1.use('/messages', messageActionsRoutes);
v1.use('/admin', adminRoutes);
app.use('/api/v1', v1);

app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

module.exports = app;
