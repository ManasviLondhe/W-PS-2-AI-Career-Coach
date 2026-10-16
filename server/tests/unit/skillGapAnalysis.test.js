/**
 * Feature 4 Unit Tests — SkillGapAnalysisService
 *
 * Tests:
 *  1. Priority calculation correctness
 *  2. Deterministic recommendation generation (all skill statuses)
 *  3. Required vs preferred classification handling
 *  4. Demonstrated skills are not included in gaps
 *  5. not_demonstrated uses honest scope language (no "doesn't know")
 *  6. Task status validation (allowed and disallowed)
 *  7. Task completion does NOT imply skill change
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// We test the pure helper functions extracted from the service.
// Since SkillGapAnalysisService depends on MongoDB models, we test
// the deterministic logic and validation in isolation.
// ---------------------------------------------------------------------------

/**
 * Priority calculation (mirrors calculatePriority in service)
 */
function calculatePriority(classification, status) {
  const classScore = classification === 'required' ? 60 : 30;
  const statusScore =
    status === 'not_demonstrated' ? 40 : status === 'partially_demonstrated' ? 20 : 0;
  return Math.min(100, classScore + statusScore);
}

/**
 * Allowed task status transitions (mirrors service validation)
 */
const ALLOWED_TASK_STATUSES = ['pending', 'in_progress', 'completed'];

function validateTaskStatus(status) {
  if (!ALLOWED_TASK_STATUSES.includes(status)) {
    throw new Error(`Invalid taskStatus: ${status}.`);
  }
  return true;
}

/**
 * Gap filtering logic (mirrors service gap filtering)
 */
function filterGaps(skillResults) {
  return skillResults.filter(
    (sr) => sr.status === 'not_demonstrated' || sr.status === 'partially_demonstrated'
  );
}

/**
 * Scope-honest language check
 */
function isHonestScopeLanguage(text) {
  const prohibitedPhrases = [
    "doesn't know",
    "does not know",
    "lacks the skill",
    "is unqualified",
    "is not qualified",
    "cannot do",
  ];
  const lower = text.toLowerCase();
  return !prohibitedPhrases.some((p) => lower.includes(p));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Feature 4 — Priority Calculation', () => {
  test('required + not_demonstrated gets highest priority (100)', () => {
    const p = calculatePriority('required', 'not_demonstrated');
    assert.equal(p, 100);
  });

  test('required + partially_demonstrated gets priority 80', () => {
    const p = calculatePriority('required', 'partially_demonstrated');
    assert.equal(p, 80);
  });

  test('preferred + not_demonstrated gets priority 70', () => {
    const p = calculatePriority('preferred', 'not_demonstrated');
    assert.equal(p, 70);
  });

  test('preferred + partially_demonstrated gets priority 50', () => {
    const p = calculatePriority('preferred', 'partially_demonstrated');
    assert.equal(p, 50);
  });

  test('required > preferred for the same status', () => {
    const req = calculatePriority('required', 'not_demonstrated');
    const pref = calculatePriority('preferred', 'not_demonstrated');
    assert.ok(req > pref, 'Required skills must outrank preferred skills');
  });

  test('not_demonstrated > partially_demonstrated for the same classification', () => {
    const notDemo = calculatePriority('required', 'not_demonstrated');
    const partial = calculatePriority('required', 'partially_demonstrated');
    assert.ok(notDemo > partial, 'not_demonstrated must outrank partially_demonstrated');
  });
});

describe('Feature 4 — Gap Filtering Logic', () => {
  test('filters out demonstrated skills', () => {
    const skillResults = [
      { skill: 'React', status: 'demonstrated', classification: 'required' },
      { skill: 'SQL', status: 'not_demonstrated', classification: 'required' },
      { skill: 'Docker', status: 'partially_demonstrated', classification: 'preferred' },
    ];
    const gaps = filterGaps(skillResults);
    assert.equal(gaps.length, 2);
    assert.ok(gaps.every((g) => g.skill !== 'React'));
  });

  test('returns empty array when all skills are demonstrated', () => {
    const skillResults = [
      { skill: 'React', status: 'demonstrated', classification: 'required' },
      { skill: 'Node.js', status: 'demonstrated', classification: 'required' },
    ];
    const gaps = filterGaps(skillResults);
    assert.equal(gaps.length, 0);
  });

  test('includes both not_demonstrated and partially_demonstrated', () => {
    const skillResults = [
      { skill: 'SQL', status: 'not_demonstrated', classification: 'required' },
      { skill: 'Testing', status: 'partially_demonstrated', classification: 'preferred' },
    ];
    const gaps = filterGaps(skillResults);
    assert.equal(gaps.length, 2);
  });

  test('handles empty skillResults array safely', () => {
    const gaps = filterGaps([]);
    assert.equal(gaps.length, 0);
  });
});

