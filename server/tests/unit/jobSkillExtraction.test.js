import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSkillsFromText, normalizeSkillName } from '../../src/services/skillDictionary.js';
import { validateSafeUrl } from '../../src/utils/ssrfProtection.js';

describe('Job Skill Extraction & Normalization', () => {
  test('extracts required and preferred skills from job description text', () => {
    const jobText = `
Backend Engineer Role:
Requirements:
- Strong experience with Java and SQL.
- Deep understanding of REST APIs and Git workflows.
- Experience with unit testing.

Preferred Qualifications:
- Familiarity with Docker and CI/CD pipelines.
- Experience with MongoDB.
    `.trim();

    const result = extractSkillsFromText(jobText);
    assert.ok(result.requiredSkills.includes('Java'));
    assert.ok(result.requiredSkills.includes('SQL'));
    assert.ok(result.requiredSkills.includes('REST APIs'));
    assert.ok(result.requiredSkills.includes('Git'));
    assert.ok(result.requiredSkills.includes('Testing'));

    assert.ok(result.preferredSkills.includes('Docker'));
    assert.ok(result.preferredSkills.includes('CI/CD'));
    assert.ok(result.preferredSkills.includes('MongoDB'));
  });

  test('normalizes aliases to canonical names', () => {
    assert.equal(normalizeSkillName('postgres'), 'SQL');
    assert.equal(normalizeSkillName('postgresql'), 'SQL');
    assert.equal(normalizeSkillName('mysql'), 'SQL');
    assert.equal(normalizeSkillName('reactjs'), 'React');
    assert.equal(normalizeSkillName('nodejs'), 'Node.js');
    assert.equal(normalizeSkillName('ts'), 'TypeScript');
    assert.equal(normalizeSkillName('js'), 'JavaScript');
  });

  test('blocks internal/loopback URLs to prevent SSRF', () => {
    assert.throws(() => validateSafeUrl('http://localhost:5000/api'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://127.0.0.1:8080'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('http://169.254.169.254/latest/meta-data'), /private or loopback/i);
    assert.throws(() => validateSafeUrl('ftp://example.com/job'), /HTTP and HTTPS protocols/i);
  });

  test('allows safe external HTTPS URLs', () => {
    const url = validateSafeUrl('https://boards.greenhouse.io/stripe/jobs/12345');
    assert.equal(url.hostname, 'boards.greenhouse.io');
  });
});
