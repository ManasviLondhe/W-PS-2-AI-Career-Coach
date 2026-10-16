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
  SQL: {
    category: 'Databases',
    synonyms: ['sql', 'postgresql', 'postgres', 'mysql', 'sqlite', 'relational database', 'rdbms'],
    extensions: ['.sql'],
  },
  MongoDB: {
    category: 'Databases',
    synonyms: ['mongodb', 'mongo', 'nosql', 'mongoose'],
    extensions: ['.js', '.ts'],
  },
  'REST APIs': {
    category: 'Architecture / Protocols',
    synonyms: ['rest', 'rest api', 'rest apis', 'restful', 'restful apis', 'restful api', 'api development'],
    extensions: ['.js', '.ts', '.py', '.java'],
  },
  Git: {
    category: 'DevOps / Tooling',
    synonyms: ['git', 'github', 'version control'],
    extensions: ['.gitignore'],
  },
  Testing: {
    category: 'Quality Assurance',
    synonyms: ['testing', 'unit test', 'unit testing', 'jest', 'mocha', 'chai', 'junit', 'pytest', 'cypress', 'playwright', 'vitest'],
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

  const lines = text.split(/\r?\n/);
  let currentSection = 'required'; // default section

  const PREFERRED_SECTION_PATTERNS = [
    /nice to have/i,
    /preferred qualifications/i,
    /bonus points/i,
    /plus/i,
    /what would be great/i,
    /preferred skills/i,
    /desired qualifications/i,
  ];

  const REQUIRED_SECTION_PATTERNS = [
    /requirements/i,
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
    });
  });

  preferred.forEach((skill) => {
    normalizedRequirements.push({
      name: skill,
      category: SKILL_TAXONOMY[skill]?.category || 'General',
      isRequired: false,
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
