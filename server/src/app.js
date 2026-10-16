import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { jobRoutes } from './routes/jobRoutes.js';
import { repositoryRoutes } from './routes/repositoryRoutes.js';
import { assessmentRoutes } from './routes/assessmentRoutes.js';
import { activityRoutes } from './routes/activityRoutes.js';
import { recommendationRoutes } from './routes/recommendationRoutes.js';
import { githubRoutes } from './routes/githubRoutes.js';
import { RepositoryController } from './controllers/repositoryController.js';

export const app = express();

// Security Headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CLIENT_ORIGIN === '*' ? true : [env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Apply Rate Limiter on API routes
app.use('/api', apiRateLimiter);

// GitHub portfolio analysis & repository routes
app.use('/api/github', githubRoutes);

// API Resource Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api', activityRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
      code: 'NOT_FOUND',
    },
  });
});

// Centralized error handler
app.use(errorHandler);