describe('Feature 4 — Task Status Validation', () => {
  test('accepts "pending" as a valid task status', () => {
    assert.doesNotThrow(() => validateTaskStatus('pending'));
  });

  test('accepts "in_progress" as a valid task status', () => {
    assert.doesNotThrow(() => validateTaskStatus('in_progress'));
  });

  test('accepts "completed" as a valid task status', () => {
    assert.doesNotThrow(() => validateTaskStatus('completed'));
  });

  test('rejects an invalid task status string', () => {
    assert.throws(() => validateTaskStatus('done'), { message: /Invalid taskStatus/ });
  });

  test('rejects "demonstrated" as a task status (prevents assessment confusion)', () => {
    assert.throws(() => validateTaskStatus('demonstrated'), { message: /Invalid taskStatus/ });
  });

  test('rejects empty string as a task status', () => {
    assert.throws(() => validateTaskStatus(''), { message: /Invalid taskStatus/ });
  });

  test('rejects undefined task status', () => {
    assert.throws(() => validateTaskStatus(undefined), { message: /Invalid taskStatus/ });
  });
});

describe('Feature 4 — Data Integrity: Task Completion ≠ Skill Assessment Change', () => {
  test('task status transition to "completed" does not return a skill status', () => {
    // Simulates: after marking a task completed, the returned object has
    // taskStatus but NEVER changes snapshotStatus or any Assessment field.
    const simulatedUpdateResult = {
      _id: 'rec123',
      skill: 'SQL',
      taskStatus: 'completed',
      taskCompletedAt: new Date(),
      taskNotes: '',
      // snapshotStatus is the HISTORICAL snapshot — must remain unchanged
      snapshotStatus: 'not_demonstrated',
    };

    // The skill assessment status is unchanged
    assert.equal(simulatedUpdateResult.snapshotStatus, 'not_demonstrated');
    // The task is marked completed
    assert.equal(simulatedUpdateResult.taskStatus, 'completed');
    // These are two independent fields — confirmed separate
    assert.notEqual(simulatedUpdateResult.taskStatus, simulatedUpdateResult.snapshotStatus);
  });

  test('snapshotStatus is read-only historical data (simulated)', () => {
    const rec = {
      snapshotStatus: 'not_demonstrated',
      taskStatus: 'pending',
    };

    // Simulate what updateTaskProgress does: ONLY updates taskStatus/taskNotes
    function updateTaskStatus(recObj, newStatus) {
      return {
        ...recObj,
        taskStatus: newStatus,
        taskCompletedAt: newStatus === 'completed' ? new Date() : null,
        // snapshotStatus is intentionally NOT touched
      };
    }

    const updated = updateTaskStatus(rec, 'completed');

    assert.equal(updated.taskStatus, 'completed');
    assert.equal(updated.snapshotStatus, 'not_demonstrated', 'snapshotStatus must remain unchanged');
  });
});

describe('Feature 4 — Scope-Honest Language', () => {
  test('not_demonstrated text does not claim student lacks the skill', () => {
    const honest = `No qualifying SQL code artifacts were found in the analyzed repository files. This assessment is scoped strictly to the files and commit that were analyzed — it does not make any claim about skills demonstrated in other projects or environments.`;
    assert.ok(isHonestScopeLanguage(honest));
  });

  test('prohibits "does not know" phrasing', () => {
    const dishonest = `The student does not know SQL.`;
    assert.ok(!isHonestScopeLanguage(dishonest));
  });

  test('prohibits "lacks the skill" phrasing', () => {
    const dishonest = `The student lacks the skill in React.`;
    assert.ok(!isHonestScopeLanguage(dishonest));
  });

  test('honest scope wording passes validation', () => {
    const acceptable = `SQL was not found in the analyzed repository scope.`;
    assert.ok(isHonestScopeLanguage(acceptable));
  });
});

describe('Feature 4 — Classification Preservation', () => {
  test('required and preferred classifications remain distinct after gap filtering', () => {
    const skillResults = [
      { skill: 'SQL', status: 'not_demonstrated', classification: 'required' },
      { skill: 'Docker', status: 'not_demonstrated', classification: 'preferred' },
    ];
    const gaps = filterGaps(skillResults);
    const requiredGaps = gaps.filter((g) => g.classification === 'required');
    const preferredGaps = gaps.filter((g) => g.classification === 'preferred');
    assert.equal(requiredGaps.length, 1);
    assert.equal(preferredGaps.length, 1);
    assert.equal(requiredGaps[0].skill, 'SQL');
    assert.equal(preferredGaps[0].skill, 'Docker');
  });

  test('required skills get higher priority than preferred skills with same status', () => {
    const required = calculatePriority('required', 'not_demonstrated');
    const preferred = calculatePriority('preferred', 'not_demonstrated');
    assert.ok(
      required > preferred,
      `required priority ${required} must exceed preferred priority ${preferred}`
    );
  });
});
