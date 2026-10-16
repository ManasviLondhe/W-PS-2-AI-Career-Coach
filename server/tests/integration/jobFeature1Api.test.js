import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { Job } from '../../src/models/Job.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';

let serverInstance;
let baseUrl;

describe('Feature 1 Integration Tests — End-to-End Job Ingestion & Management API', () => {
  before(async () => {
    await connectDatabase();
    await new Promise((resolve) => {
      serverInstance = app.listen(0, () => {
        const port = serverInstance.address().port;
        baseUrl = `http://localhost:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await disconnectDatabase();
  });

  // 1. Analyze-Text Preview
  test('POST /api/jobs/analyze-text analyzes user-pasted text without saving immediately', async () => {
    const res = await fetch(`${baseUrl}/jobs/analyze-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `
We are looking for a Backend Engineer.
Requirements:
- Must have experience with Java and SQL databases.
- Automated Testing experience.
Nice to have:
- Docker containerization.
        `.trim(),
        title: 'Backend Engineer',
        employer: 'Stripe',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Backend Engineer');
    assert.equal(body.data.employer, 'Stripe');
    assert.ok(body.data.requiredSkills.includes('Java'));
    assert.ok(body.data.requiredSkills.includes('SQL'));
    assert.ok(body.data.preferredSkills.includes('Docker'));
    assert.equal(body.data.sourceType, 'pasted');
    assert.equal(body.data.sourceVerificationState, 'unverified_pasted');
  });

  // 2. SSRF Protection on Analyze-URL
  test('POST /api/jobs/analyze-url rejects loopback and private destinations', async () => {
    const res = await fetch(`${baseUrl}/jobs/analyze-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'http://127.0.0.1:8080/internal',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error.message, /private or loopback/i);
  });

  // 3. Import and Save Job
  let createdJobId;
  test('POST /api/jobs/import creates and persists a new job requirement', async () => {
    const res = await fetch(`${baseUrl}/jobs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pasted',
        title: 'Full Stack Engineer - Intern',
        employer: 'Figma',
        location: 'San Francisco, CA (Hybrid)',
        employmentType: 'Internship',
        description: `
Responsibilities:
- Build collaborative UI design canvas tools.
Requirements:
- Strong proficiency in React, TypeScript, and Node.js.
- Strong automated Testing fundamentals.
Preferred Qualifications:
- Experience with Docker and CI/CD pipelines.
        `.trim(),
        sourceUrl: 'https://figma.com/careers/full-stack-intern',
        requiredSkills: ['React', 'TypeScript', 'Node.js', 'Testing'],
        preferredSkills: ['Docker', 'CI/CD'],
        normalizedRequirements: [
          { name: 'React', category: 'Frontend', importance: 'required', isRequired: true, source_excerpt: 'Strong proficiency in React' },
          { name: 'TypeScript', category: 'Languages', importance: 'required', isRequired: true, source_excerpt: 'TypeScript' },
          { name: 'Node.js', category: 'Backend', importance: 'required', isRequired: true, source_excerpt: 'Node.js' },
          { name: 'Testing', category: 'QA', importance: 'required', isRequired: true, source_excerpt: 'automated Testing' },
          { name: 'Docker', category: 'DevOps', importance: 'preferred', isRequired: false, source_excerpt: 'Docker and CI/CD' },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    assert.equal(body.data.title, 'Full Stack Engineer - Intern');
    assert.equal(body.data.employer, 'Figma');
    assert.equal(body.data.location, 'San Francisco, CA (Hybrid)');
    assert.equal(body.data.employmentType, 'Internship');
    assert.equal(body.data.requiredSkills.length, 4);
    assert.equal(body.data.preferredSkills.length, 2);
    createdJobId = body.data._id;
  });

  // 4. Retrieve by ID
  test('GET /api/jobs/:id retrieves the persisted job with full metadata', async () => {
    const res = await fetch(`${baseUrl}/jobs/${createdJobId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data._id, createdJobId);
    assert.equal(body.data.employer, 'Figma');
    assert.ok(body.data.normalizedRequirements.length > 0);
  });

  // 5. Update / Edit Job Requirements
  test('PUT /api/jobs/:id updates job title, employer, and modifies skill requirements', async () => {
    const res = await fetch(`${baseUrl}/jobs/${createdJobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Senior Full Stack Engineer',
        location: 'Remote',
        requiredSkills: ['React', 'TypeScript', 'Node.js', 'Testing', 'GraphQL'],
        normalizedRequirements: [
          { name: 'React', category: 'Frontend', importance: 'required', isRequired: true },
          { name: 'TypeScript', category: 'Languages', importance: 'required', isRequired: true },
          { name: 'Node.js', category: 'Backend', importance: 'required', isRequired: true },
          { name: 'Testing', category: 'QA', importance: 'required', isRequired: true },
          { name: 'GraphQL', category: 'Architecture', importance: 'required', isRequired: true },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Senior Full Stack Engineer');
    assert.equal(body.data.location, 'Remote');
    assert.ok(body.data.requiredSkills.includes('GraphQL'));
  });

  // 6. Retry / Re-extract Analysis
  test('POST /api/jobs/:id/retry-analysis re-extracts skills from description', async () => {
    const res = await fetch(`${baseUrl}/jobs/${createdJobId}/retry-analysis`, {
      method: 'POST',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.extractionStatus, 'completed');
    assert.ok(body.data.requiredSkills.includes('React'));
  });

  // 7. List and Search Jobs
  test('GET /api/jobs supports search query and pagination', async () => {
    const searchRes = await fetch(`${baseUrl}/jobs?search=Figma`);
    assert.equal(searchRes.status, 200);
    const body = await searchRes.json();
    assert.equal(body.success, true);
    assert.ok(body.data.jobs.length >= 1);
    assert.ok(body.data.jobs.some((j) => j.employer === 'Figma'));
  });

  // 8. Error Case: Missing ID
  test('GET /api/jobs/:id returns 404 for non-existent ID', async () => {
    const res = await fetch(`${baseUrl}/jobs/000000000000000000000000`);
    assert.equal(res.status, 404);
  });
});
