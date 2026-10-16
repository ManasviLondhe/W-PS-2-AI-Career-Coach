import { Router } from 'express';
import { AssessmentController, runAssessmentSchema } from '../controllers/assessmentController.js';
import { validateBody } from '../middleware/validate.js';

export const assessmentRoutes = Router();

assessmentRoutes.get('/', AssessmentController.listAssessments);
assessmentRoutes.post('/', validateBody(runAssessmentSchema), AssessmentController.createAssessment);
assessmentRoutes.get('/evidence/list', AssessmentController.listEvidence);
assessmentRoutes.get('/evidence/:evidenceId', AssessmentController.getEvidenceById);
assessmentRoutes.get('/latest/:repositoryId', AssessmentController.getLatestByRepo);
assessmentRoutes.get('/:id', AssessmentController.getAssessmentById);
assessmentRoutes.get('/:id/history', AssessmentController.getAssessmentHistory);
assessmentRoutes.get('/:id/compare', AssessmentController.compareAssessments);
