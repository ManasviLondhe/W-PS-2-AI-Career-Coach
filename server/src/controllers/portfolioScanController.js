import { z } from 'zod';
import { githubService } from '../services/githubService.js';
import { PortfolioScanService } from '../services/portfolioScanService.js';

const startScanSchema = z.object({
  username: z.string().optional(),
  repositories: z
    .array(
      z.union([
        z.string(),
        z.object({
          owner: z.string().optional(),
          repo: z.string().optional(),
          repoUrl: z.string().optional(),
          branch: z.string().optional(),
        }),
      ])
    )
    .min(1, 'Please select at least one repository to scan.'),
  runAsync: z.boolean().default(true),
  limits: z
    .object({
      maxRepos: z.number().optional(),
      maxFiles: z.number().optional(),
      maxFileSizeKb: z.number().optional(),
    })
    .optional(),
});

export class PortfolioScanController {
  /**
   * GET /api/github/users/:username
   * Retrieve and validate GitHub public user profile
   */
  static async getUserProfile(req, res, next) {
    try {
      const { username } = req.params;
      const user = await githubService.getUser(username);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/users/:username/repos
   * List user's public repositories with pagination and keyword filtering
   */
  static async getUserRepos(req, res, next) {
    try {
      const { username } = req.params;
      const { page, per_page, sort, direction, search } = req.query;

      let repos = await githubService.getUserRepos(username, {
        page,
        perPage: per_page,
        sort,
        direction,
      });

      if (search && typeof search === 'string' && search.trim() !== '') {
        const query = search.trim().toLowerCase();
        repos = repos.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            r.description.toLowerCase().includes(query) ||
            r.language.toLowerCase().includes(query)
        );
      }

      res.json({
        success: true,
        data: {
          repos,
          total: repos.length,
          rateLimit: githubService.getRateLimitStatus(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/repos/:owner/:repo
   * Retrieve repository metadata and latest commit
   */
  static async getRepoDetails(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const metadata = await githubService.getRepository(owner, repo);
      const commit = await githubService.getLatestCommitSha(owner, repo, metadata.defaultBranch);
      const branches = await githubService.getRepoBranches(owner, repo).catch(() => []);

      res.json({
        success: true,
        data: {
          ...metadata,
          latestCommit: commit,
          branches,
          rateLimit: githubService.getRateLimitStatus(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/repos/:owner/:repo/branches
   * List all branches for repository
   */
  static async getRepoBranches(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const branches = await githubService.getRepoBranches(owner, repo);
      res.json({ success: true, data: branches });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/repos/:owner/:repo/tree
   * Retrieve repository tree at commit SHA or branch
   */
  static async getRepoTree(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const ref = req.query.ref || 'main';
      const commit = await githubService.getLatestCommitSha(owner, repo, ref);
      const tree = await githubService.getRawFileTree(owner, repo, commit.sha);

      res.json({
        success: true,
        data: {
          commitSha: commit.sha,
          branch: ref,
          tree,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/github/scan
   * Initiate source code portfolio scan across selected repositories and branches
   */
  static async startScan(req, res, next) {
    try {
      const parsed = startScanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid scan request payload.',
            details: parsed.error.format(),
          },
        });
      }

      const { username, repositories, runAsync, limits } = parsed.data;

      const result = await PortfolioScanService.startScan({
        username,
        repositories,
        runAsync,
        limits,
      });

      res.status(runAsync ? 202 : 201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/scan/:scanId
   * Retrieve scan progress or complete results
   */
  static async getScanStatus(req, res, next) {
    try {
      const { scanId } = req.params;
      const scan = await PortfolioScanService.getScan(scanId);

      if (!scan) {
        return res.status(404).json({
          success: false,
          error: { message: `Scan with id "${scanId}" was not found.` },
        });
      }

      res.json({ success: true, data: scan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/scan/:scanId/evidence
   * Retrieve evidence findings for a completed scan
   */
  static async getScanEvidence(req, res, next) {
    try {
      const { scanId } = req.params;
      const scan = await PortfolioScanService.getScan(scanId);

      if (!scan) {
        return res.status(404).json({
          success: false,
          error: { message: `Scan with id "${scanId}" was not found.` },
        });
      }

      res.json({
        success: true,
        data: {
          scanId: scan.scanId,
          findings: scan.findings,
          total: scan.findings.length,
          scopeStatement: scan.scopeStatement,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/repos/:owner/:repo/history
   * Retrieve previous scan snapshots for a repository
   */
  static async getRepoHistory(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const history = await PortfolioScanService.getRepoHistory(owner, repo);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/scans
   * List all previous scans with pagination
   */
  static async listScans(req, res, next) {
    try {
      const { username, repo, page, limit } = req.query;
      const result = await PortfolioScanService.listScans({
        username,
        repoFullName: repo,
        page,
        limit,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/github/scans/:id
   * Get single scan snapshot by MongoDB _id or scanId
   */
  static async getScanById(req, res, next) {
    try {
      const { id } = req.params;
      const scan = await PortfolioScanService.getScan(id);

      if (!scan) {
        return res.status(404).json({
          success: false,
          error: { message: `Scan "${id}" was not found.` },
        });
      }

      res.json({ success: true, data: scan });
    } catch (err) {
      next(err);
    }
  }
}
