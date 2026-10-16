import path from 'node:path';

function normalizeRepoPath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Evidence filePath is required.');
  }

  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/').trim()).replace(/^\.\/+/, '');
  if (
    normalized === '' ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Evidence filePath is invalid: ${filePath}`);
  }

  return normalized;
}

function encodeRepoPath(filePath) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function validateEvidenceItem(evidence, inspectedFiles, repoInfo) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Evidence item is required.');
  }

  const { owner, repo, commitSha } = repoInfo || {};
  if (!owner || !repo || !commitSha) {
    throw new Error('Repository context is required to validate evidence.');
  }

  const normalizedPath = normalizeRepoPath(evidence.filePath);
  const matchedFile = inspectedFiles.find((file) => normalizeRepoPath(file.path) === normalizedPath);

  if (!matchedFile) {
    throw new Error(`Evidence file was not inspected: ${evidence.filePath}`);
  }

  if (evidence.commitSha !== commitSha) {
    throw new Error(`Evidence commit mismatch for ${normalizedPath}`);
  }

  const { lineRange } = evidence;
  const start = Number(lineRange?.start);
  const end = Number(lineRange?.end);

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error(`Evidence line range must use integers: ${normalizedPath}`);
  }
  if (start < 1) {
    throw new Error(`Evidence start line must be at least 1: ${normalizedPath}`);
  }
  if (end < start) {
    throw new Error(`Evidence end line cannot be before the start line: ${normalizedPath}`);
  }

  const fileLines = matchedFile.content.split(/\r?\n/);
  if (end > fileLines.length) {
    throw new Error(`Evidence line range exceeds the inspected file length: ${normalizedPath}`);
  }

  const actualExcerpt = fileLines.slice(start - 1, end).join('\n');
  const claimedExcerpt = typeof evidence.codeExcerpt === 'string' ? evidence.codeExcerpt.replace(/\r\n/g, '\n') : '';

  if (!claimedExcerpt.trim()) {
    throw new Error(`Evidence code excerpt is empty: ${normalizedPath}`);
  }

  if (actualExcerpt !== claimedExcerpt) {
    throw new Error(`Evidence code excerpt does not match inspected source lines: ${normalizedPath}`);
  }

  const expectedPermalink = `https://github.com/${owner}/${repo}/blob/${commitSha}/${encodeRepoPath(normalizedPath)}#L${start}-L${end}`;
  if (evidence.sourcePermalink !== expectedPermalink) {
    throw new Error(`Evidence permalink does not match the expected repository snapshot: ${normalizedPath}`);
  }

  const allowedConfidence = new Set(['high', 'medium', 'low']);
  if (!allowedConfidence.has(evidence.confidence)) {
    throw new Error(`Evidence confidence is invalid: ${normalizedPath}`);
  }

  const allowedTypes = new Set(['implementation', 'schema_query', 'test_behavior', 'configuration', 'workflow']);
  if (!allowedTypes.has(evidence.evidenceType)) {
    throw new Error(`Evidence type is invalid: ${normalizedPath}`);
  }

  if (typeof evidence.skill !== 'string' || evidence.skill.trim() === '') {
    throw new Error(`Evidence skill is required: ${normalizedPath}`);
  }

  if (typeof evidence.evidenceId !== 'string' || evidence.evidenceId.trim() === '') {
    throw new Error(`Evidence ID is required: ${normalizedPath}`);
  }

  return {
    ...evidence,
    filePath: normalizedPath,
    lineRange: { start, end },
    sourcePermalink: expectedPermalink,
  };
}

