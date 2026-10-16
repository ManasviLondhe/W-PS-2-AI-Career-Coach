import { SKILL_TAXONOMY, normalizeSkillName } from './src/services/skillDictionary.js';

const EXPANDED_TAXONOMY = {
  ...SKILL_TAXONOMY,
  'C++': {
    category: 'Languages',
    synonyms: ['c++', 'cpp', 'c/c++'],
  },
  'C': {
    category: 'Languages',
    synonyms: ['c language', 'c programming'],
  },
  'Data Structures': {
    category: 'Computer Science Fundamentals',
    synonyms: ['data structures', 'data structure', 'dsa'],
  },
  'Algorithms': {
    category: 'Computer Science Fundamentals',
    synonyms: ['algorithms', 'algorithm', 'algorithmic', 'complexity analysis'],
  },
  'Object-Oriented Design': {
    category: 'Software Design',
    synonyms: ['object-oriented design', 'object oriented design', 'object-oriented programming', 'object oriented programming', 'ood', 'oop'],
  },
  'Operating Systems': {
    category: 'Computer Science Fundamentals',
    synonyms: ['operating systems', 'operating system'],
  },
  'Distributed Systems': {
    category: 'Architecture / Infrastructure',
    synonyms: ['distributed systems', 'distributed system', 'distributed computing', 'distributed storage'],
  },
  'AWS': {
    category: 'Cloud / Infrastructure',
    synonyms: ['aws', 'amazon web services', 'amazon cloud'],
  },
  'Relational Databases': {
    category: 'Databases',
    synonyms: ['relational databases', 'relational database', 'rdbms'],
  },
  'Linux': {
    category: 'DevOps / Tooling',
    synonyms: ['linux', 'unix', 'bash', 'shell scripting'],
  },
  'GraphQL': {
    category: 'Architecture / Protocols',
    synonyms: ['graphql'],
  },
  'Kubernetes': {
    category: 'DevOps / Containerization',
    synonyms: ['kubernetes', 'k8s'],
  },
};

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function testExtractor() {
  const res = await fetch('https://www.amazon.jobs/en/jobs/10508052/sde-i-intern-amazon-university-talent-acquisition');
  const rawHtml = await res.text();

  let clean = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|dd|dt|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&times;/g, 'x')
    .replace(/&nbsp;/g, ' ');

  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const PREFERRED_SECTION_PATTERNS = [
    /^preferred\b/i,
    /preferred qualifications/i,
    /nice to have/i,
    /bonus points/i,
    /what would be great/i,
    /preferred skills/i,
    /desired qualifications/i,
  ];

  const REQUIRED_SECTION_PATTERNS = [
    /^basic qualifications/i,
    /^requirements\b/i,
    /required qualifications/i,
    /minimum qualifications/i,
    /core competencies/i,
    /what you will bring/i,
  ];

  let currentSection = 'intro';
  const detectedSkillsMap = new Map();

  for (const line of lines) {
    if (PREFERRED_SECTION_PATTERNS.some((pat) => pat.test(line))) {
      currentSection = 'preferred';
      continue;
    }
    if (REQUIRED_SECTION_PATTERNS.some((pat) => pat.test(line))) {
      currentSection = 'required';
      continue;
    }
    if (/job details|join us on|find careers/i.test(line)) {
      currentSection = 'footer';
      continue;
    }

    if (currentSection === 'footer') continue;

    const lowerLine = line.toLowerCase();

    for (const [canonical, meta] of Object.entries(EXPANDED_TAXONOMY)) {
      const matched = meta.synonyms.some((syn) => {
        const escaped = escapeRegex(syn);
        const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i');
        return regex.test(lowerLine);
      });

      if (matched) {
        const isPreferredSection = currentSection === 'preferred';
        const isRequiredSection = currentSection === 'required';
        const existing = detectedSkillsMap.get(canonical);

        // If in explicit required section -> required
        // If in explicit preferred section -> preferred
        // If in intro -> preferred/nice-to-have unless later found in required
        let importance = isRequiredSection ? 'required' : 'preferred';
        let confidence = (isRequiredSection || isPreferredSection) ? 'high' : 'medium';

        if (!existing) {
          detectedSkillsMap.set(canonical, {
            name: canonical,
            category: meta.category,
            importance,
            description: `Proficiency in ${canonical} as mentioned in the role posting.`,
            source_excerpt: line.slice(0, 250),
            confidence,
          });
        } else {
          // Explicit section overrides intro
          if (isRequiredSection) {
            existing.importance = 'required';
            existing.source_excerpt = line.slice(0, 250);
            existing.confidence = 'high';
          } else if (isPreferredSection && existing.confidence === 'medium') {
            existing.importance = 'preferred';
            existing.source_excerpt = line.slice(0, 250);
            existing.confidence = 'high';
          }
        }
      }
    }
  }

  const results = Array.from(detectedSkillsMap.values());
  const required = results.filter(r => r.importance === 'required');
  const preferred = results.filter(r => r.importance === 'preferred');

  console.log('=== EXTRACTION RESULTS ===');
  console.log('Total Skills Extracted:', results.length);
  console.log('Required Skills (' + required.length + '):', required.map(r => r.name));
  console.log('Preferred Skills (' + preferred.length + '):', preferred.map(r => r.name));
  console.log('\nAll Excerpts:');
  results.forEach(r => {
    console.log(`- [${r.importance.toUpperCase()}][${r.confidence.toUpperCase()}] ${r.name} (${r.category}): "${r.source_excerpt}"`);
  });
}

testExtractor().catch(console.error);
