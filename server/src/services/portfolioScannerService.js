import { githubService } from './githubService.js';
import { env } from '../config/env.js';

// Supported code and configuration extensions
const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.tsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sql',
  '.html', '.htm',
  '.css', '.scss', '.sass', '.less',
  '.json',
  '.yaml', '.yml',
  '.md', '.markdown',
  '.sh', '.bash',
]);

const SUPPORTED_EXACT_FILENAMES = new Set([
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'makefile',
  'cmakelists.txt',
  'gemfile',
  'readme',
  'readme.md',
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'go.mod',
  'cargo.toml',
  'composer.json',
  'tsconfig.json',
]);

// Binary & media file extensions to exclude
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.class', '.jar', '.war', '.ear',
  '.pyc', '.pyo', '.pyd',
  '.wasm',
  '.mp3', '.mp4', '.avi', '.mov', '.webm',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
]);

// Secret and credential patterns to exclude strictly
const SECRET_REGEX = /(^\.env|\.env\.|\.pem$|\.key$|id_rsa|_rsa$|credentials|secret|token|\.pfx$|\.keystore$)/i;

// Ignored/Vendor directories
const IGNORED_DIRS = [
  'node_modules/',
  'vendor/',
  'dist/',
  'build/',
  '.git/',
  'coverage/',
  '.next/',
  '.nuxt/',
  'out/',
  'target/',
  'bin/',
  'obj/',
  'venv/',
  '.venv/',
  'env/',
  '__pycache__/',
  '.turbo/',
  '.cache/',
];

// Lockfile patterns
const LOCKFILE_REGEX = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|cargo\.lock|poetry\.lock|composer\.lock)$/i;

// Minified assets
const MINIFIED_REGEX = /(\.min\.(js|css)$|\.map$|\.bundle\.(js|css)$)/i;

export class PortfolioScannerService {
  /**
   * Determine file language from extension or filename
   */
  static detectLanguage(filePath) {
    const lower = filePath.toLowerCase();
    const base = lower.split('/').pop();

    if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'Dockerfile';
    if (base === 'docker-compose.yml' || base === 'docker-compose.yaml') return 'Docker';
    if (base === 'package.json') return 'JSON/npm';
    if (base === 'requirements.txt' || base === 'pyproject.toml') return 'Python Dependency';
    if (base === 'pom.xml' || base === 'build.gradle') return 'Java Build';
    if (base === 'go.mod') return 'Go Module';
    if (base === 'cargo.toml') return 'Rust Cargo';

    if (lower.endsWith('.jsx')) return 'React JSX';
    if (lower.endsWith('.tsx')) return 'React TSX';
    if (lower.endsWith('.ts')) return 'TypeScript';
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'JavaScript';
    if (lower.endsWith('.py')) return 'Python';
    if (lower.endsWith('.java')) return 'Java';
    if (lower.endsWith('.go')) return 'Go';
    if (lower.endsWith('.rs')) return 'Rust';
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'C++';
    if (lower.endsWith('.c') || lower.endsWith('.h')) return 'C';
    if (lower.endsWith('.cs')) return 'C#';
    if (lower.endsWith('.rb')) return 'Ruby';
    if (lower.endsWith('.php')) return 'PHP';
    if (lower.endsWith('.sql')) return 'SQL';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'HTML';
    if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'CSS';
    if (lower.endsWith('.json')) return 'JSON';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'YAML';
    if (lower.endsWith('.md')) return 'Markdown';
    if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'Shell';

    return 'Text';
  }

