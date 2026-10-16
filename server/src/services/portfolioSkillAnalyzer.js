import crypto from 'crypto';
import { env } from '../config/env.js';

export class PortfolioSkillAnalyzer {
  /**
   * Main entry point to analyze a set of retrieved source files across one or more repositories.
   * @param {Array<{ repoFullName, path, content, language, type }>} filesWithContent
   * @param {Object} repoMetadataMap - Map of repoFullName -> { owner, name, defaultBranch, commitSha, selectedBranch }
   * @returns {Promise<{ findings, skillsSummary, languagesDetected, frameworksDetected, analysisMode, llmProvider }>}
   */
  static async analyzePortfolio(filesWithContent, repoMetadataMap) {
    // 1. Run deterministic rule-based analysis on actual code files
    const deterministicFindings = this._extractDeterministicFindings(filesWithContent, repoMetadataMap);

    // 2. Validate line ranges and code excerpts against actual retrieved file contents
    const verifiedFindings = this._validateEvidenceCitations(deterministicFindings, filesWithContent);

    // 3. Aggregate detected languages and frameworks
    const languagesDetected = this._aggregateLanguages(filesWithContent);
    const frameworksDetected = this._aggregateFrameworks(verifiedFindings);

    // 4. Synthesize skills summary
    const skillsSummary = this._buildSkillsSummary(verifiedFindings);

    // 5. If LLM is configured and requested, augment explanations (while keeping verified line numbers & permalinks intact!)
    let analysisMode = 'deterministic';
    let llmProvider = env.LLM_PROVIDER || 'deterministic';

    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        await this._augmentWithGemini(verifiedFindings, filesWithContent);
        analysisMode = 'llm';
      } catch (err) {
        console.warn(`Gemini portfolio augmentation failed: ${err.message}. Retaining deterministic findings.`);
        analysisMode = 'deterministic';
      }
    } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      try {
        await this._augmentWithOpenAI(verifiedFindings, filesWithContent);
        analysisMode = 'llm';
      } catch (err) {
        console.warn(`OpenAI portfolio augmentation failed: ${err.message}. Retaining deterministic findings.`);
        analysisMode = 'deterministic';
      }
    }

    return {
      findings: verifiedFindings,
      skillsSummary,
      languagesDetected,
      frameworksDetected,
      analysisMode,
      llmProvider: analysisMode === 'llm' ? env.LLM_PROVIDER : 'deterministic',
    };
  }

  /**
   * Validate every finding's line range against actual file content.
   */
  static _validateEvidenceCitations(findings, files) {
    const fileMap = new Map();
    for (const f of files) {
      fileMap.set(`${f.repoFullName}:${f.path}`, f.content);
    }

    const validated = [];
    for (const f of findings) {
      const key = `${f.repoFullName}:${f.filePath}`;
      const content = fileMap.get(key);
      if (!content) continue; // Cited file must exist in retrieved content

      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;

      // Ensure start and end are bounded
      let start = Math.max(1, Math.min(f.lineRange.start, totalLines));
      let end = Math.max(start, Math.min(f.lineRange.end, totalLines));

      // Re-extract excerpt directly from actual lines to guarantee 100% authenticity
      const actualExcerptLines = lines.slice(start - 1, end);
      const safeExcerpt = actualExcerptLines.join('\n').slice(0, 1000); // capped excerpt length

      validated.push({
        ...f,
        lineRange: { start, end },
        codeExcerpt: safeExcerpt,
      });
    }

    return validated;
  }

  /**
   * Deterministic pattern and AST-like extractors
   */
  static _extractDeterministicFindings(files, repoMetaMap) {
    const findings = [];

    for (const file of files) {
      const meta = repoMetaMap[file.repoFullName] || {
        owner: file.repoFullName.split('/')[0],
        name: file.repoFullName.split('/')[1],
        commitSha: 'HEAD',
        selectedBranch: 'main',
      };

      const owner = meta.owner;
      const repo = meta.name;
      const commitSha = meta.commitSha || 'HEAD';
      const lines = file.content.split(/\r?\n/);
      const lowerPath = file.path.toLowerCase();

      // --- 1. Programming Languages ---
      this._detectLanguageImplementations(file, lines, owner, repo, commitSha, findings);

      // --- 2. Frontend Frameworks & UI ---
      this._detectFrontendFrameworks(file, lines, owner, repo, commitSha, findings);

      // --- 3. Backend Frameworks & APIs ---
      this._detectBackendFrameworks(file, lines, owner, repo, commitSha, findings);

      // --- 4. Databases & SQL ---
      this._detectDatabaseImplementations(file, lines, owner, repo, commitSha, findings);

      // --- 5. Authentication & Security ---
      this._detectSecurityAndAuth(file, lines, owner, repo, commitSha, findings);

      // --- 6. Testing & Quality Assurance ---
      this._detectTesting(file, lines, owner, repo, commitSha, findings);

      // --- 7. DevOps & CI/CD ---
      this._detectDevOps(file, lines, owner, repo, commitSha, findings);

      // --- 8. External API Integration ---
      this._detectApiIntegrations(file, lines, owner, repo, commitSha, findings);

      // --- 9. Dependency Manifests ---
      if (lowerPath === 'package.json' || lowerPath === 'requirements.txt' || lowerPath === 'pom.xml' || lowerPath === 'go.mod') {
        this._detectDependencyManifests(file, lines, owner, repo, commitSha, findings);
      }
    }

    return findings;
  }

  // --- Detector: Languages ---
  static _detectLanguageImplementations(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();

    // TypeScript
    if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      for (let i = 0; i < lines.length; i++) {
        if (/\b(interface\s+\w+|type\s+\w+\s*=|enum\s+\w+|<[A-Z]\w+>\()/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'TypeScript',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'TypeScript static typing, custom interface, or generic type definition.',
            confidence: 'high',
            limitations: 'Static type contracts declared in source.',
          }));
          break;
        }
      }
    }

    // JavaScript
    if ((p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs')) && !p.endsWith('.test.js')) {
      for (let i = 0; i < lines.length; i++) {
        if (/async\s+function|const\s+\w+\s*=\s*async|\.then\s*\(|class\s+\w+(\s+extends\s+\w+)?/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'JavaScript',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Modern JavaScript (ES6+) asynchronous patterns or class structure.',
            confidence: 'high',
            limitations: 'Evaluates syntax and execution patterns present in file.',
          }));
          break;
        }
      }
    }

    // Python
    if (p.endsWith('.py')) {
      for (let i = 0; i < lines.length; i++) {
        if (/(def\s+\w+\s*\(|class\s+\w+(\(.*\))?:|import\s+\w+|from\s+\w+\s+import)/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Python',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Python functional definition, class hierarchy, or module architecture.',
            confidence: 'high',
            limitations: 'Demonstrates Python syntax and idiom within file scope.',
          }));
          break;
        }
      }
    }

    // Java
    if (p.endsWith('.java')) {
      for (let i = 0; i < lines.length; i++) {
        if (/public\s+class\s+\w+|public\s+interface\s+\w+|@(Service|RestController|Component|Entity)/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Java',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 7),
            owner, repo, commitSha,
            explanation: 'Java object-oriented class declaration and component architecture.',
            confidence: 'high',
            limitations: 'Java source implementation at commit.',
          }));
          break;
        }
      }
    }

    // Go
    if (p.endsWith('.go')) {
      for (let i = 0; i < lines.length; i++) {
        if (/func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(|package\s+\w+|type\s+\w+\s+struct/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Go',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Go function declaration, struct model, or method receiver.',
            confidence: 'high',
            limitations: 'Go source file implementation.',
          }));
          break;
        }
      }
    }

    // Rust
    if (p.endsWith('.rs')) {
      for (let i = 0; i < lines.length; i++) {
        if (/fn\s+\w+\s*\(|struct\s+\w+|impl\s+(\w+\s+for\s+)?\w+/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Rust',
            category: 'Languages',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Rust function, struct declaration, or trait implementation block.',
            confidence: 'high',
            limitations: 'Rust source code.',
          }));
          break;
        }
      }
    }
  }

  // --- Detector: Frontend Frameworks ---
  static _detectFrontendFrameworks(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();

    // React
    if (p.endsWith('.jsx') || p.endsWith('.tsx') || /(component|view|page|app)\.js$/i.test(p)) {
      for (let i = 0; i < lines.length; i++) {
        if (/\b(useState|useEffect|useContext|useReducer|useCallback|useMemo)\s*\(|(return\s*\(\s*<|<\w+[^>]*>)/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'React',
            category: 'Frontend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 7),
            owner, repo, commitSha,
            explanation: 'React component rendering with hook-based state or lifecycle management.',
            confidence: 'high',
            limitations: 'Client-side UI component implementation.',
          }));
          break;
        }
      }
    }

    // Vue
    if (p.endsWith('.vue')) {
      findings.push(this._createFinding({
        skill: 'Vue.js',
        category: 'Frontend',
        evidenceType: 'implementation',
        repoFullName: `${owner}/${repo}`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, 10),
        owner, repo, commitSha,
        explanation: 'Single-file Vue component template and script lifecycle.',
        confidence: 'high',
        limitations: 'Vue component implementation.',
      }));
    }

    // Tailwind CSS / CSS3
    if (p.endsWith('.css') || p.endsWith('.scss')) {
      for (let i = 0; i < lines.length; i++) {
        if (/@tailwind|@apply|\.[\w-]+\s*\{|var\(--/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: lines[i].includes('tailwind') ? 'Tailwind CSS' : 'CSS3 / Styling',
            category: 'Frontend',
            evidenceType: 'configuration',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Modern CSS stylesheet with custom design tokens or utility classes.',
            confidence: 'medium',
            limitations: 'Styling architecture.',
          }));
          break;
        }
      }
    }
  }

  // --- Detector: Backend Frameworks & APIs ---
  static _detectBackendFrameworks(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();

    // Node.js & Express
    if ((p.endsWith('.js') || p.endsWith('.ts')) && !p.includes('.test.') && !p.includes('.spec.')) {
      for (let i = 0; i < lines.length; i++) {
        if (/\b(express\(\)|app\.(get|post|put|delete|use)\s*\(|router\.(get|post|put|delete)\s*\()/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Express.js',
            category: 'Backend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Express.js routing, middleware chaining, or HTTP handler definition.',
            confidence: 'high',
            limitations: 'Server route declaration.',
          }));

          findings.push(this._createFinding({
            skill: 'REST APIs',
            category: 'Backend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'HTTP RESTful endpoint handler adhering to HTTP method semantics.',
            confidence: 'high',
            limitations: 'Endpoint routing pattern.',
          }));
          break;
        }
      }
    }

    // Python FastAPI / Flask / Django
    if (p.endsWith('.py')) {
      for (let i = 0; i < lines.length; i++) {
        if (/@app\.(get|post|put|delete)|FastAPI\(|Flask\(|urlpatterns\s*=/.test(lines[i])) {
          const framework = lines[i].includes('FastAPI') || lines[i].includes('@app')
            ? 'FastAPI'
            : lines[i].includes('Flask')
            ? 'Flask'
            : 'Django';

          findings.push(this._createFinding({
            skill: framework,
            category: 'Backend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: `${framework} backend route handling and request dispatching.`,
            confidence: 'high',
            limitations: 'Python web framework handler.',
          }));

          findings.push(this._createFinding({
            skill: 'REST APIs',
            category: 'Backend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'REST API route declaration with request decorator.',
            confidence: 'high',
            limitations: 'API routing.',
          }));
          break;
        }
      }
    }

    // Spring Boot (Java)
    if (p.endsWith('.java')) {
      for (let i = 0; i < lines.length; i++) {
        if (/@(RestController|SpringBootApplication|GetMapping|PostMapping|RequestMapping)/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Spring Boot',
            category: 'Backend',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 7),
            owner, repo, commitSha,
            explanation: 'Spring Boot enterprise web controller and REST resource mapping.',
            confidence: 'high',
            limitations: 'Spring service or controller component.',
          }));
          break;
        }
      }
    }
  }

  // --- Detector: Databases & SQL ---
  static _detectDatabaseImplementations(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();

    // SQL queries and schema
    const SQL_REGEX = /\b(SELECT\s+[\s\S]+?\s+FROM|INSERT\s+INTO\s+[\s\S]+?\s+VALUES|UPDATE\s+[\s\S]+?\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i;

    if (p.endsWith('.sql') || /(database|db|dao|query|queries|repository)/i.test(p)) {
      for (let i = 0; i < lines.length; i++) {
        if (SQL_REGEX.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'SQL',
            category: 'Databases',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Relational SQL query or database schema DDL statement.',
            confidence: 'high',
            limitations: 'SQL implementation in database access layer.',
          }));
          break;
        }
      }
    }

    // MongoDB / Mongoose
    if (p.endsWith('.js') || p.endsWith('.ts')) {
      for (let i = 0; i < lines.length; i++) {
        if (/new\s+mongoose\.Schema|mongoose\.model|\.find\(|\.findOne\(|\.aggregate\(/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'MongoDB',
            category: 'Databases',
            evidenceType: 'implementation',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 6),
            owner, repo, commitSha,
            explanation: 'Mongoose schema specification or document database query operation.',
            confidence: 'high',
            limitations: 'NoSQL ODM schema and query access.',
          }));
          break;
        }
      }
    }

    // Prisma ORM
    if (p.endsWith('.prisma') || /(prisma\.\w+\.(findMany|findUnique|create|update))/.test(file.content)) {
      findings.push(this._createFinding({
        skill: 'Prisma ORM',
        category: 'Databases',
        evidenceType: 'implementation',
        repoFullName: `${owner}/${repo}`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, 8),
        owner, repo, commitSha,
        explanation: 'Prisma ORM data access client or schema definition.',
        confidence: 'high',
        limitations: 'Prisma model schema.',
      }));
    }
  }

  // --- Detector: Security & Authentication ---
  static _detectSecurityAndAuth(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();
    if (!p.endsWith('.js') && !p.endsWith('.ts') && !p.endsWith('.py') && !p.endsWith('.java')) return;

    for (let i = 0; i < lines.length; i++) {
      if (/(jwt\.sign|jwt\.verify|jsonwebtoken|bcrypt\.hash|bcrypt\.compare|passport\.use|authenticate\()/.test(lines[i])) {
        findings.push(this._createFinding({
          skill: 'Authentication & Security',
          category: 'Security',
          evidenceType: 'implementation',
          repoFullName: `${owner}/${repo}`,
          filePath: file.path,
          startLine: Math.max(1, i + 1),
          endLine: Math.min(lines.length, i + 6),
          owner, repo, commitSha,
          explanation: 'Cryptographic hashing, token verification, or authentication workflow.',
          confidence: 'high',
          limitations: 'Auth verification logic.',
        }));
        break;
      }
    }
  }

  // --- Detector: Testing & Quality ---
  static _detectTesting(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();
    const isTestFile =
      p.includes('test') ||
      p.includes('spec') ||
      /\.(test|spec)\.(js|ts|jsx|tsx|py)$/.test(p) ||
      /Test\.java$/.test(file.path);

    if (isTestFile) {
      for (let i = 0; i < lines.length; i++) {
        if (/\b(describe\s*\(|it\s*\(|test\s*\(|expect\s*\(|assert|@Test|def test_)/.test(lines[i])) {
          findings.push(this._createFinding({
            skill: 'Testing & QA',
            category: 'Testing',
            evidenceType: 'test',
            repoFullName: `${owner}/${repo}`,
            filePath: file.path,
            startLine: Math.max(1, i + 1),
            endLine: Math.min(lines.length, i + 7),
            owner, repo, commitSha,
            explanation: 'Automated test suite with assertions validating behavioral correctness.',
            confidence: 'high',
            limitations: 'Unit / Integration test assertion.',
          }));
          break;
        }
      }
    }
  }

  // --- Detector: DevOps & CI/CD ---
  static _detectDevOps(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();

    // Docker
    if (/(dockerfile|docker-compose\.ya?ml)$/i.test(p)) {
      findings.push(this._createFinding({
        skill: 'Docker',
        category: 'DevOps',
        evidenceType: 'configuration',
        repoFullName: `${owner}/${repo}`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, 8),
        owner, repo, commitSha,
        explanation: 'Docker container build instructions or multi-container orchestration definition.',
        confidence: 'high',
        limitations: 'Container configuration.',
      }));
    }

    // CI/CD (GitHub Actions)
    if (p.startsWith('.github/workflows/')) {
      findings.push(this._createFinding({
        skill: 'CI/CD & GitHub Actions',
        category: 'DevOps',
        evidenceType: 'workflow',
        repoFullName: `${owner}/${repo}`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, 10),
        owner, repo, commitSha,
        explanation: 'Continuous integration automated pipeline configuration (.github/workflows).',
        confidence: 'high',
        limitations: 'CI/CD workflow specification.',
      }));
    }
  }

  // --- Detector: External APIs ---
  static _detectApiIntegrations(file, lines, owner, repo, commitSha, findings) {
    const p = file.path.toLowerCase();
    if (!p.endsWith('.js') && !p.endsWith('.ts') && !p.endsWith('.py')) return;

    for (let i = 0; i < lines.length; i++) {
      if (/(axios\.(get|post|create)|fetch\(|httpx\.(get|post|AsyncClient)|requests\.(get|post))/.test(lines[i])) {
        findings.push(this._createFinding({
          skill: 'HTTP Client & API Integration',
          category: 'APIs',
          evidenceType: 'implementation',
          repoFullName: `${owner}/${repo}`,
          filePath: file.path,
          startLine: Math.max(1, i + 1),
          endLine: Math.min(lines.length, i + 5),
          owner, repo, commitSha,
          explanation: 'External HTTP service integration utilizing client library or Fetch API.',
          confidence: 'high',
          limitations: 'HTTP networking client.',
        }));
        break;
      }
    }
  }

  // --- Detector: Dependency Manifests ---
  static _detectDependencyManifests(file, lines, owner, repo, commitSha, findings) {
    // Only extract manifest skills if specific key packages are present
    const content = file.content;
    const p = file.path.toLowerCase();

    if (p === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        if (allDeps['react'] || allDeps['react-dom']) {
          findings.push(this._createManifestFinding('React', 'Frontend', file.path, owner, repo, commitSha, 'npm package.json'));
        }
        if (allDeps['express']) {
          findings.push(this._createManifestFinding('Express.js', 'Backend', file.path, owner, repo, commitSha, 'npm package.json'));
        }
        if (allDeps['mongoose'] || allDeps['mongodb']) {
          findings.push(this._createManifestFinding('MongoDB', 'Databases', file.path, owner, repo, commitSha, 'npm package.json'));
        }
        if (allDeps['typescript']) {
          findings.push(this._createManifestFinding('TypeScript', 'Languages', file.path, owner, repo, commitSha, 'npm package.json'));
        }
        if (allDeps['jest'] || allDeps['vitest'] || allDeps['mocha']) {
          findings.push(this._createManifestFinding('Testing & QA', 'Testing', file.path, owner, repo, commitSha, 'npm package.json'));
        }
      } catch (err) {
        // Ignore JSON parse errors in malformed manifests
      }
    }
  }

  static _createFinding({
    skill,
    category,
    evidenceType,
    repoFullName,
    filePath,
    startLine,
    endLine,
    owner,
    repo,
    commitSha,
    explanation,
    confidence,
    limitations,
  }) {
    const findingId = `fnd_${crypto.randomBytes(5).toString('hex')}`;
    const sourcePermalink = `https://github.com/${owner}/${repo}/blob/${commitSha}/${filePath}#L${startLine}-L${endLine}`;

    return {
      findingId,
      skill,
      category,
      evidenceType,
      repoFullName,
      filePath,
      lineRange: { start: startLine, end: endLine },
      codeExcerpt: '', // will be populated and validated against actual content in _validateEvidenceCitations
      explanation,
      confidence,
      limitations: limitations || `Evidence derived from verified code at commit ${commitSha.slice(0, 7)}.`,
      sourcePermalink,
    };
  }

  static _createManifestFinding(skill, category, filePath, owner, repo, commitSha, manifestType) {
    const findingId = `fnd_${crypto.randomBytes(5).toString('hex')}`;
    const sourcePermalink = `https://github.com/${owner}/${repo}/blob/${commitSha}/${filePath}#L1-L10`;

    return {
      findingId,
      skill,
      category,
      evidenceType: 'dependency',
      repoFullName: `${owner}/${repo}`,
      filePath,
      lineRange: { start: 1, end: 10 },
      codeExcerpt: '',
      explanation: `Declared as an active project dependency in ${manifestType}.`,
      confidence: 'medium',
      limitations: 'Dependency declaration verifies inclusion in the project environment.',
      sourcePermalink,
    };
  }

  static _aggregateLanguages(files) {
    const set = new Set();
    for (const f of files) {
      if (f.language && f.language !== 'Text' && f.language !== 'Markdown') {
        set.add(f.language);
      }
    }
    return Array.from(set);
  }

  static _aggregateFrameworks(findings) {
    const set = new Set();
    for (const f of findings) {
      if (f.category === 'Frontend' || f.category === 'Backend' || f.category === 'DevOps') {
        set.add(f.skill);
      }
    }
    return Array.from(set);
  }

  static _buildSkillsSummary(findings) {
    const map = new Map();

    for (const f of findings) {
      if (!map.has(f.skill)) {
        map.set(f.skill, {
          skill: f.skill,
          category: f.category,
          count: 0,
          highestConfidence: 'low',
          evidenceTypes: new Set(),
        });
      }

      const item = map.get(f.skill);
      item.count += 1;
      item.evidenceTypes.add(f.evidenceType);

      if (f.confidence === 'high') {
        item.highestConfidence = 'high';
      } else if (f.confidence === 'medium' && item.highestConfidence !== 'high') {
        item.highestConfidence = 'medium';
      }
    }

    return Array.from(map.values()).map((v) => ({
      ...v,
      evidenceTypes: Array.from(v.evidenceTypes),
    }));
  }

  /**
   * LLM Augmentation with Gemini: Refines explanations without fabricating new citations
   */
  static async _augmentWithGemini(findings, files) {
    if (!env.GEMINI_API_KEY || findings.length === 0) return;

    const sampleSummary = findings.slice(0, 15).map((f) => ({
      skill: f.skill,
      file: f.filePath,
      explanation: f.explanation,
    }));

    const prompt = `
You are an expert AI Career Coach evaluating an engineer's GitHub portfolio.
Review the following verified code evidence extracted deterministically from real files:
${JSON.stringify(sampleSummary, null, 2)}

Improve the technical explanations for up to 5 key skills.
CONSTRAINTS:
1. Do NOT invent new file paths, line numbers, or skills.
2. Provide concise, professional, evidence-backed explanations.
Return a JSON array of objects: [{ "skill": string, "refinedExplanation": string }]
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const finding = findings.find((f) => f.skill.toLowerCase() === item.skill?.toLowerCase());
            if (finding && item.refinedExplanation) {
              finding.explanation = item.refinedExplanation;
            }
          }
        }
      }
    }
  }

  /**
   * LLM Augmentation with OpenAI
   */
  static async _augmentWithOpenAI(findings, files) {
    if (!env.OPENAI_API_KEY || findings.length === 0) return;

    const sampleSummary = findings.slice(0, 15).map((f) => ({
      skill: f.skill,
      file: f.filePath,
      explanation: f.explanation,
    }));

    const prompt = `
You are an expert AI Career Coach evaluating an engineer's GitHub portfolio.
Review the following verified code evidence extracted deterministically from real files:
${JSON.stringify(sampleSummary, null, 2)}

Improve the technical explanations for up to 5 key skills.
CONSTRAINTS:
1. Do NOT invent new file paths, line numbers, or skills.
2. Provide concise, professional, evidence-backed explanations.
Return a JSON array of objects: [{ "skill": string, "refinedExplanation": string }]
`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.skills || [];
        for (const item of list) {
          const finding = findings.find((f) => f.skill.toLowerCase() === item.skill?.toLowerCase());
          if (finding && item.refinedExplanation) {
            finding.explanation = item.refinedExplanation;
          }
        }
      }
    }
  }
}
