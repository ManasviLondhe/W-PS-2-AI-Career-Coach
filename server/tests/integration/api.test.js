import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { Job, Repository, Assessment } from '../../src/models/index.js';

describe('SkillProof AI — Backend API Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDatabase();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  });

  test('GET /api/health returns healthy service status without leaking secrets', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.status, 'healthy');
    assert.ok(body.database);
    assert.equal(typeof body.database.connected, 'boolean');
    assert.ok(body.githubRateLimit);
    assert.ok(body.llm);
    // Secrets must NOT be returned
    assert.equal(body.llm.apiKey, undefined);
    assert.equal(body.mongodbUri, undefined);
  });

  test('POST /api/jobs/import imports a pasted job description and extracts skills', async () => {
    const payload = {
      type: 'pasted',
      title: 'Full Stack Engineer',
      employer: 'Acme Systems',
      description: 'Requirements: Java, SQL, REST APIs, Git. Preferred: Docker.',
      requiredSkills: ['Java', 'SQL', 'REST APIs', 'Git'],
      preferredSkills: ['Docker'],
    };

    const res = await fetch(`${baseUrl}/jobs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.success);
    assert.equal(body.data.title, 'Full Stack Engineer');
    assert.equal(body.data.employer, 'Acme Systems');
    assert.ok(body.data.requiredSkills.includes('Java'));
    assert.ok(body.data.requiredSkills.includes('SQL'));
  });

  test('GET /api/jobs lists stored jobs with pagination', async () => {
    const res = await fetch(`${baseUrl}/jobs`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(Array.isArray(body.data.jobs));
    assert.ok(body.data.jobs.length >= 1);
  });

  test('POST /api/repositories/track tracks a public GitHub repository', async () => {
    const res = await fetch(`${baseUrl}/repositories/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'octocat/Hello-World' }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.success);
    assert.equal(body.data.fullName, 'octocat/Hello-World');
    assert.equal(body.data.trackingState, 'active');
  });

  test('GET /api/repositories lists tracked repositories', async () => {
    const res = await fetch(`${baseUrl}/repositories`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('GET /api/activity returns real event audit stream', async () => {
    const res = await fetch(`${baseUrl}/activity`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(Array.isArray(body.data.changeEvents));
    assert.ok(Array.isArray(body.data.recentAssessments));
  });
});
