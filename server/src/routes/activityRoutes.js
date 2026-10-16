import { Router } from 'express';
import { ActivityController } from '../controllers/activityController.js';
import { sseService } from '../workers/sseService.js';

export const activityRoutes = Router();

activityRoutes.get('/activity', ActivityController.getActivity);
activityRoutes.get('/activity/:assessmentId', ActivityController.getActivityByAssessment);
activityRoutes.get('/health', ActivityController.getHealth);

// Server-Sent Events endpoint
activityRoutes.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date() })}\n\n`);

  sseService.addClient(res);
});
