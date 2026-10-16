import { Octokit } from 'octokit';
import { env } from '../config/env.js';

export class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== '' ? env.GITHUB_TOKEN.trim() : undefined,
      request: {
        timeout: env.GITHUB_REQUEST_TIMEOUT_MS || 15000,
      },
      throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(`GitHub rate limit reached for ${options.method} ${options.url}`);
          return false; // Do not hang or sleep; fail fast with clear message
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(`GitHub secondary rate limit for ${options.method} ${options.url}`);
          return false;
        },
      },
      retry: {
        enabled: false,
      },
    });

    this.rateLimitInfo = {
      remaining: 60,
      limit: 60,
      reset: Math.floor(Date.now() / 1000) + 3600,
      hasToken: Boolean(env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== ''),
    };
  }

  /**
   * Validate GitHub username according to GitHub naming rules:
   * Max 39 chars, alphanumeric or single hyphens, cannot begin/end with hyphen.
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    const clean = username.trim();
    return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean);
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
    const urlMatch = clean.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)$/i);
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

  /**
   * Intelligently parses user input: can be a username, user URL, repo URL, or owner/repo
   */
  parseUserInput(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Please provide a GitHub username, profile link, or repository URL.');
    }

    let clean = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');

    // Check if repo URL: https://github.com/owner/repo or github.com/owner/repo
    const repoMatch = clean.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)$/i);
    if (repoMatch) {
      return {
        type: 'repo',
        owner: repoMatch[1],
        repo: repoMatch[2],
        username: repoMatch[1],
      };
    }

    // Check if "owner/repo"
    const slashMatch = clean.match(/^([^/]+)\/([^/]+)$/);
    if (slashMatch) {
      return {
        type: 'repo',
        owner: slashMatch[1],
        repo: slashMatch[2],
        username: slashMatch[1],
      };
    }

    // Check if user URL: https://github.com/username
    const userUrlMatch = clean.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)$/i);
    if (userUrlMatch) {
      const username = userUrlMatch[1];
      if (this.validateUsername(username)) {
        return { type: 'user', username };
      }
    }

    // Plain username
    if (this.validateUsername(clean)) {
      return { type: 'user', username: clean };
    }

    throw new Error(`Invalid GitHub identifier "${input}". Enter a valid GitHub username (e.g., "octocat") or repository URL.`);
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

  _handleError(err, context = '') {
    if (err.status === 404) {
      const e = new Error(`${context || 'Resource'} was not found on GitHub or is private.`);
      e.status = 404;
      e.code = 'NOT_FOUND';
      throw e;
    }
    if (err.status === 403 || err.message?.includes('rate limit') || err.message?.includes('quota exhausted')) {
      const resetTime = this.rateLimitInfo.reset
        ? new Date(this.rateLimitInfo.reset * 1000).toLocaleTimeString()
        : 'in a few minutes';
      const e = new Error(`GitHub API rate limit exceeded (Resets at ${resetTime}). Add a GITHUB_TOKEN to server/.env for 5,000 requests/hr.`);
      e.status = 429;
      e.code = 'RATE_LIMIT_EXCEEDED';
      throw e;
    }
    if (err.status === 401) {
      const e = new Error('Invalid or expired GITHUB_TOKEN provided in backend configuration.');
      e.status = 401;
      e.code = 'UNAUTHORIZED';
      throw e;
    }
    const e = new Error(`GitHub API error (${context}): ${err.message}`);
    e.status = err.status || 500;
    e.code = 'GITHUB_API_ERROR';
    throw e;
  }

  /**
   * Fetch public GitHub user profile
   */
  async getUser(username) {
    if (!this.validateUsername(username)) {
      const e = new Error(`Invalid GitHub username format: "${username}".`);
      e.status = 400;
      e.code = 'INVALID_USERNAME';
      throw e;
    }

    try {
      const res = await this.octokit.rest.users.getByUsername({ username });
      this._updateRateLimits(res.headers);

      return {
        login: res.data.login,
        name: res.data.name || res.data.login,
        avatarUrl: res.data.avatar_url,
        bio: res.data.bio || '',
        company: res.data.company || '',
        location: res.data.location || '',
        blog: res.data.blog || '',
        publicRepos: res.data.public_repos || 0,
        followers: res.data.followers || 0,
        following: res.data.following || 0,
        htmlUrl: res.data.html_url,
        createdAt: res.data.created_at,
      };
    } catch (err) {
      this._handleError(err, `User "${username}"`);
    }
  }

  /**
   * List public repositories for a user with pagination and sorting
   */
  async getUserRepos(username, { page = 1, perPage = 30, sort = 'updated', direction = 'desc' } = {}) {
    if (!this.validateUsername(username)) {
      const e = new Error(`Invalid GitHub username format: "${username}".`);
      e.status = 400;
      e.code = 'INVALID_USERNAME';
      throw e;
    }

    try {
      const res = await this.octokit.rest.repos.listForUser({
        username,
        page: Math.max(1, parseInt(page, 10) || 1),
        per_page: Math.min(100, Math.max(1, parseInt(perPage, 10) || 30)),
        sort,
        direction,
        type: 'all',
      });
      this._updateRateLimits(res.headers);

      return res.data.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        description: r.description || '',
        url: r.html_url,
        defaultBranch: r.default_branch || 'main',
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language || '',
        isFork: r.fork,
        isPrivate: r.private,
        updatedAt: r.updated_at,
        pushedAt: r.pushed_at,
        size: r.size,
      }));
    } catch (err) {
      this._handleError(err, `Repositories for "${username}"`);
    }
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
        forks: res.data.forks_count,
        description: res.data.description || '',
        language: res.data.language || '',
        isPrivate: res.data.private,
        updatedAt: res.data.updated_at,
        pushedAt: res.data.pushed_at,
        size: res.data.size,
      };
    } catch (err) {
      this._handleError(err, `Repository "${owner}/${repo}"`);
    }
  }

  /**
   * Fetch branches for repository
   */
  async getRepoBranches(owner, repo) {
    try {
      const res = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });
      this._updateRateLimits(res.headers);

      return res.data.map((b) => ({
        name: b.name,
        commitSha: b.commit.sha,
        isProtected: b.protected,
      }));
    } catch (err) {
      this._handleError(err, `Branches for "${owner}/${repo}"`);
    }
  }

  /**
   * Fetch latest branch commit SHA
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
      this._handleError(err, `Commit for "${owner}/${repo}@${branch}"`);
    }
  }

  /**
   * Fetch raw file tree for a specific commit SHA (unfiltered, recursive)
   */
  async getRawFileTree(owner, repo, commitSha) {
    try {
      const res = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitSha,
        recursive: '1',
      });
      this._updateRateLimits(res.headers);
      return res.data.tree || [];
    } catch (err) {
      this._handleError(err, `File tree for "${owner}/${repo}"`);
    }
  }

  /**
   * Fetch filtered file tree for a specific commit SHA (legacy helper used by existing routes)
   */
  async getFileTree(owner, repo, commitSha) {
    const items = await this.getRawFileTree(owner, repo, commitSha);
    return items.filter((item) => {
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
  }

  /**
   * Fetch single file content (bounded by MAX_FILE_SIZE_KB)
   */
  async getFileContent(owner, repo, filePath, commitSha, maxBytes = 250 * 1024) {
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

      if (res.data.size > maxBytes) {
        return null;
      }

      const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
      return decoded;
    } catch (err) {
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
        status: f.status,
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
      this._handleError(err, `Compare commits ${baseSha}...${headSha}`);
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
      this._handleError(err, `List commits for "${owner}/${repo}"`);
    }
  }
}

export const githubService = new GitHubService();
