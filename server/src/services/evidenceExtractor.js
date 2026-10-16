import crypto from 'crypto';

/**
 * Skill Implementation Detectors
 * Inspects file contents and extracts concrete line-level implementation evidence.
 */
export class EvidenceExtractor {
  /**
   * Analyzes a repository's files for a specific skill requirement.
   * @param {string} skill - Canonical skill name
   * @param {Array<{ path: string, content: string }>} files - Retrieved file list with content
   * @param {Object} repoInfo - { owner, repo, commitSha }
   * @returns {Object} { status, confidence, evidenceItems, explanation, limitations }
   */
  static extractEvidenceForSkill(skill, files, repoInfo) {
    const { owner, repo, commitSha } = repoInfo;
    const lowerSkill = skill.toLowerCase();

    let foundItems = [];

    switch (lowerSkill) {
      case 'sql':
        foundItems = this._detectSql(files, owner, repo, commitSha);
        break;
      case 'java':
        foundItems = this._detectJava(files, owner, repo, commitSha);
        break;
      case 'react':
        foundItems = this._detectReact(files, owner, repo, commitSha);
        break;
      case 'node.js':
      case 'nodejs':
        foundItems = this._detectNode(files, owner, repo, commitSha);
        break;
      case 'javascript':
        foundItems = this._detectJavaScript(files, owner, repo, commitSha);
        break;
      case 'typescript':
        foundItems = this._detectTypeScript(files, owner, repo, commitSha);
        break;
      case 'python':
        foundItems = this._detectPython(files, owner, repo, commitSha);
        break;
      case 'mongodb':
        foundItems = this._detectMongo(files, owner, repo, commitSha);
        break;
      case 'rest apis':
      case 'rest':
        foundItems = this._detectRestApis(files, owner, repo, commitSha);
        break;
      case 'testing':
        foundItems = this._detectTesting(files, owner, repo, commitSha);
        break;
      case 'ci/cd':
      case 'ci':
        foundItems = this._detectCiCd(files, owner, repo, commitSha);
        break;
      case 'docker':
        foundItems = this._detectDocker(files, owner, repo, commitSha);
        break;
      case 'git':
        foundItems = this._detectGit(files, owner, repo, commitSha);
        break;
      default:
        foundItems = this._detectGeneric(skill, files, owner, repo, commitSha);
        break;
    }

    if (foundItems.length === 0) {
      return {
        status: 'not_demonstrated',
        confidence: 'high',
        evidenceItems: [],
        explanation: `No qualifying implementation of ${skill} was identified within the analyzed repository files.`,
        limitations: `Assessment is confined to analyzed files on branch commit ${commitSha.slice(0, 7)}. The student may possess proficiency outside this repository scope.`,
      };
    }

    const hasHighConfidence = foundItems.some((item) => item.confidence === 'high');
    const isDemonstrated = hasHighConfidence || foundItems.length >= 2;

    const status = isDemonstrated ? 'demonstrated' : 'partially_demonstrated';
    const confidence = hasHighConfidence ? 'high' : 'medium';

    return {
      status,
      confidence,
      evidenceItems: foundItems,
      explanation: isDemonstrated
        ? `Concrete implementation of ${skill} confirmed across ${foundItems.length} verified code location(s).`
        : `Partial or foundational evidence of ${skill} detected, but full end-to-end implementation was not observed.`,
      limitations: `Evidence verified against repository state at commit ${commitSha.slice(0, 7)}.`,
    };
  }

