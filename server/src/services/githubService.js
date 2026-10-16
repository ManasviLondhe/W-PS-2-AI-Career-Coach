import { Octokit } from 'octokit';
import { env } from '../config/env.js';

export class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== '' ? env.GITHUB_TOKEN.trim() : undefined,
    });
    this.rateLimitInfo = {
      remaining: 60,
      limit: 60,
      reset: Math.floor(Date.now() / 1000) + 3600,
      hasToken: Boolean(env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== ''),
    };
  }

  /**
   * Parse owner and repository from input URL or string "owner/repo"
   */
  parseRepoIdentifier(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid repository identifier.');
    }

    let clean = input.trim();
    // Strip trailing .git and trailing slashes
    clean = clean.replace(/\.git$/, '').replace(/\/+$/, '');

    // Check if full URL: e.g. https://github.com/facebook/react
    const urlMatch = clean.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (urlMatch) {
      return { owner: urlMatch[1], repo: urlMatch[2] };
    }

    // Check if "owner/repo"
    const slashMatch = clean.match(/^([^/]+)\/([^/]+)$/);
    if (slashMatch) {
      return { owner: slashMatch[1], repo: slashMatch[2] };
    }

    throw new Error('Invalid repository format. Please supply a GitHub URL (e.g., https://github.com/owner/repo) or "owner/repo".');
  }

  _updateRateLimits(headers) {
    if (!headers) return;
    const remaining = headers['x-ratelimit-remaining'];
    const limit = headers['x-ratelimit-limit'];
    const reset = headers['x-ratelimit-reset'];

    if (remaining !== undefined) this.rateLimitInfo.remaining = parseInt(remaining, 10);
    if (limit !== undefined) this.rateLimitInfo.limit = parseInt(limit, 10);
    if (reset !== undefined) this.rateLimitInfo.reset = parseInt(reset, 10);
  }

  getRateLimitStatus() {
    return { ...this.rateLimitInfo };
  }

  /**
   * Fetch repository metadata
   */
  async getRepository(owner, repo) {
    try {
      const res = await this.octokit.rest.repos.get({ owner, repo });
      this._updateRateLimits(res.headers);

      return {
        owner: res.data.owner.login,
        name: res.data.name,
        fullName: res.data.full_name,
        url: res.data.html_url,
        defaultBranch: res.data.default_branch || 'main',
        stars: res.data.stargazers_count,
        description: res.data.description || '',
        language: res.data.language || '',
        isPrivate: res.data.private,
      };
    } catch (err) {
      if (err.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" was not found or is private.`);
      }
      if (err.status === 403) {
        throw new Error('GitHub API rate limit exceeded or access forbidden. Provide GITHUB_TOKEN for higher rate limits.');
      }
      throw new Error(`GitHub API error: ${err.message}`);
    }
  }

  /**
   * Fetch latest default branch commit SHA
   */
  async getLatestCommitSha(owner, repo, branch = 'main') {
    try {
      const res = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: branch,
      });
      this._updateRateLimits(res.headers);
      return {
        sha: res.data.sha,
        message: res.data.commit.message,
        author: res.data.commit.author?.name || res.data.author?.login || 'Unknown',
        date: res.data.commit.author?.date || new Date().toISOString(),
      };
    } catch (err) {
      throw new Error(`Failed to fetch latest commit for ${owner}/${repo}@${branch}: ${err.message}`);
    }
  }

  /**
   * Fetch file tree for a specific commit SHA
   */
  async getFileTree(owner, repo, commitSha) {
    try {
      const res = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitSha,
        recursive: '1',
      });
      this._updateRateLimits(res.headers);

      const items = res.data.tree || [];
      // Filter out binaries, vendor dirs, build dirs, lockfiles
      const filtered = items.filter((item) => {
        if (item.type !== 'blob') return false;
        const p = item.path.toLowerCase();
        if (
          p.includes('node_modules/') ||
          p.includes('.git/') ||
          p.includes('dist/') ||
          p.includes('build/') ||
          p.includes('vendor/') ||
          p.includes('coverage/') ||
          p.endsWith('package-lock.json') ||
          p.endsWith('yarn.lock') ||
          p.endsWith('pnpm-lock.yaml') ||
          p.endsWith('.min.js') ||
          p.endsWith('.map') ||
          p.endsWith('.png') ||
          p.endsWith('.jpg') ||
          p.endsWith('.svg') ||
          p.endsWith('.ico') ||
          p.endsWith('.pdf')
        ) {
          return false;
        }
        return true;
      });

      return filtered;
    } catch (err) {
      throw new Error(`Failed to retrieve file tree for ${owner}/${repo}: ${err.message}`);
    }
  }

  /**
   * Fetch single file content (bounded by 250KB)
   */
  async getFileContent(owner, repo, filePath, commitSha) {
    try {
      const res = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: commitSha,
      });
      this._updateRateLimits(res.headers);

      if (res.data.type !== 'file' || !res.data.content) {
        return null;
      }

      // 250KB limit to prevent memory/rate-limit issues
      if (res.data.size > 250 * 1024) {
        return null;
      }

      const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
      return decoded;
    } catch (err) {
      // Return null gracefully if file not found or truncated
      return null;
    }
  }

  /**
   * Compare two commit SHAs to detect changed files
   */
  async compareCommits(owner, repo, baseSha, headSha) {
    try {
      const res = await this.octokit.rest.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${baseSha}...${headSha}`,
      });
      this._updateRateLimits(res.headers);

      const changedFiles = (res.data.files || []).map((f) => ({
        filename: f.filename,
        status: f.status, // 'added', 'modified', 'renamed', 'removed'
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
      }));

      return {
        aheadBy: res.data.ahead_by,
        behindBy: res.data.behind_by,
        totalCommits: res.data.total_commits,
        changedFiles,
      };
    } catch (err) {
      throw new Error(`Failed to compare commits ${baseSha}...${headSha}: ${err.message}`);
    }
  }

  /**
   * Fetch recent commit history
   */
  async listCommits(owner, repo, limit = 15) {
    try {
      const res = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: limit,
      });
      this._updateRateLimits(res.headers);

      return res.data.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name || c.author?.login || 'Unknown',
        date: c.commit.author?.date || new Date().toISOString(),
        url: c.html_url,
      }));
    } catch (err) {
      throw new Error(`Failed to list commits for ${owner}/${repo}: ${err.message}`);
    }
  }
}

export const githubService = new GitHubService();
