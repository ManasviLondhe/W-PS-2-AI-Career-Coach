import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeUrl, validateRedirectUrl } from '../../src/utils/ssrfProtection.js';
import { extractJobFromHtml } from '../../src/utils/htmlExtractor.js';
import { JobExtractionService } from '../../src/services/jobExtractionService.js';
import { normalizeSkillName } from '../../src/services/skillDictionary.js';

describe('Feature 1 Unit Tests — Ingestion, SSRF & Skill Extraction', () => {
  // 1. SSRF & URL Validation
  test('rejects loopback, private IPv4, link-local, and IPv6 destinations', () => {
    assert.throws(() => validateSafeUrl('http://localhost:5000/api'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://127.0.0.1:3000'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://10.0.0.1/admin'), /private IP/i);
    assert.throws(() => validateSafeUrl('http://192.168.1.1/router'), /private IP/i);
    assert.throws(() => validateSafeUrl('http://172.16.0.5/api'), /private IP/i);
    assert.throws(() => validateSafeUrl('http://169.254.169.254/latest/meta-data'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://[::1]:8080'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://subdomain.localhost'), /private or loopback/i);
  });

  test('rejects invalid or non-HTTP protocols', () => {
    assert.throws(() => validateSafeUrl('ftp://files.example.com/job'), /HTTP and HTTPS protocols/i);
    assert.throws(() => validateSafeUrl('file:///etc/passwd'), /HTTP and HTTPS protocols/i);
    assert.throws(() => validateSafeUrl('javascript:alert(1)'), /HTTP and HTTPS protocols/i);
    assert.throws(() => validateSafeUrl(''), /Invalid URL/i);
  });

  test('validates safe public HTTPS URLs', () => {
    const url = validateSafeUrl('https://boards.greenhouse.io/stripe/jobs/4567');
    assert.equal(url.hostname, 'boards.greenhouse.io');
    assert.equal(url.protocol, 'https:');
  });

  test('validates redirect destination against SSRF', () => {
    const base = 'https://example.com/careers/job1';
    // Safe relative redirect
    const safeRel = validateRedirectUrl('/jobs/job2', base);
    assert.equal(safeRel.href, 'https://example.com/jobs/job2');

    // Unsafe redirect to internal network must throw
    assert.throws(() => validateRedirectUrl('http://127.0.0.1:8080/admin', base), /private or loopback/i);
    assert.throws(() => validateRedirectUrl('http://169.254.169.254/secret', base), /private or loopback/i);
  });

  // 2. HTML Metadata & Text Parsing
  test('extracts title, employer, and clean text from raw HTML', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Backend Engineer - Payments | Stripe Careers</title>
          <meta property="og:title" content="Senior Backend Engineer - Payments" />
          <meta property="og:site_name" content="Stripe" />
        </head>
        <body>
          <nav><a href="/">Home</a><a href="/jobs">Jobs</a></nav>
          <h1>Senior Backend Engineer - Payments</h1>
          <p>Location: San Francisco, CA (Hybrid)</p>
          <h2>Requirements</h2>
          <ul>
            <li>Strong experience with Java and Spring Boot.</li>
            <li>Proficiency in SQL and relational database modeling.</li>
          </ul>
          <h2>Nice to Have</h2>
          <ul>
            <li>Experience with Docker and Kubernetes.</li>
          </ul>
          <footer>Copyright 2026 Stripe</footer>
          <script>console.log("tracking code");</script>
        </body>
      </html>
    `;

    const parsed = extractJobFromHtml(sampleHtml, 'https://stripe.com/jobs/123');
    assert.equal(parsed.title, 'Senior Backend Engineer - Payments');
    assert.equal(parsed.employer, 'Stripe');
    assert.ok(parsed.description.includes('Java and Spring Boot'));
    assert.ok(parsed.description.includes('SQL and relational database'));
    // Scripts and nav must be stripped
    assert.ok(!parsed.description.includes('tracking code'));
    assert.ok(!parsed.description.includes('Copyright 2026 Stripe'));
  });

  // 3. Requirement Extraction & Skill Categorization
  test('separates required and preferred skills and extracts grounded excerpts', async () => {
    const text = `
About Stripe:
We are looking for a Software Engineer to join our Payment Infrastructure team.

Required Qualifications:
- 3+ years experience with Java or Python in production systems.
- Deep expertise in relational database design with SQL (PostgreSQL, MySQL).
- Proven track record building secure REST APIs.
- Automated testing experience with unit and integration tests.

Preferred Qualifications / Nice to Have:
- Hands-on experience with Docker containerization and CI/CD pipelines.
- Familiarity with MongoDB or NoSQL storage engines.
    `.trim();

    const result = await JobExtractionService.extractRequirements({
      text,
      initialTitle: 'Software Engineer',
      initialEmployer: 'Stripe',
    });

    assert.equal(result.title, 'Software Engineer');
    assert.equal(result.employer, 'Stripe');

    // Required skills
    assert.ok(result.requiredSkills.includes('Java'));
    assert.ok(result.requiredSkills.includes('SQL'));
    assert.ok(result.requiredSkills.includes('REST APIs'));
    assert.ok(result.requiredSkills.includes('Testing'));

    // Preferred skills
    assert.ok(result.preferredSkills.includes('Docker'));
    assert.ok(result.preferredSkills.includes('CI/CD'));
    assert.ok(result.preferredSkills.includes('MongoDB'));

    // Check that preferred skill is not in required
    assert.ok(!result.requiredSkills.includes('Docker'));
    assert.ok(!result.requiredSkills.includes('MongoDB'));

    // Check grounded source excerpts
    const sqlReq = result.normalizedRequirements.find((r) => r.name === 'SQL');
    assert.ok(sqlReq);
    assert.equal(sqlReq.importance, 'required');
    assert.ok(sqlReq.source_excerpt.includes('relational database design with SQL'));

    const dockerReq = result.normalizedRequirements.find((r) => r.name === 'Docker');
    assert.ok(dockerReq);
    assert.equal(dockerReq.importance, 'preferred');
    assert.ok(dockerReq.source_excerpt.includes('Docker containerization'));
  });

  test('normalizes skill aliases and eliminates duplicates', () => {
    assert.equal(normalizeSkillName('react.js'), 'React');
    assert.equal(normalizeSkillName('POSTGRESQL'), 'SQL');
    assert.equal(normalizeSkillName('golang'), 'golang');
    assert.equal(normalizeSkillName('spring boot'), 'Java');
  });

  test('deterministic fallback works cleanly when no LLM key is configured', async () => {
    const text = `
Role: Frontend Developer
Requirements:
- Strong skills in React, TypeScript, and modern JavaScript.
Preferred:
- Experience with Docker.
    `.trim();

    const result = await JobExtractionService.extractRequirements({ text });
    assert.equal(result.extractionMode, 'deterministic');
    assert.ok(result.requiredSkills.includes('React'));
    assert.ok(result.requiredSkills.includes('TypeScript'));
    assert.ok(result.preferredSkills.includes('Docker'));
    assert.ok(result.limitations.includes('deterministic rule-based'));
  });
});
