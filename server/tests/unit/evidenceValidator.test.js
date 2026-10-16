import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidenceItem } from '../../src/services/evidenceValidator.js';

describe('EvidenceValidator — citation integrity checks', () => {
  const repoInfo = {
    owner: 'octocat',
    repo: 'Hello-World',
    commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
  };

  const inspectedFiles = [
    {
      path: 'src/db/queries.sql',
      content: ['CREATE TABLE users (', '  id INT PRIMARY KEY', ');', '', 'SELECT * FROM users WHERE id = $1;'].join('\n'),
    },
  ];

  const validEvidence = {
    evidenceId: 'ev_1234567890abcdef12345678',
    commitSha: repoInfo.commitSha,
    filePath: 'src/db/queries.sql',
    lineRange: { start: 1, end: 5 },
    skill: 'SQL',
    evidenceType: 'schema_query',
    codeExcerpt: inspectedFiles[0].content,
    explanation: 'Relational schema and parameterized query.',
    sourcePermalink:
      'https://github.com/octocat/Hello-World/blob/a1b2c3d4e5f678901234567890abcdef12345678/src/db/queries.sql#L1-L5',
    confidence: 'high',
    limitations: 'Scope limited to inspected file.',
  };

  test('accepts a valid evidence item', () => {
    const result = validateEvidenceItem(validEvidence, inspectedFiles, repoInfo);
    assert.equal(result.filePath, 'src/db/queries.sql');
    assert.equal(result.lineRange.start, 1);
    assert.equal(result.lineRange.end, 5);
  });

  test('rejects a nonexistent file path', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, filePath: 'src/db/missing.sql' },
          inspectedFiles,
          repoInfo
        ),
      /file was not inspected/
    );
  });

  test('rejects a mismatched commit SHA', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, commitSha: 'different-sha' },
          inspectedFiles,
          repoInfo
        ),
      /commit mismatch/
    );
  });

  test('rejects a line range below 1', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, lineRange: { start: 0, end: 5 } },
          inspectedFiles,
          repoInfo
        ),
      /at least 1/
    );
  });

  test('rejects an end line before the start line', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, lineRange: { start: 5, end: 2 } },
          inspectedFiles,
          repoInfo
        ),
      /before the start line/
    );
  });

  test('rejects a range beyond the file length', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, lineRange: { start: 1, end: 99 } },
          inspectedFiles,
          repoInfo
        ),
      /exceeds the inspected file length/
    );
  });

  test('rejects a fabricated code excerpt', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, codeExcerpt: 'SELECT 1;' },
          inspectedFiles,
          repoInfo
        ),
      /does not match inspected source lines/
    );
  });

  test('rejects a permalink that does not match the snapshot', () => {
    assert.throws(
      () =>
        validateEvidenceItem(
          { ...validEvidence, sourcePermalink: 'https://github.com/octocat/Hello-World/blob/other-sha/src/db/queries.sql#L1-L5' },
          inspectedFiles,
          repoInfo
        ),
      /expected repository snapshot/
    );
  });

  test('rejects missing required fields', () => {
    assert.throws(
        () => validateEvidenceItem({ ...validEvidence, evidenceId: '' }, inspectedFiles, repoInfo),
        /Evidence ID is required/
    );
  });

  test('rejects a permalink for another repository', () => {
    assert.throws(
        () =>
          validateEvidenceItem(
            {
              ...validEvidence,
              sourcePermalink: validEvidence.sourcePermalink.replace('octocat/Hello-World', 'other/repository'),
            },
            inspectedFiles,
            repoInfo
          ),
        /expected repository snapshot/
    );
  });
});
