export const SKILL_TAXONOMY = {
  Java: {
    category: 'Backend / Languages',
    synonyms: ['java', 'core java', 'java 11', 'java 17', 'java 21', 'spring', 'spring boot'],
    extensions: ['.java'],
  },
  JavaScript: {
    category: 'Frontend / Languages',
    synonyms: ['javascript', 'js', 'ecmascript', 'es6', 'es2020'],
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
  },
  TypeScript: {
    category: 'Languages',
    synonyms: ['typescript', 'ts'],
    extensions: ['.ts', '.tsx'],
  },
  React: {
    category: 'Frontend / Frameworks',
    synonyms: ['react', 'reactjs', 'react.js', 'react native'],
    extensions: ['.jsx', '.tsx'],
  },
  'Node.js': {
    category: 'Backend / Runtimes',
    synonyms: ['node', 'nodejs', 'node.js', 'express', 'expressjs', 'express.js', 'nestjs'],
    extensions: ['.js', '.ts'],
  },
  Python: {
    category: 'Languages',
    synonyms: ['python', 'python3', 'django', 'flask', 'fastapi'],
    extensions: ['.py'],
  },
  'C++': {
    category: 'Languages',
    synonyms: ['c++', 'cpp', 'c/c++'],
    extensions: ['.cpp', '.cc', '.cxx', '.h', '.hpp'],
  },
  C: {
    category: 'Languages',
    synonyms: ['c language', 'c programming', 'ansi c'],
    extensions: ['.c', '.h'],
  },
  SQL: {
    category: 'Databases',
    synonyms: ['sql', 'postgresql', 'postgres', 'mysql', 'sqlite'],
    extensions: ['.sql'],
  },
  'Relational Databases': {
    category: 'Databases',
    synonyms: ['relational databases', 'relational database', 'rdbms'],
    extensions: ['.sql'],
  },
  MongoDB: {
    category: 'Databases',
    synonyms: ['mongodb', 'mongo', 'nosql', 'mongoose'],
    extensions: ['.js', '.ts'],
  },
  'Data Structures': {
    category: 'Computer Science Fundamentals',
    synonyms: ['data structures', 'data structure', 'dsa'],
    extensions: ['.java', '.py', '.cpp', '.ts', '.js'],
  },
  Algorithms: {
    category: 'Computer Science Fundamentals',
    synonyms: ['algorithms', 'algorithm', 'algorithmic', 'complexity analysis'],
    extensions: ['.java', '.py', '.cpp', '.ts', '.js'],
  },
  'Object-Oriented Design': {
    category: 'Software Design',
    synonyms: [
      'object-oriented design',
      'object oriented design',
      'object-oriented programming',
      'object oriented programming',
      'ood',
      'oop',
    ],
    extensions: ['.java', '.cpp', '.ts'],
  },
  'Operating Systems': {
    category: 'Computer Science Fundamentals',
    synonyms: ['operating systems', 'operating system', 'os concepts'],
    extensions: ['.c', '.cpp'],
  },
  'Distributed Systems': {
    category: 'Architecture / Infrastructure',
    synonyms: [
      'distributed systems',
      'distributed system',
      'distributed computing',
      'distributed storage',
      'distributed, multi-tiered systems',
      'multi-tiered systems',
    ],
    extensions: ['.java', '.go', '.py'],
  },
  AWS: {
    category: 'Cloud / Infrastructure',
    synonyms: ['aws', 'amazon web services', 'amazon cloud', 's3', 'ec2', 'lambda'],
    extensions: ['.yml', '.yaml', '.tf'],
  },
  'REST APIs': {
    category: 'Architecture / Protocols',
    synonyms: ['rest', 'rest api', 'rest apis', 'restful', 'restful apis', 'restful api', 'api development'],
    extensions: ['.js', '.ts', '.py', '.java'],
  },
  GraphQL: {
    category: 'Architecture / Protocols',
    synonyms: ['graphql'],
    extensions: ['.graphql', '.js', '.ts'],
  },
  Git: {
    category: 'DevOps / Tooling',
    synonyms: ['git', 'github', 'version control'],
    extensions: ['.gitignore'],
  },
  Testing: {
    category: 'Quality Assurance',
    synonyms: [
      'testing',
      'unit test',
      'unit testing',
      'automated testing',
      'jest',
      'mocha',
      'chai',
      'junit',
      'pytest',
      'cypress',
      'playwright',
      'vitest',
    ],
    extensions: ['.test.js', '.spec.js', '.test.ts', '.spec.ts', 'Test.java'],
  },
  'CI/CD': {
    category: 'DevOps',
    synonyms: ['ci/cd', 'ci', 'continuous integration', 'github actions', 'gitlab ci', 'jenkins'],
    extensions: ['.yml', '.yaml'],
  },
  Docker: {
    category: 'DevOps / Containerization',
    synonyms: ['docker', 'container', 'containers', 'dockerfile', 'docker-compose'],
    extensions: ['Dockerfile', 'docker-compose.yml'],
  },
  Kubernetes: {
    category: 'DevOps / Containerization',
    synonyms: ['kubernetes', 'k8s'],
    extensions: ['.yml', '.yaml'],
  },
  Linux: {
    category: 'DevOps / Tooling',
    synonyms: ['linux', 'unix', 'bash', 'shell scripting'],
    extensions: ['.sh'],
  },
};

