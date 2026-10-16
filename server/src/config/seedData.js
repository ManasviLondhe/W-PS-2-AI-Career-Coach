import { Job, Repository } from '../models/index.js';

export async function seedInitialDataIfEmpty() {
  const jobCount = await Job.countDocuments();
  if (jobCount === 0) {
    console.log('[Seed] Seeding realistic sample jobs...');
    await Job.create([
      {
        title: 'Backend Software Engineer',
        employer: 'Stripe',
        originalSourceUrl: 'https://stripe.com/jobs/backend-software-engineer',
        sourceType: 'manual_url',
        sourceVerificationState: 'verified_url',
        description: `
About the Role:
We are looking for Backend Software Engineers to build reliable, high-throughput payment infrastructure and developer APIs.

Requirements:
- Strong experience with Java, Python, or Node.js.
- Deep understanding of SQL and relational databases (PostgreSQL, MySQL).
- Proven track record building and scaling secure REST APIs.
- Experience with Git version control and code review workflows.
- Experience writing automated unit and integration tests (Testing).

Preferred Qualifications:
- Familiarity with Docker containerization and CI/CD pipelines (GitHub Actions).
- Experience with MongoDB or distributed data stores.
        `.trim(),
        requiredSkills: ['Java', 'SQL', 'REST APIs', 'Git', 'Testing'],
        preferredSkills: ['Docker', 'CI/CD', 'MongoDB'],
        normalizedRequirements: [
          { name: 'Java', category: 'Backend / Languages', isRequired: true },
          { name: 'SQL', category: 'Databases', isRequired: true },
          { name: 'REST APIs', category: 'Architecture / Protocols', isRequired: true },
          { name: 'Git', category: 'DevOps / Tooling', isRequired: true },
          { name: 'Testing', category: 'Quality Assurance', isRequired: true },
          { name: 'Docker', category: 'DevOps / Containerization', isRequired: false },
          { name: 'CI/CD', category: 'DevOps', isRequired: false },
          { name: 'MongoDB', category: 'Databases', isRequired: false },
        ],
      },
      {
        title: 'Full Stack Engineer - Intern / New Grad',
        employer: 'Figma',
        originalSourceUrl: 'https://figma.com/careers/full-stack-intern',
        sourceType: 'manual_url',
        sourceVerificationState: 'verified_url',
        description: `
Join Figma as a Full Stack Engineer to build collaborative interface design tooling.

Requirements:
- Proficiency in JavaScript and TypeScript.
- Hands-on implementation experience with React and modern UI state management.
- Backend proficiency with Node.js and REST APIs.
- Strong grounding in automated Testing (Jest, React Testing Library).

Preferred Qualifications:
- Experience with SQL databases and relational modeling.
- Exposure to Docker container environments and CI/CD automation.
        `.trim(),
        requiredSkills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Testing'],
        preferredSkills: ['SQL', 'Docker', 'CI/CD'],
        normalizedRequirements: [
          { name: 'React', category: 'Frontend / Frameworks', isRequired: true },
          { name: 'JavaScript', category: 'Frontend / Languages', isRequired: true },
          { name: 'TypeScript', category: 'Languages', isRequired: true },
          { name: 'Node.js', category: 'Backend / Runtimes', isRequired: true },
          { name: 'Testing', category: 'Quality Assurance', isRequired: true },
          { name: 'SQL', category: 'Databases', isRequired: false },
          { name: 'Docker', category: 'DevOps / Containerization', isRequired: false },
          { name: 'CI/CD', category: 'DevOps', isRequired: false },
        ],
      },
    ]);
    console.log('[Seed] Sample jobs seeded.');
  }

  const repoCount = await Repository.countDocuments();
  if (repoCount === 0) {
    console.log('[Seed] Seeding sample public repository for initial exploration...');
    await Repository.create({
      owner: 'octocat',
      name: 'Hello-World',
      fullName: 'octocat/Hello-World',
      url: 'https://github.com/octocat/Hello-World',
      defaultBranch: 'master',
      stars: 3200,
      description: 'My first repository on GitHub!',
      language: '',
      trackingState: 'active',
      latestObservedSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
      lastSuccessfullyAnalyzedSha: '',
    });
    console.log('[Seed] Sample repository seeded.');
  }
}
