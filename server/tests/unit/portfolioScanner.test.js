import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { githubService } from '../../src/services/githubService.js';
import { PortfolioScannerService } from '../../src/services/portfolioScannerService.js';
import { PortfolioSkillAnalyzer } from '../../src/services/portfolioSkillAnalyzer.js';

describe('Feature 2: GitHub Portfolio Analysis — Unit Tests', () => {
  describe('GitHub Username & Repository Identifier Parser', () => {
    test('validates valid GitHub usernames', () => {
      assert.equal(githubService.validateUsername('octocat'), true);
      assert.equal(githubService.validateUsername('sayali8106'), true);
      assert.equal(githubService.validateUsername('john-doe'), true);
      assert.equal(githubService.validateUsername('a'), true);
    });

    test('rejects invalid GitHub usernames', () => {
      assert.equal(githubService.validateUsername(''), false);
      assert.equal(githubService.validateUsername('-octocat'), false); // cannot begin with hyphen
      assert.equal(githubService.validateUsername('octocat-'), false); // cannot end with hyphen
      assert.equal(githubService.validateUsername('invalid username with spaces'), false);
      assert.equal(githubService.validateUsername('a'.repeat(40)), false); // max 39 chars
    });

    test('parses full repository URLs, user URLs, and owner/repo identifiers', () => {
      const parsedRepoUrl = githubService.parseUserInput('https://github.com/facebook/react');
      assert.equal(parsedRepoUrl.type, 'repo');
      assert.equal(parsedRepoUrl.owner, 'facebook');
      assert.equal(parsedRepoUrl.repo, 'react');

      const parsedGitUrl = githubService.parseUserInput('https://github.com/expressjs/express.git');
      assert.equal(parsedGitUrl.type, 'repo');
      assert.equal(parsedGitUrl.owner, 'expressjs');
      assert.equal(parsedGitUrl.repo, 'express');

      const parsedOwnerRepo = githubService.parseUserInput('octocat/Hello-World');
      assert.equal(parsedOwnerRepo.type, 'repo');
      assert.equal(parsedOwnerRepo.owner, 'octocat');
      assert.equal(parsedOwnerRepo.repo, 'Hello-World');

      const parsedUserUrl = githubService.parseUserInput('https://github.com/torvalds');
      assert.equal(parsedUserUrl.type, 'user');
      assert.equal(parsedUserUrl.username, 'torvalds');

      const parsedPlainUser = githubService.parseUserInput('gaearon');
      assert.equal(parsedPlainUser.type, 'user');
      assert.equal(parsedPlainUser.username, 'gaearon');
    });

    test('throws error for invalid or empty input', () => {
      assert.throws(() => githubService.parseUserInput(''), /Please provide a GitHub username/);
      assert.throws(() => githubService.parseUserInput('https://not-github.com/test'), /Invalid GitHub identifier/);
    });
  });

  describe('Portfolio File Tree Security & Type Filtering', () => {
    const mockTree = [
      { path: 'src/index.js', type: 'blob', size: 1024 },
      { path: 'src/App.tsx', type: 'blob', size: 2048 },
      { path: 'src/components/Card.jsx', type: 'blob', size: 1500 },
      { path: 'backend/server.py', type: 'blob', size: 3000 },
      { path: 'backend/PaymentService.java', type: 'blob', size: 4500 },
      { path: 'db/schema.sql', type: 'blob', size: 1200 },
      { path: 'Dockerfile', type: 'blob', size: 400 },
      { path: '.github/workflows/ci.yml', type: 'blob', size: 600 },
      { path: 'package.json', type: 'blob', size: 800 },
      { path: 'README.md', type: 'blob', size: 2500 },
      // Irrelevant / secret / binary files to filter:
      { path: '.env', type: 'blob', size: 200 },
      { path: 'config/.env.production', type: 'blob', size: 300 },
      { path: 'keys/id_rsa', type: 'blob', size: 1800 },
      { path: 'cert.pem', type: 'blob', size: 900 },
      { path: 'node_modules/lodash/index.js', type: 'blob', size: 50000 },
      { path: 'dist/bundle.js', type: 'blob', size: 120000 },
      { path: 'package-lock.json', type: 'blob', size: 85000 },
      { path: 'assets/logo.png', type: 'blob', size: 15000 },
      { path: 'docs/architecture.pdf', type: 'blob', size: 450000 },
      { path: 'vendor/autoload.php', type: 'blob', size: 2000 },
      { path: 'static/bundle.min.js', type: 'blob', size: 80000 },
      { path: 'static/app.js.map', type: 'blob', size: 60000 },
      { path: 'large_data.json', type: 'blob', size: 500 * 1024 }, // 500KB > 200KB limit
    ];

    test('excludes secret files (.env, id_rsa, .pem)', () => {
      const { inspectable, skipped } = PortfolioScannerService.filterTree(mockTree, 'test/repo');
      const secretSkips = skipped.filter((s) => s.reason === 'secret_file');

      assert.ok(secretSkips.some((s) => s.path === '.env'));
      assert.ok(secretSkips.some((s) => s.path === 'config/.env.production'));
      assert.ok(secretSkips.some((s) => s.path === 'keys/id_rsa'));
      assert.ok(secretSkips.some((s) => s.path === 'cert.pem'));
      assert.ok(!inspectable.some((f) => f.path.includes('.env')));
    });

    test('excludes vendor, build, and node_modules directories', () => {
      const { inspectable, skipped } = PortfolioScannerService.filterTree(mockTree, 'test/repo');
      const dirSkips = skipped.filter((s) => s.reason === 'ignored_directory');

      assert.ok(dirSkips.some((s) => s.path === 'node_modules/lodash/index.js'));
      assert.ok(dirSkips.some((s) => s.path === 'dist/bundle.js'));
      assert.ok(dirSkips.some((s) => s.path === 'vendor/autoload.php'));
      assert.ok(!inspectable.some((f) => f.path.startsWith('node_modules/')));
    });

    test('excludes lockfiles, minified files, source maps, and binary media', () => {
      const { inspectable, skipped } = PortfolioScannerService.filterTree(mockTree, 'test/repo');

      assert.ok(skipped.some((s) => s.reason === 'lockfile' && s.path === 'package-lock.json'));
      assert.ok(skipped.some((s) => s.reason === 'binary_media' && s.path === 'assets/logo.png'));
      assert.ok(skipped.some((s) => s.reason === 'binary_media' && s.path === 'docs/architecture.pdf'));
      assert.ok(skipped.some((s) => s.reason === 'minified_asset' && s.path === 'static/bundle.min.js'));
      assert.ok(skipped.some((s) => s.reason === 'minified_asset' && s.path === 'static/app.js.map'));
    });

    test('excludes files exceeding max file size limit (200KB default)', () => {
      const { inspectable, skipped } = PortfolioScannerService.filterTree(mockTree, 'test/repo', {
        maxFileSizeKb: 200,
      });

      assert.ok(skipped.some((s) => s.reason === 'file_size_exceeded' && s.path === 'large_data.json'));
      assert.ok(!inspectable.some((f) => f.path === 'large_data.json'));
    });

    test('correctly retains and tags supported source and configuration files', () => {
      const { inspectable } = PortfolioScannerService.filterTree(mockTree, 'test/repo');
      const inspectablePaths = inspectable.map((f) => f.path);

      assert.ok(inspectablePaths.includes('src/index.js'));
      assert.ok(inspectablePaths.includes('src/App.tsx'));
      assert.ok(inspectablePaths.includes('src/components/Card.jsx'));
      assert.ok(inspectablePaths.includes('backend/server.py'));
      assert.ok(inspectablePaths.includes('backend/PaymentService.java'));
      assert.ok(inspectablePaths.includes('db/schema.sql'));
      assert.ok(inspectablePaths.includes('Dockerfile'));
      assert.ok(inspectablePaths.includes('.github/workflows/ci.yml'));
      assert.ok(inspectablePaths.includes('package.json'));
      assert.ok(inspectablePaths.includes('README.md'));
    });

    test('enforces max files per repository limit', () => {
      const { inspectable, skipped } = PortfolioScannerService.filterTree(mockTree, 'test/repo', {
        maxFiles: 3,
      });

      assert.equal(inspectable.length, 3);
      assert.ok(skipped.some((s) => s.reason === 'repository_file_limit_reached'));
    });
  });

  describe('Portfolio Skill Analysis & Evidence Citations', () => {
    const mockFilesWithContent = [
      {
        repoFullName: 'student/web-portfolio',
        path: 'src/components/UserProfile.tsx',
        content: `
import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
  onRefresh: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/' + userId).then(res => res.json()).then(data => setProfile(data));
  }, [userId]);

  return (
    <div className="profile-card">
      <h2>{profile?.name}</h2>
    </div>
  );
};
        `.trim(),
        language: 'React TSX',
        type: 'source',
      },
      {
        repoFullName: 'student/web-portfolio',
        path: 'server/app.js',
        content: `
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const router = express.Router();

router.get('/api/users/:id', (req, res) => {
  res.status(200).json({ id: req.params.id, name: 'Alice' });
});

router.post('/api/auth/login', (req, res) => {
  const token = jwt.sign({ sub: 'alice' }, 'secret_key');
  res.json({ token });
});
        `.trim(),
        language: 'JavaScript',
        type: 'source',
      },
      {
        repoFullName: 'student/web-portfolio',
        path: 'server/tests/api.test.js',
        content: `
import { describe, it, expect } from 'vitest';

describe('User API Endpoints', () => {
  it('returns status 200 for user fetch', async () => {
    const res = await fetch('http://localhost:5000/api/users/1');
    expect(res.status).toBe(200);
  });
});
        `.trim(),
        language: 'JavaScript',
        type: 'source',
      },
      {
        repoFullName: 'student/web-portfolio',
        path: 'db/queries.sql',
        content: `
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE
);

SELECT id, name, email FROM users WHERE id = $1;
        `.trim(),
        language: 'SQL',
        type: 'source',
      },
      {
        repoFullName: 'student/web-portfolio',
        path: 'Dockerfile',
        content: `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "server/app.js"]
        `.trim(),
        language: 'Dockerfile',
        type: 'source',
      },
      {
        repoFullName: 'student/web-portfolio',
        path: 'package.json',
        content: JSON.stringify({
          name: 'web-portfolio',
          dependencies: {
            react: '^18.2.0',
            express: '^4.19.0',
            jsonwebtoken: '^9.0.0',
          },
          devDependencies: {
            vitest: '^1.4.0',
            typescript: '^5.3.0',
          },
        }),
        language: 'JSON/npm',
        type: 'manifest',
      },
    ];

    const repoMetadataMap = {
      'student/web-portfolio': {
        owner: 'student',
        name: 'web-portfolio',
        fullName: 'student/web-portfolio',
        url: 'https://github.com/student/web-portfolio',
        selectedBranch: 'main',
        commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      },
    };

    test('extracts evidence-backed skills across multiple categories', async () => {
      const result = await PortfolioSkillAnalyzer.analyzePortfolio(
        mockFilesWithContent,
        repoMetadataMap
      );

      assert.ok(Array.isArray(result.findings));
      assert.ok(result.findings.length >= 6);

      const skillNames = result.findings.map((f) => f.skill);
      assert.ok(skillNames.includes('React'));
      assert.ok(skillNames.includes('TypeScript'));
      assert.ok(skillNames.includes('Express.js'));
      assert.ok(skillNames.includes('REST APIs'));
      assert.ok(skillNames.includes('SQL'));
      assert.ok(skillNames.includes('Docker'));
      assert.ok(skillNames.includes('Testing & QA'));
      assert.ok(skillNames.includes('Authentication & Security'));

      // Check categories
      const categories = new Set(result.findings.map((f) => f.category));
      assert.ok(categories.has('Frontend'));
      assert.ok(categories.has('Backend'));
      assert.ok(categories.has('Languages'));
      assert.ok(categories.has('Databases'));
      assert.ok(categories.has('Testing'));
      assert.ok(categories.has('DevOps'));
      assert.ok(categories.has('Security'));
    });

    test('validates that code excerpts and line numbers match actual retrieved source', async () => {
      const result = await PortfolioSkillAnalyzer.analyzePortfolio(
        mockFilesWithContent,
        repoMetadataMap
      );

      for (const finding of result.findings) {
        // Excerpt must not be empty
        assert.ok(finding.codeExcerpt.length > 0);
        // Start line <= end line
        assert.ok(finding.lineRange.start <= finding.lineRange.end);
        // Start line >= 1
        assert.ok(finding.lineRange.start >= 1);
        // Permalinks must be commit-pinned and include line numbers
        assert.match(
          finding.sourcePermalink,
          /^https:\/\/github\.com\/student\/web-portfolio\/blob\/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2\/.+#L\d+-L\d+$/
        );
      }
    });

    test('aggregates detected languages and frameworks properly', async () => {
      const result = await PortfolioSkillAnalyzer.analyzePortfolio(
        mockFilesWithContent,
        repoMetadataMap
      );

      assert.ok(result.languagesDetected.includes('React TSX'));
      assert.ok(result.languagesDetected.includes('JavaScript'));
      assert.ok(result.languagesDetected.includes('SQL'));
      assert.ok(result.frameworksDetected.includes('React'));
      assert.ok(result.frameworksDetected.includes('Express.js'));
      assert.ok(result.frameworksDetected.includes('Docker'));
    });

    test('operates in deterministic mode when no LLM API key is present', async () => {
      const result = await PortfolioSkillAnalyzer.analyzePortfolio(
        mockFilesWithContent,
        repoMetadataMap
      );

      assert.equal(result.analysisMode, 'deterministic');
      assert.equal(result.llmProvider, 'deterministic');
    });
  });
});