/**
 * Normalizes any text query or raw string to a canonical skill name if recognized.
 */
export function normalizeSkillName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  const clean = rawName.trim().toLowerCase();

  for (const [canonical, meta] of Object.entries(SKILL_TAXONOMY)) {
    if (canonical.toLowerCase() === clean) return canonical;
    if (meta.synonyms.some((syn) => syn.toLowerCase() === clean)) {
      return canonical;
    }
  }

  // Preserve title-cased if not in dictionary
  return rawName.trim();
}

/**
 * Extract skills from job text, segregating required vs preferred.
 */
export function extractSkillsFromText(text) {
  const required = new Set();
  const preferred = new Set();

  if (!text || typeof text !== 'string') {
    return { requiredSkills: [], preferredSkills: [], normalizedRequirements: [] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  let currentSection = 'required'; // default section

  const PREFERRED_SECTION_PATTERNS = [
    /^preferred\b/i,
    /nice to have/i,
    /preferred qualifications/i,
    /bonus points/i,
    /plus/i,
    /what would be great/i,
    /preferred skills/i,
    /desired qualifications/i,
  ];

  const REQUIRED_SECTION_PATTERNS = [
    /^basic qualifications/i,
    /^requirements\b/i,
    /required qualifications/i,
    /what you will bring/i,
    /minimum qualifications/i,
    /who you are/i,
    /core competencies/i,
    /basic qualifications/i,
  ];

  for (const line of lines) {
    if (PREFERRED_SECTION_PATTERNS.some((pat) => pat.test(line))) {
      currentSection = 'preferred';
      continue;
    }
    if (REQUIRED_SECTION_PATTERNS.some((pat) => pat.test(line))) {
      currentSection = 'required';
      continue;
    }

    const lowerLine = line.toLowerCase();
    for (const [canonical, meta] of Object.entries(SKILL_TAXONOMY)) {
      const matched = meta.synonyms.some((syn) => {
        const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escapeRegex(syn)}([^a-zA-Z0-9_#+]|$)`, 'i');
        return regex.test(lowerLine);
      });

      if (matched) {
        if (currentSection === 'preferred') {
          if (!required.has(canonical)) {
            preferred.add(canonical);
          }
        } else {
          required.add(canonical);
          preferred.delete(canonical);
        }
      }
    }
  }

  const normalizedRequirements = [];
  required.forEach((skill) => {
    normalizedRequirements.push({
      name: skill,
      category: SKILL_TAXONOMY[skill]?.category || 'General',
      isRequired: true,
      importance: 'required',
    });
  });

  preferred.forEach((skill) => {
    normalizedRequirements.push({
      name: skill,
      category: SKILL_TAXONOMY[skill]?.category || 'General',
      isRequired: false,
      importance: 'preferred',
    });
  });

  return {
    requiredSkills: Array.from(required),
    preferredSkills: Array.from(preferred),
    normalizedRequirements,
  };
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