  // --- SQL Detector ---
  static _detectSql(files, owner, repo, commitSha) {
    const items = [];
    const SQL_QUERY_REGEX = /\b(SELECT\s+[\s\S]+?\s+FROM|INSERT\s+INTO\s+[\s\S]+?\s+VALUES|UPDATE\s+[\s\S]+?\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i;
    const PARAM_SQL_REGEX = /(\$\d+|\?|:\w+|WHERE\s+\w+\s*=\s*[\$\?])/i;

    for (const file of files) {
      const isSqlFile = file.path.endsWith('.sql');
      const isDbModule = /(db|database|repository|dao|model|query|queries)/i.test(file.path);

      if (!isSqlFile && !isDbModule) continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (SQL_QUERY_REGEX.test(line)) {
          const start = Math.max(1, i - 1);
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');
          const isParam = PARAM_SQL_REGEX.test(excerpt);

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'SQL',
              evidenceType: 'schema_query',
              codeExcerpt: excerpt,
              explanation: isParam
                ? 'Parameterized SQL query implementation with relational criteria.'
                : 'Relational SQL query or schema definition statement.',
              confidence: isParam || isSqlFile ? 'high' : 'medium',
            })
          );
          if (items.length >= 3) break;
        }
      }
      if (items.length >= 3) break;
    }
    return items;
  }

  // --- Java Detector ---
  static _detectJava(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!file.path.endsWith('.java')) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /@(RestController|Service|Repository|SpringBootApplication|GetMapping|PostMapping)\b/.test(line) ||
          /public\s+class\s+\w+/.test(line)
        ) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 8);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'Java',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'Java class definition / Spring Boot architectural component implementation.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 3) break;
    }
    return items;
  }

  // --- React Detector ---
  static _detectReact(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/\.(jsx|tsx)$/.test(file.path) && !/(App|Component|View|Page)\.js$/.test(file.path)) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /\b(useState|useEffect|useContext|useReducer|useCallback|useMemo)\s*\(/.test(line) ||
          /(return\s*\(\s*<[\w]+|<\w+[^>]*>)/.test(line)
        ) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 7);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'React',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'React functional component lifecycle / state hook implementation with JSX rendering.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 3) break;
    }
    return items;
  }

  // --- Node.js Detector ---
  static _detectNode(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/\.(js|mjs|cjs|ts)$/.test(file.path)) continue;
      if (file.path.endsWith('.test.js') || file.path.endsWith('.spec.js')) continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /\b(express\(\)|app\.(get|post|put|delete|use)\s*\(|router\.(get|post|put|delete)\s*\()/.test(line) ||
          /require\(['"](http|fs|path|crypto)['"]\)|from\s+['"](node:[\w]+|http|express)['"]/.test(line)
        ) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'Node.js',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'Node.js server runtime routing / middleware execution.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 3) break;
    }
    return items;
  }

  // --- JavaScript Detector ---
  static _detectJavaScript(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/\.(js|jsx|mjs)$/.test(file.path)) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/async\s+function|const\s+\w+\s*=\s*async|export\s+(default\s+)?(function|class|const)/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'JavaScript',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'Modern ECMAScript asynchronous function or module export.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- TypeScript Detector ---
  static _detectTypeScript(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/\.(ts|tsx)$/.test(file.path)) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\b(interface\s+\w+|type\s+\w+\s*=|as\s+[A-Z]\w+|<[A-Z]\w+>\()/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'TypeScript',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'TypeScript static type interface or custom type definition.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- Python Detector ---
  static _detectPython(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!file.path.endsWith('.py')) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/(def\s+\w+\s*\(|class\s+\w+(\(.*\))?:|@app\.(route|get|post)|import\s+fastapi|from\s+django)/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'Python',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'Python functional definition, class hierarchy, or web application routing.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- MongoDB Detector ---
  static _detectMongo(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/\.(js|ts)$/.test(file.path)) continue;
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /new\s+mongoose\.Schema|mongoose\.model\s*\(|\.(find|findById|findOne|aggregate|updateOne)\s*\(/.test(line)
        ) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'MongoDB',
              evidenceType: 'schema_query',
              codeExcerpt: excerpt,
              explanation: 'Mongoose schema definition or document database query operation.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- REST APIs Detector ---
  static _detectRestApis(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]\/(api\/)?/.test(line) ||
          /res\.status\(\d+\)\.json\(|@GetMapping|@PostMapping|@app\.(get|post)/.test(line)
        ) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'REST APIs',
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: 'HTTP RESTful endpoint route declaration with status code handling.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 3) break;
    }
    return items;
  }

  // --- Testing Detector ---
  static _detectTesting(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      const isTestPath =
        file.path.includes('test') ||
        file.path.includes('spec') ||
        /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(file.path) ||
        /Test\.java$/.test(file.path);

      if (!isTestPath) continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\b(describe\s*\(|it\s*\(|test\s*\(|expect\s*\(|assert|@Test)\b/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'Testing',
              evidenceType: 'test_behavior',
              codeExcerpt: excerpt,
              explanation: 'Automated test suite assertion validating behavioral expectations.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- CI/CD Detector ---
  static _detectCiCd(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!file.path.includes('.github/workflows/') && !file.path.endsWith('.gitlab-ci.yml')) continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/(jobs:|runs-on:|steps:|uses:\s*actions\/)/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 8);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'CI/CD',
              evidenceType: 'workflow',
              codeExcerpt: excerpt,
              explanation: 'Continuous integration workflow pipeline automating build, lint or test actions.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- Docker Detector ---
  static _detectDocker(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (!/(Dockerfile|docker-compose\.ya?ml)$/i.test(file.path)) continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\b(FROM\s+|WORKDIR\s+|COPY\s+|RUN\s+|CMD\s+|services:)/.test(line)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 6);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill: 'Docker',
              evidenceType: 'configuration',
              codeExcerpt: excerpt,
              explanation: 'Containerized deployment configuration / Docker build specification.',
              confidence: 'high',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  // --- Git Detector ---
  static _detectGit(files, owner, repo, commitSha) {
    const items = [];
    for (const file of files) {
      if (file.path === '.gitignore') {
        const lines = file.content.split(/\r?\n/);
        const start = 1;
        const end = Math.min(lines.length, 6);
        items.push(
          this._createEvidenceItem({
            owner,
            repo,
            commitSha,
            filePath: file.path,
            lineRange: { start, end },
            skill: 'Git',
            evidenceType: 'configuration',
            codeExcerpt: lines.slice(0, end).join('\n'),
            explanation: 'Git version control hygiene (.gitignore) configuration.',
            confidence: 'medium',
          })
        );
        break;
      }
    }
    return items;
  }

  // --- Generic Fallback Detector ---
  static _detectGeneric(skill, files, owner, repo, commitSha) {
    const items = [];
    const search = skill.toLowerCase();

    for (const file of files) {
      // Don't just match package.json dependencies as strong evidence
      if (file.path === 'package.json' || file.path === 'requirements.txt') continue;

      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(search)) {
          const start = i + 1;
          const end = Math.min(lines.length, i + 5);
          const excerpt = lines.slice(start - 1, end).join('\n');

          items.push(
            this._createEvidenceItem({
              owner,
              repo,
              commitSha,
              filePath: file.path,
              lineRange: { start, end },
              skill,
              evidenceType: 'implementation',
              codeExcerpt: excerpt,
              explanation: `Explicit keyword and usage of ${skill} detected in source.`,
              confidence: 'medium',
            })
          );
          break;
        }
      }
      if (items.length >= 2) break;
    }
    return items;
  }

  static _createEvidenceItem({
    owner,
    repo,
    commitSha,
    filePath,
    lineRange,
    skill,
    evidenceType,
    codeExcerpt,
    explanation,
    confidence,
  }) {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const evidenceId = `ev_${crypto
      .createHash('sha256')
      .update([owner, repo, commitSha, normalizedPath, lineRange.start, lineRange.end, skill, evidenceType].join('|'))
      .digest('hex')
      .slice(0, 24)}`;
    const encodedPath = normalizedPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const sourcePermalink = `https://github.com/${owner}/${repo}/blob/${commitSha}/${encodedPath}#L${lineRange.start}-L${lineRange.end}`;

    return {
      evidenceId,
      commitSha,
      filePath: normalizedPath,
      lineRange,
      skill,
      evidenceType,
      codeExcerpt,
      explanation,
      sourcePermalink,
      confidence,
      limitations: 'Static implementation extract based on current repository state.',
    };
  }
}
