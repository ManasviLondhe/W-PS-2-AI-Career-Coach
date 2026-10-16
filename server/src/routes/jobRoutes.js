import { Router } from 'express';
import { JobController, importJobSchema } from '../controllers/jobController.js';
import { validateBody } from '../middleware/validate.js';

export const jobRoutes = Router();

jobRoutes.get('/', JobController.listJobs);
jobRoutes.get('/:id', JobController.getJobById);
jobRoutes.post('/import', validateBody(importJobSchema), JobController.importJob);
jobRoutes.post('/:id/extract-skills', JobController.extractSkills);
jobRoutes.delete('/:id', JobController.deleteJob);
