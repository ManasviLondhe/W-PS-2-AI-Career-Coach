/**
 * Recommendation Routes — Feature 4: Personalized Skill-Gap Analysis
 *
 * Base path: /api/recommendations
 */

import { Router } from 'express';
import {
  RecommendationController,
  generateRecommendationsSchema,
  updateTaskProgressSchema,
} from '../controllers/recommendationController.js';
import { validateBody } from '../middleware/validate.js';

export const recommendationRoutes = Router();

// List recommendations (with optional filters)
recommendationRoutes.get('/', RecommendationController.listRecommendations);

// Generate (or refresh) recommendations for an assessment
recommendationRoutes.post(
  '/generate',
  validateBody(generateRecommendationsSchema),
  RecommendationController.generateRecommendations
);

// Get all recommendations for a specific assessment (convenience endpoint)
recommendationRoutes.get(
  '/by-assessment/:assessmentId',
  RecommendationController.getByAssessment
);

// Get a single recommendation by ID
recommendationRoutes.get('/:id', RecommendationController.getRecommendationById);

// Update task progress (PATCH — partial update; never modifies assessment)
recommendationRoutes.patch(
  '/:id/progress',
  validateBody(updateTaskProgressSchema),
  RecommendationController.updateTaskProgress
);
