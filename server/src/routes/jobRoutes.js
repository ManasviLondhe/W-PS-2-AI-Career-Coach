import { Router } from 'express';
import {
  JobController,
  importJobSchema,
  analyzeUrlSchema,
  analyzeTextSchema,
  updateJobSchema,
} from '../controllers/jobController.js';
import { validateBody } from '../middleware/validate.js';

export const jobRoutes = Router();

jobRoutes.get('/', JobController.listJobs);
jobRoutes.get('/:id', JobController.getJobById);
jobRoutes.post('/analyze-url', validateBody(analyzeUrlSchema), JobController.analyzeUrl);
jobRoutes.post('/analyze-text', validateBody(analyzeTextSchema), JobController.analyzeText);
jobRoutes.post('/import', validateBody(importJobSchema), JobController.importJob);
jobRoutes.put('/:id', validateBody(updateJobSchema), JobController.updateJob);
jobRoutes.post('/:id/retry-analysis', JobController.retryAnalysis);
jobRoutes.post('/:id/extract-skills', JobController.extractSkills);
jobRoutes.delete('/:id', JobController.deleteJob);