  /**
   * Filter repository tree items and classify them as inspectable or skipped with explicit reasons.
   */
  static filterTree(treeItems, repoFullName, limits = {}) {
    const maxFiles = limits.maxFiles || env.MAX_FILES_PER_REPOSITORY || 100;
    const maxFileSize = (limits.maxFileSizeKb || env.MAX_FILE_SIZE_KB || 200) * 1024;

    const inspectable = [];
    const skipped = [];

    for (const item of treeItems) {
      if (item.type !== 'blob') continue; // only process blobs (files)

      const path = item.path;
      const lower = path.toLowerCase();
      const base = lower.split('/').pop();
      const size = item.size || 0;

      // 1. Check for secret files
      if (SECRET_REGEX.test(base) || SECRET_REGEX.test(lower)) {
        skipped.push({ repoFullName, path, reason: 'secret_file', size });
        continue;
      }

      // 2. Check for ignored/vendor directories
      const isIgnoredDir = IGNORED_DIRS.some((dir) => lower.includes(dir));
      if (isIgnoredDir) {
        skipped.push({ repoFullName, path, reason: 'ignored_directory', size });
        continue;
      }

      // 3. Check for lockfiles
      if (LOCKFILE_REGEX.test(base)) {
        skipped.push({ repoFullName, path, reason: 'lockfile', size });
        continue;
      }

      // 4. Check for minified / map assets
      if (MINIFIED_REGEX.test(base)) {
        skipped.push({ repoFullName, path, reason: 'minified_asset', size });
        continue;
      }

      // 5. Check for binary / media extensions
      const extMatch = lower.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : '';
      if (BINARY_EXTENSIONS.has(ext)) {
        skipped.push({ repoFullName, path, reason: 'binary_media', size });
        continue;
      }

      // 6. Check if supported code or manifest file
      const isSupportedCode = CODE_EXTENSIONS.has(ext);
      const isSupportedExact = SUPPORTED_EXACT_FILENAMES.has(base);
      const isWorkflow = lower.startsWith('.github/workflows/') && (ext === '.yml' || ext === '.yaml');

      if (!isSupportedCode && !isSupportedExact && !isWorkflow) {
        skipped.push({ repoFullName, path, reason: 'unsupported_type', size });
        continue;
      }

      // 7. Check individual file size limit
      if (size > maxFileSize) {
        skipped.push({ repoFullName, path, reason: 'file_size_exceeded', size });
        continue;
      }

      // 8. Enforce max files limit
      if (inspectable.length >= maxFiles) {
        skipped.push({ repoFullName, path, reason: 'repository_file_limit_reached', size });
        continue;
      }

      inspectable.push({
        repoFullName,
        path,
        size,
        language: this.detectLanguage(path),
        type: isWorkflow
          ? 'workflow'
          : isSupportedExact
          ? 'manifest'
          : ext === '.md'
          ? 'documentation'
          : 'source',
      });
    }

    return { inspectable, skipped };
  }

  /**
   * Concurrently retrieve file contents up to a total scan byte limit
   */
  static async retrieveFileContents(owner, repo, commitSha, inspectableFiles, onProgress) {
    const maxTotalBytes = (env.MAX_TOTAL_SCAN_SIZE_MB || 10) * 1024 * 1024;
    const maxFileSize = (env.MAX_FILE_SIZE_KB || 200) * 1024;

    const results = [];
    let totalBytesRetrieved = 0;
    const concurrency = 3;

    for (let i = 0; i < inspectableFiles.length; i += concurrency) {
      if (totalBytesRetrieved >= maxTotalBytes) {
        break;
      }

      const chunk = inspectableFiles.slice(i, i + concurrency);
      const promises = chunk.map(async (file) => {
        try {
          const content = await githubService.getFileContent(
            owner,
            repo,
            file.path,
            commitSha,
            maxFileSize
          );

          if (content !== null && typeof content === 'string') {
            const byteLength = Buffer.byteLength(content, 'utf8');
            return {
              ...file,
              content,
              actualSize: byteLength,
            };
          }
          return null;
        } catch (err) {
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      for (const item of chunkResults) {
        if (item) {
          results.push(item);
          totalBytesRetrieved += item.actualSize;
          if (onProgress) {
            onProgress({
              processedCount: results.length,
              totalCount: inspectableFiles.length,
              currentFile: item.path,
            });
          }
        }
      }
    }

    return results;
  }
}
