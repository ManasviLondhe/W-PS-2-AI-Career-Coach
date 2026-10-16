import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { PortfolioScan, Repository, Evidence } from '../../src/models/index.js';
import { githubService } from '../../src/services/githubService.js';

describe('Feature 2: GitHub Portfolio Analysis — API Integration Tests', () => {
  let server;
  let baseUrl;

  // Stored original methods for restoration
  let originalGetUser;
  let originalGetUserRepos;
  let originalGetRepo;
  let originalGetCommit;
  let originalGetBranches;
  let originalGetRawTree;
  let originalGetContent;

  before(async () => {
    await connectDatabase();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/github`;
        resolve();
      });
    });

    originalGetUser = githubService.getUser;
    originalGetUserRepos = githubService.getUserRepos;
    originalGetRepo = githubService.getRepository;
    originalGetCommit = githubService.getLatestCommitSha;
    originalGetBranches = githubService.getRepoBranches;
    originalGetRawTree = githubService.getRawFileTree;
    originalGetContent = githubService.getFileContent;
  });

  after(async () => {
    githubService.getUser = originalGetUser;
    githubService.getUserRepos = originalGetUserRepos;
    githubService.getRepository = originalGetRepo;
    githubService.getLatestCommitSha = originalGetCommit;
    githubService.getRepoBranches = originalGetBranches;
    githubService.getRawFileTree = originalGetRawTree;
    githubService.getFileContent = originalGetContent;

    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  });

  test('GET /api/github/users/:username retrieves verified user profile', async () => {
    githubService.getUser = async (username) => ({
      login: username,
      name: 'Alice Developer',
      avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      bio: 'Full stack engineer building distributed systems',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      blog: 'https://alicedev.io',
      publicRepos: 18,
      followers: 120,
      following: 45,
      htmlUrl: `https://github.com/${username}`,
      createdAt: '2020-01-15T00:00:00Z',
    });

    const res = await fetch(`${baseUrl}/users/alicedev`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.login, 'alicedev');
    assert.equal(body.data.name, 'Alice Developer');
    assert.equal(body.data.publicRepos, 18);
    assert.equal(body.data.company, 'Tech Corp');
  });

  test('GET /api/github/users/:username/repos lists public repositories with keyword search', async () => {
    githubService.getUserRepos = async (username) => [
      {
        id: 101,
        name: 'payment-service',
        fullName: `${username}/payment-service`,
        owner: username,
        description: 'Microservice with Java and PostgreSQL',
        url: `https://github.com/${username}/payment-service`,
        defaultBranch: 'main',
        stars: 12,
        forks: 3,
        language: 'Java',
        isFork: false,
        isPrivate: false,
        updatedAt: '2026-03-01T12:00:00Z',
      },
      {
        id: 102,
        name: 'frontend-dashboard',
        fullName: `${username}/frontend-dashboard`,
        owner: username,
        description: 'React, TypeScript and Tailwind analytics dashboard',
        url: `https://github.com/${username}/frontend-dashboard`,
        defaultBranch: 'main',
        stars: 35,
        forks: 8,
        language: 'TypeScript',
        isFork: false,
        isPrivate: false,
        updatedAt: '2026-03-10T12:00:00Z',
      },
    ];

    // Request all
    const resAll = await fetch(`${baseUrl}/users/alicedev/repos`);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.success, true);
    assert.equal(bodyAll.data.repos.length, 2);

    // Request with search filter for 'React'
    const resSearch = await fetch(`${baseUrl}/users/alicedev/repos?search=React`);
    assert.equal(resSearch.status, 200);
    const bodySearch = await resSearch.json();
    assert.equal(bodySearch.data.repos.length, 1);
    assert.equal(bodySearch.data.repos[0].name, 'frontend-dashboard');
  });

  test('GET /api/github/repos/:owner/:repo/branches lists branches with commit SHAs', async () => {
    githubService.getRepoBranches = async () => [
      { name: 'main', commitSha: '1111111111111111111111111111111111111111', isProtected: true },
      { name: 'develop', commitSha: '2222222222222222222222222222222222222222', isProtected: false },
    ];

    const res = await fetch(`${baseUrl}/repos/alicedev/payment-service/branches`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].name, 'main');
    assert.equal(body.data[0].commitSha, '1111111111111111111111111111111111111111');
  });

  test('POST /api/github/scan initiates full scan and persists verified findings in MongoDB', async () => {
    const commitSha = '9999999999999999999999999999999999999999';

    githubService.getRepository = async (owner, repo) => ({
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      defaultBranch: 'main',
      stars: 42,
      description: 'Production-ready service portfolio',
      language: 'TypeScript',
      isPrivate: false,
    });

    githubService.getLatestCommitSha = async () => ({
      sha: commitSha,
      message: 'feat: add database schema, Express router, and React client',
      author: 'Alice Developer',
      date: new Date().toISOString(),
    });

    githubService.getRawFileTree = async () => [
      { path: 'src/App.tsx', type: 'blob', size: 1200 },
      { path: 'src/server.ts', type: 'blob', size: 1800 },
      { path: 'db/schema.sql', type: 'blob', size: 900 },
      { path: 'Dockerfile', type: 'blob', size: 400 },
      { path: '.env', type: 'blob', size: 200 }, // must be skipped
      { path: 'package-lock.json', type: 'blob', size: 25000 }, // must be skipped
    ];

    githubService.getFileContent = async (owner, r, path) => {
      if (path === 'src/App.tsx') {
        return `
import React, { useState } from 'react';
export function App() {
  const [data, setData] = useState([]);
  return <div><h1>Portfolio</h1></div>;
}
        `.trim();
      }
      if (path === 'src/server.ts') {
        return `
import express from 'express';
const app = express();
app.get('/api/health', (req, res) => res.status(200).json({ ok: true }));
        `.trim();
      }
      if (path === 'db/schema.sql') {
        return `
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  action VARCHAR(50) NOT NULL
);
SELECT id, action FROM audit_logs WHERE id = $1;
        `.trim();
      }
      if (path === 'Dockerfile') {
        return 'FROM node:20\nWORKDIR /app\nCOPY . .\nCMD ["node", "src/server.js"]';
      }
      return null;
    };

    // Run synchronous scan for immediate assertion
    const res = await fetch(`${baseUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alicedev',
        repositories: [{ owner: 'alicedev', repo: 'payment-service', branch: 'main' }],
        runAsync: false,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.scanId);
    assert.equal(body.data.status, 'completed');

    // Verify inspected vs skipped files
    assert.equal(body.data.inspectedFiles.length, 4);
    assert.ok(body.data.skippedFiles.some((s) => s.reason === 'secret_file' && s.path === '.env'));
    assert.ok(body.data.skippedFiles.some((s) => s.reason === 'lockfile' && s.path === 'package-lock.json'));

    // Verify findings were extracted
    assert.ok(body.data.findings.length >= 4);
    const skills = body.data.findings.map((f) => f.skill);
    assert.ok(skills.includes('React'));
    assert.ok(skills.includes('Express.js'));
    assert.ok(skills.includes('SQL'));
    assert.ok(skills.includes('Docker'));

    // Check line-pinned permalinks
    for (const finding of body.data.findings) {
      assert.ok(finding.sourcePermalink.includes(commitSha));
      assert.match(finding.sourcePermalink, /#L\d+-L\d+$/);
    }

    // Verify persistence in MongoDB
    const persisted = await PortfolioScan.findOne({ scanId: body.data.scanId });
    assert.ok(persisted);
    assert.equal(persisted.status, 'completed');
    assert.equal(persisted.findings.length, body.data.findings.length);

    // Verify snapshot query by scanId endpoint
    const resGet = await fetch(`${baseUrl}/scan/${body.data.scanId}`);
    assert.equal(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.data.scanId, body.data.scanId);

    // Verify evidence endpoint
    const resEvidence = await fetch(`${baseUrl}/scan/${body.data.scanId}/evidence`);
    assert.equal(resEvidence.status, 200);
    const bodyEvidence = await resEvidence.json();
    assert.ok(bodyEvidence.data.findings.length >= 4);
    assert.ok(bodyEvidence.data.scopeStatement);

    // Verify history endpoint for repository
    const resHistory = await fetch(`${baseUrl}/repos/alicedev/payment-service/history`);
    assert.equal(resHistory.status, 200);
    const bodyHistory = await resHistory.json();
    assert.ok(bodyHistory.data.length >= 1);
    assert.equal(bodyHistory.data[0].scanId, body.data.scanId);
  });
});
