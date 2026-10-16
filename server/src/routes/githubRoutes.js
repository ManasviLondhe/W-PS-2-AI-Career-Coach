import { Router } from 'express';
import { PortfolioScanController } from '../controllers/portfolioScanController.js';
import { RepositoryController } from '../controllers/repositoryController.js';

export const githubRoutes = Router();

// --- Feature 2: GitHub User & Portfolio Scanning ---
// User profile & repositories
githubRoutes.get('/users/:username', PortfolioScanController.getUserProfile);
githubRoutes.get('/users/:username/repos', PortfolioScanController.getUserRepos);

// Repository metadata, branches, tree, and history
githubRoutes.get('/repos/:owner/:repo', PortfolioScanController.getRepoDetails);
githubRoutes.get('/repos/:owner/:repo/branches', PortfolioScanController.getRepoBranches);
githubRoutes.get('/repos/:owner/:repo/tree', PortfolioScanController.getRepoTree);
githubRoutes.get('/repos/:owner/:repo/history', PortfolioScanController.getRepoHistory);

// Scan operations
githubRoutes.post('/scan', PortfolioScanController.startScan);
githubRoutes.get('/scan/:scanId', PortfolioScanController.getScanStatus);
githubRoutes.get('/scan/:scanId/evidence', PortfolioScanController.getScanEvidence);

// Scan history snapshots
githubRoutes.get('/scans', PortfolioScanController.listScans);
githubRoutes.get('/scans/:id', PortfolioScanController.getScanById);

// --- Preserved Legacy GitHub Inspection Routes ---
githubRoutes.get('/:owner/:repo', RepositoryController.inspectGitHubRepo);
githubRoutes.get('/:owner/:repo/files', RepositoryController.getRepoFiles);
githubRoutes.get('/:owner/:repo/commits', RepositoryController.getRepoCommits);
githubRoutes.get('/:owner/:repo/content', RepositoryController.getRepoFileContent);
