import { Router } from 'express';
import { RepositoryController, trackRepoSchema } from '../controllers/repositoryController.js';
import { validateBody } from '../middleware/validate.js';

export const repositoryRoutes = Router();

repositoryRoutes.get('/', RepositoryController.listRepositories);
repositoryRoutes.post('/', validateBody(trackRepoSchema), RepositoryController.trackRepository);
repositoryRoutes.post('/track', validateBody(trackRepoSchema), RepositoryController.trackRepository);
repositoryRoutes.get('/:id', RepositoryController.getRepositoryById);
repositoryRoutes.post('/:id/track', RepositoryController.resumeTracking);
repositoryRoutes.post('/:id/untrack', RepositoryController.pauseTracking);
repositoryRoutes.post('/:id/analyze', RepositoryController.analyzeRepository);
repositoryRoutes.get('/:id/evidence', RepositoryController.getRepositoryEvidence);
repositoryRoutes.get('/:id/changes', RepositoryController.getRepositoryChanges);
repositoryRoutes.post('/:id/poll-now', RepositoryController.pollNow);
repositoryRoutes.post('/:id/check-now', RepositoryController.pollNow);
repositoryRoutes.delete('/:id', RepositoryController.deleteRepository);
