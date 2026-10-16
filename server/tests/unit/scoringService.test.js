import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ScoringService } from '../../src/services/scoringService.js';

describe('ScoringService — Evidence Coverage Calculations', () => {
  test('calculates 100% when all skills are demonstrated', () => {
    const skillAssessments = [
      { skill: 'Java', classification: 'required', status: 'demonstrated' },
      { skill: 'SQL', classification: 'required', status: 'demonstrated' },
      { skill: 'Docker', classification: 'preferred', status: 'demonstrated' },
    ];

    const result = ScoringService.calculateCoverage(skillAssessments);
    assert.equal(result.coverageScore, 100);
    assert.match(result.explanation, /Coverage reflects 100%/);
  });

  test('calculates 0% when no skills are demonstrated in analyzed scope', () => {
    const skillAssessments = [
      { skill: 'Java', classification: 'required', status: 'not_demonstrated' },
      { skill: 'SQL', classification: 'required', status: 'not_demonstrated' },
    ];

    const result = ScoringService.calculateCoverage(skillAssessments);
    assert.equal(result.coverageScore, 0);
  });

  test('weights required skills higher (weight: 2) than preferred skills (weight: 1)', () => {
    // Required skill demonstrated (2 * 1.0 = 2.0)
    // Preferred skill not demonstrated (1 * 0.0 = 0.0)
    // Total weight = 3. Score = (2 / 3) * 100 = 67%
    const skillAssessments = [
      { skill: 'Java', classification: 'required', status: 'demonstrated' },
      { skill: 'Docker', classification: 'preferred', status: 'not_demonstrated' },
    ];

    const result = ScoringService.calculateCoverage(skillAssessments);
    assert.equal(result.coverageScore, 67);
  });

  test('scores partially demonstrated skills at 0.5 evidence weight', () => {
    // Required skill partially demonstrated (2 * 0.5 = 1.0)
    // Total weight = 2. Score = (1.0 / 2.0) * 100 = 50%
    const skillAssessments = [
      { skill: 'Java', classification: 'required', status: 'partially_demonstrated' },
    ];

    const result = ScoringService.calculateCoverage(skillAssessments);
    assert.equal(result.coverageScore, 50);
  });

  test('handles empty skill list safely with 0% coverage', () => {
    const result = ScoringService.calculateCoverage([]);
    assert.equal(result.coverageScore, 0);
  });
});
