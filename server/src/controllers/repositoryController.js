import { Repository, Evidence, ChangeEvent } from '../models/index.js';
import { githubService } from '../services/githubService.js';
import { pollingWorker } from '../workers/pollingWorker.js';
import { AssessmentService } from '../services/assessmentService.js';
import { z } from 'zod';

export const trackRepoSchema = z.object({
  repoUrl: z.string().min(1, 'Repository URL or owner/name is required.'),
});

export class RepositoryController {
  static async listRepositories(req, res, next) {
    try {
      const repos = await Repository.find().sort({ updatedAt: -1 }).lean();
      res.json({ success: true, data: repos });
    } catch (err) {
      next(err);
    }
  }

  static async getRepositoryById(req, res, next) {
    try {
      const repo = await Repository.findById(req.params.id);
      if (!repo) {
        return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
      }
      res.json({ success: true, data: repo });
    } catch (err) {
      next(err);
    }
  }

  static async inspectGitHubRepo(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const metadata = await githubService.getRepository(owner, repo);
      const commit = await githubService.getLatestCommitSha(owner, repo, metadata.defaultBranch);

      res.json({
        success: true,
        data: {
          ...metadata,
          latestCommit: commit,
          rateLimit: githubService.getRateLimitStatus(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRepoFiles(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const ref = req.query.ref || 'main';
      const commit = await githubService.getLatestCommitSha(owner, repo, ref);
      const tree = await githubService.getFileTree(owner, repo, commit.sha);
      res.json({
        success: true,
        data: {
          commitSha: commit.sha,
          tree,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRepoCommits(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const limit = Math.min(30, parseInt(req.query.limit || '15', 10));
      const commits = await githubService.listCommits(owner, repo, limit);
      res.json({ success: true, data: commits });
    } catch (err) {
      next(err);
    }
  }

  static async getRepoFileContent(req, res, next) {
    try {
      const { owner, repo } = req.params;
      const filePath = req.query.path;
      const ref = req.query.ref || 'main';
      if (!filePath) {
        return res.status(400).json({ success: false, error: { message: 'File path query param is required.' } });
      }

      const content = await githubService.getFileContent(owner, repo, filePath, ref);
      if (content === null) {
        return res.status(404).json({ success: false, error: { message: 'File not found or exceeded size limit.' } });
      }

      res.json({ success: true, data: { path: filePath, content, ref } });
    } catch (err) {
      next(err);
    }
  }

  static async trackRepository(req, res, next) {
    try {
      const { repoUrl } = req.validatedBody;
      const { owner, repo: repoName } = githubService.parseRepoIdentifier(repoUrl);

      // Verify repo exists on GitHub
      const meta = await githubService.getRepository(owner, repoName);
      const commit = await githubService.getLatestCommitSha(owner, repoName, meta.defaultBranch);

      let repository = await Repository.findOne({ fullName: meta.fullName });
      if (repository) {
        repository.trackingState = 'active';
        repository.latestObservedSha = commit.sha;
        repository.stars = meta.stars;
        repository.description = meta.description;
        await repository.save();
      } else {
        repository = new Repository({
          owner: meta.owner,
          name: meta.name,
          fullName: meta.fullName,
          url: meta.url,
          defaultBranch: meta.defaultBranch,
          stars: meta.stars,
          description: meta.description,
          language: meta.language,
          trackingState: 'active',
          latestObservedSha: commit.sha,
          lastSuccessfullyAnalyzedSha: '',
        });
        await repository.save();
      }

      res.status(201).json({ success: true, data: repository });
    } catch (err) {
      next(err);
    }
  }

  static async pauseTracking(req, res, next) {
    try {
      const repo = await Repository.findById(req.params.id);
      if (!repo) {
        return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
      }
      repo.trackingState = 'paused';
      await repo.save();
      res.json({ success: true, message: 'Tracking paused.', data: repo });
    } catch (err) {
      next(err);
    }
  }

  static async resumeTracking(req, res, next) {
    try {
      const repo = await Repository.findById(req.params.id);
      if (!repo) {
        return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
      }
      repo.trackingState = 'active';
      await repo.save();
      res.json({ success: true, message: 'Tracking resumed.', data: repo });
    } catch (err) {
      next(err);
    }
  }

  static async deleteRepository(req, res, next) {
    try {
      const repo = await Repository.findByIdAndDelete(req.params.id);
      if (!repo) {
        return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
      }
      res.json({ success: true, message: 'Repository untracked successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async pollNow(req, res, next) {
    try {
      const repo = await Repository.findById(req.params.id);
      if (!repo) {
        return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
      }

      await pollingWorker._processRepository(repo);
      const updated = await Repository.findById(repo._id);

      res.json({
        success: true,
        message: 'Repository polled successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRepositoryEvidence(req, res, next) {
    try {
      const evidence = await Evidence.find({ repository: req.params.id }).sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: evidence });
    } catch (err) {
      next(err);
    }
  }

  static async getRepositoryChanges(req, res, next) {
    try {
      const changes = await ChangeEvent.find({ repository: req.params.id }).sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: changes });
    } catch (err) {
      next(err);
    }
  }

  static async analyzeRepository(req, res, next) {
    try {
      const { jobId } = req.body;
      if (!jobId) {
        return res.status(400).json({ success: false, error: { message: 'jobId is required in request body.' } });
      }
      const assessment = await AssessmentService.runAssessment(jobId, req.params.id, {
        type: 'manual',
        message: 'Repository analysis triggered via API',
      });
      res.status(201).json({ success: true, data: assessment });
    } catch (err) {
      next(err);
    }
  }
}
