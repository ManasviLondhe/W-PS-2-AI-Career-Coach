/**
 * SkillGapAnalysisService
 *
 * Converts existing skill assessment results into actionable, evidence-backed
 * improvement recommendations. This service is the core of Feature 4.
 *
 * Data-integrity guarantees maintained by this service:
 *  1. It reads assessments and evidence — it NEVER writes to them.
 *  2. Task completion updates are handled separately in the controller/model.
 *  3. A "not_demonstrated" status honestly means "not found in analyzed scope",
 *     never "the student does not know this skill".
 *  4. Recommendations are NOT regenerated automatically when an assessment changes;
 *     they are marked stale so the user can trigger regeneration explicitly.
 */

import { z } from 'zod';
import { env } from '../config/env.js';
import { Assessment, Evidence, Job, Repository, Recommendation } from '../models/index.js';

// ---------------------------------------------------------------------------
// Zod schema for LLM-generated recommendation output
// ---------------------------------------------------------------------------

const LlmRecommendationSchema = z.object({
  title: z.string().min(1),
  whyItMatters: z.string().default(''),
  whatCurrentEvidenceShows: z.string().default(''),
  whatRemainsMissing: z.string().default(''),
  implementationPlan: z.string().default(''),
  implementationSteps: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  suggestedTests: z.array(z.string()).default([]),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  estimatedEffort: z.string().default(''),
  learningResources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        type: z
          .enum(['documentation', 'tutorial', 'course', 'article', 'video', 'tool'])
          .default('article'),
        description: z.string().default(''),
      })
    )
    .default([]),
});

const LlmBatchResponseSchema = z.object({
  recommendations: z.array(
    LlmRecommendationSchema.extend({
      skill: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Priority calculation
// ---------------------------------------------------------------------------

/**
 * Assigns a 1-100 priority score to a skill gap.
 *
 * Factors:
 *  - Required skills outrank preferred skills
 *  - not_demonstrated outranks partially_demonstrated
 *  - Status and classification together determine the base score
 */
function calculatePriority(classification, status) {
  const classScore = classification === 'required' ? 60 : 30;
  const statusScore =
    status === 'not_demonstrated' ? 40 : status === 'partially_demonstrated' ? 20 : 0;
  return Math.min(100, classScore + statusScore);
}

// ---------------------------------------------------------------------------
// Deterministic fallback recommendations
// ---------------------------------------------------------------------------

function buildDeterministicRecommendation(skill, status, classification, snapshotExplanation) {
  const lower = skill.toLowerCase();
  const isRequired = classification === 'required';
  const isPartial = status === 'partially_demonstrated';

  const baseTitle = isPartial
    ? `Strengthen ${skill} implementation with depth and tests`
    : `Add a concrete ${skill} implementation to your portfolio`;

  const whyItMatters = isRequired
    ? `${skill} is listed as a required skill for this role. Without demonstrated evidence in the analyzed repository scope, the coverage score is reduced and recruiters cannot verify this competency from your portfolio.`
    : `${skill} is a preferred skill for this role. Demonstrating it gives you a competitive advantage over other candidates.`;

  const whatCurrentEvidenceShows =
    status === 'not_demonstrated'
      ? `No qualifying ${skill} code artifacts were found in the analyzed repository files. This assessment is scoped strictly to the files and commit that were analyzed — it does not make any claim about skills demonstrated in other projects or environments.`
      : `Foundational ${skill} usage was detected in the analyzed files. However, the evidence does not yet meet the threshold for "Demonstrated" — it likely lacks robust error handling, meaningful tests, or a complete end-to-end implementation pattern.`;

  const whatRemainsMissing = isPartial
    ? `A complete, production-quality ${skill} implementation with error handling, at least one test, and clear architectural intent.`
    : `Any verifiable ${skill} implementation in the repository.`;

  // Skill-specific step blueprints
  const stepsMap = {
    sql: [
      'Create a `schema.sql` (or migration file) that defines at least two tables with a foreign key relationship.',
      'Write parameterized queries (SELECT with JOIN, INSERT with conflict handling, UPDATE in a transaction).',
      'Wrap queries in a reusable data-access module (e.g., `db/userRepository.js`).',
      'Add at least two integration or unit tests that exercise the queries against a test database.',
      'Commit all changes and push to your default branch so the background worker can detect and rescan.',
    ],
    java: [
      'Create at least one Spring Boot `@RestController` with two or more endpoints.',
      'Add a `@Service` class with business logic tested using JUnit 5 and Mockito.',
      'Include a `@Repository` or JPA entity if the role involves data access.',
      'Add a `README.md` section explaining how to build and run the application with Maven/Gradle.',
      'Push to GitHub and allow the background worker to rescan.',
    ],
    react: [
      'Build a functional component that uses at least `useState` and `useEffect`.',
      'Implement client-side routing (React Router) between two or more views.',
      'Fetch real data from an API endpoint and handle loading and error states.',
      'Add PropTypes or TypeScript type annotations to your component props.',
      'Write at least one test with React Testing Library.',
    ],
    'node.js': [
      'Create Express router modules with at least three endpoints covering GET, POST, and one error case.',
      'Add request-body validation using Zod or Joi.',
      'Implement a global error-handling middleware.',
      'Add environment variable configuration via dotenv with a `.env.example` file.',
      'Write Jest or Node test-runner tests for the route handlers.',
    ],
    nodejs: [
      'Create Express router modules with at least three endpoints covering GET, POST, and one error case.',
      'Add request-body validation using Zod or Joi.',
      'Implement a global error-handling middleware.',
      'Add environment variable configuration via dotenv with a `.env.example` file.',
      'Write Jest or Node test-runner tests for the route handlers.',
    ],
    testing: [
      'Add a `tests/` or `__tests__/` directory with at minimum five test cases.',
      'Cover both happy-path and edge-case scenarios (empty input, null values, errors).',
      'Integrate your test runner (`npm test`) into the project `package.json` scripts.',
      'Add a CI badge to your README showing test status.',
    ],
    docker: [
      'Write a multi-stage `Dockerfile` that builds and runs your application.',
      'Add a `docker-compose.yml` that wires together the app and any dependencies (e.g., database).',
      'Document the Docker build and run commands in your README.',
      'Add a `.dockerignore` file to exclude unnecessary files from the build context.',
    ],
    'ci/cd': [
      'Create `.github/workflows/ci.yml` that runs on every push and pull request.',
      'Include steps: checkout, install dependencies, run tests, and optionally lint.',
      'Add a workflow status badge to your README.',
    ],
    mongodb: [
      'Define at least two Mongoose schemas with validation rules.',
      'Implement full CRUD operations in a service layer.',
      'Handle connection errors gracefully with logging.',
      'Add integration tests using `mongodb-memory-server` or a real test database.',
    ],
    'rest apis': [
      'Design and implement REST endpoints following HTTP semantics (correct status codes, methods).',
      'Document endpoints in a `docs/api.md` or using a tool like Swagger/OpenAPI.',
      'Handle 404 (resource not found) and 400 (validation error) responses explicitly.',
      'Add integration tests that exercise the full request-response cycle.',
    ],
    python: [
      'Create a Python module with at least one class and two functions with clear docstrings.',
      'Add a `requirements.txt` or `pyproject.toml` with all dependencies.',
      'Write unit tests using `pytest` or `unittest`.',
      'Configure a GitHub Actions workflow to run the tests.',
    ],
    typescript: [
      'Add `tsconfig.json` with strict mode enabled.',
      'Define and use at least three custom interfaces or types.',
      'Migrate or create at least one module with full type safety (no `any`).',
      'Add TypeScript build step to your CI pipeline.',
    ],
  };

  const steps = stepsMap[lower] || [
    `Research the core patterns and tools used in professional ${skill} implementations.`,
    `Add a dedicated module or file in your repository that demonstrates ${skill} with real business logic.`,
    `Write at least two tests for the new implementation.`,
    `Document how to run and verify the implementation in your README.`,
    `Push to your default branch and allow the background worker to detect and rescan.`,
  ];

  const acceptanceCriteria = [
    `The repository contains at least one file with identifiable ${skill} implementation patterns.`,
    `The implementation includes error handling (not just a bare "hello world").`,
    `At least one automated test verifies the ${skill} behavior.`,
    `The background assessment worker can detect the change and produce a new revision.`,
  ];

  // Learning resources (only include well-known, stable URLs)
  const resourceMap = {
    sql: [
      {
        title: 'SQL Tutorial — W3Schools',
        url: 'https://www.w3schools.com/sql/',
        type: 'tutorial',
        description: 'Interactive SQL reference and sandbox for common query patterns.',
      },
      {
        title: 'PostgreSQL Official Documentation',
        url: 'https://www.postgresql.org/docs/current/',
        type: 'documentation',
        description: 'Comprehensive reference for PostgreSQL-specific SQL features.',
      },
    ],
    react: [
      {
        title: 'React Official Documentation',
        url: 'https://react.dev',
        type: 'documentation',
        description: 'Official React docs with interactive tutorials and API reference.',
      },
      {
        title: 'React Testing Library',
        url: 'https://testing-library.com/docs/react-testing-library/intro/',
        type: 'documentation',
        description: 'Guide to testing React components with user-centric queries.',
      },
    ],
    'node.js': [
      {
        title: 'Node.js Official Documentation',
        url: 'https://nodejs.org/en/docs',
        type: 'documentation',
        description: 'Official Node.js API and guide documentation.',
      },
      {
        title: 'Express.js Guide',
        url: 'https://expressjs.com/en/guide/routing.html',
        type: 'documentation',
        description: 'Express routing, middleware, and error-handling patterns.',
      },
    ],
    nodejs: [
      {
        title: 'Node.js Official Documentation',
        url: 'https://nodejs.org/en/docs',
        type: 'documentation',
        description: 'Official Node.js API and guide documentation.',
      },
    ],
    docker: [
      {
        title: 'Docker Getting Started',
        url: 'https://docs.docker.com/get-started/',
        type: 'documentation',
        description: 'Official Docker quickstart guide covering Dockerfiles and Compose.',
      },
    ],
    'ci/cd': [
      {
        title: 'GitHub Actions Documentation',
        url: 'https://docs.github.com/en/actions',
        type: 'documentation',
        description: 'Official guide to GitHub Actions workflows and syntax.',
      },
    ],
    mongodb: [
      {
        title: 'Mongoose.js Official Documentation',
        url: 'https://mongoosejs.com/docs/',
        type: 'documentation',
        description: 'Schema, validation, and query patterns for MongoDB with Mongoose.',
      },
    ],
    testing: [
      {
        title: 'Jest Documentation',
        url: 'https://jestjs.io/docs/getting-started',
        type: 'documentation',
        description: 'Zero-config JavaScript testing framework with mocking and coverage.',
      },
      {
        title: 'Node.js Built-in Test Runner',
        url: 'https://nodejs.org/docs/latest/api/test.html',
        type: 'documentation',
        description: 'Native test runner available in Node.js 18+ (no extra dependencies).',
      },
    ],
    typescript: [
      {
        title: 'TypeScript Handbook',
        url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
        type: 'documentation',
        description: 'Official TypeScript language guide from basic types to advanced patterns.',
      },
    ],
    python: [
      {
        title: 'pytest Documentation',
        url: 'https://docs.pytest.org/en/stable/',
        type: 'documentation',
        description: 'Full-featured Python testing framework guide.',
      },
    ],
  };

  const learningResources = resourceMap[lower] || [];

  return {
    title: baseTitle,
    whyItMatters,
    whatCurrentEvidenceShows,
    whatRemainsMissing,
    implementationPlan: `Add targeted ${skill} code to your repository following the steps below. After pushing, the background worker will detect the change and run a new assessment. Achieving "Demonstrated" status requires the automated evidence-extraction engine to find qualifying code patterns — completing these tasks alone is not sufficient.`,
    implementationSteps: steps,
    acceptanceCriteria,
    suggestedTests: [
      `Run the project's test suite after adding your implementation to confirm no regressions.`,
      `Verify the new ${skill} feature works end-to-end by executing it manually.`,
      `After pushing, monitor the Activity Timeline to see when the background worker triggers a new assessment.`,
      `Compare the new assessment revision with the previous one using the History view to confirm the status improved.`,
    ],
    difficultyLevel: isPartial ? 'intermediate' : 'beginner',
    estimatedEffort: isPartial ? '3-6 hours' : '2-4 hours',
    learningResources,
  };
}

// ---------------------------------------------------------------------------
// LLM integration (reuses AiCoachService pattern)
// ---------------------------------------------------------------------------

async function buildLlmPrompt({ job, repo, gaps, evidenceMap }) {
  const gapData = gaps.map((gap) => ({
    skill: gap.skill,
    requirementClassification: gap.classification,
    assessedStatus: gap.status,
    assessedExplanation: gap.explanation,
    evidenceSummaries: (gap.evidenceIds || [])
      .map((id) => {
        const ev = evidenceMap[id];
        return ev
          ? {
              filePath: ev.filePath,
              lineRange: ev.lineRange,
              excerpt: ev.codeExcerpt?.slice(0, 300) || '',
              evidenceType: ev.evidenceType,
            }
          : null;
      })
      .filter(Boolean),
  }));

  return `
You are the AI Career Coach for SkillProof AI.

Your task is to generate specific, actionable, portfolio-oriented improvement recommendations
for each skill gap identified in a student's GitHub repository assessment.

STRICT CONSTRAINTS — follow these exactly:
1. Do NOT invent file paths, line numbers, commits, or evidence not supplied below.
2. Each recommendation MUST address one specific skill gap.
3. Never say the student "doesn't know" or "lacks" a skill — only say it was "not found in the analyzed repository scope".
4. Provide realistic, concrete implementation steps that can be completed in 2-8 hours.
5. Only include learning resource URLs you are highly confident exist (popular docs pages). If uncertain, omit the URL.
6. Acceptance criteria must be measurable and code-verifiable, not subjective.

Target Job:
- Title: ${job.title}
- Company: ${job.employer}

Student's Repository:
- Name: ${repo.fullName}
- Language: ${repo.language || 'Unknown'}

Skill Gaps to Analyze:
${JSON.stringify(gapData, null, 2)}

Respond ONLY with valid JSON matching this exact schema:
{
  "recommendations": [
    {
      "skill": "exact skill name from the gap data",
      "title": "concise action-oriented title (max 80 chars)",
      "whyItMatters": "why this skill matters for the specific job role (2-3 sentences)",
      "whatCurrentEvidenceShows": "what the existing assessment found, in scope-honest language",
      "whatRemainsMissing": "what evidence would be needed to reach Demonstrated status",
      "implementationPlan": "one paragraph overview of the implementation approach",
      "implementationSteps": ["step 1", "step 2", "step 3", "step 4", "step 5"],
      "acceptanceCriteria": ["measurable criterion 1", "measurable criterion 2", "measurable criterion 3"],
      "suggestedTests": ["how to verify step 1", "how to verify step 2"],
      "difficultyLevel": "beginner" | "intermediate" | "advanced",
      "estimatedEffort": "e.g. 2-4 hours",
      "learningResources": [
        {
          "title": "Resource name",
          "url": "https://...",
          "type": "documentation" | "tutorial" | "course" | "article" | "video" | "tool",
          "description": "one-line description"
        }
      ]
    }
  ]
}
`;
}

async function generateWithGemini({ job, repo, gaps, evidenceMap }) {
  const prompt = await buildLlmPrompt({ job, repo, gaps, evidenceMap });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Gemini API returned HTTP ${res.status}`);

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(rawText);
  const validated = LlmBatchResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Gemini output failed schema validation: ${validated.error.message}`);
  }
  return { result: validated.data, source: 'gemini' };
}

async function generateWithOpenAI({ job, repo, gaps, evidenceMap }) {
  const prompt = await buildLlmPrompt({ job, repo, gaps, evidenceMap });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an objective, evidence-based AI Career Coach. Respond only with valid JSON matching the requested schema.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`OpenAI API returned HTTP ${res.status}`);

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(rawText);
  const validated = LlmBatchResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`OpenAI output failed schema validation: ${validated.error.message}`);
  }
  return { result: validated.data, source: 'openai' };
}

// ---------------------------------------------------------------------------
// Main service class
// ---------------------------------------------------------------------------

export class SkillGapAnalysisService {
  /**
   * Generate (or refresh) recommendations for a given assessment.
   *
   * Algorithm:
   *  1. Load the assessment with job and repo references.
   *  2. Filter skillResults to gaps (not_demonstrated or partially_demonstrated).
   *  3. Load related evidence items.
   *  4. Call LLM (or fallback) to get structured recommendations.
   *  5. Upsert Recommendation documents — one per gap skill per assessment revision.
   *     Upsert means: if one already exists for this (assessment, skill), update it
   *     rather than creating a duplicate.
   *  6. Mark any previously-generated recommendations for this (job, repo) combination
   *     that belong to older assessment revisions as stale.
   *  7. Return the saved Recommendation documents.
   *
   * @param {string} assessmentId - MongoDB ObjectId of the Assessment to analyze
   * @param {Object} [options]
   * @param {boolean} [options.forceRegenerate=false] - If true, regenerate even if current recs exist
   * @returns {Promise<{recommendations: Recommendation[], source: string, skipped: boolean}>}
   */
  static async generateRecommendations(assessmentId, { forceRegenerate = false } = {}) {
    // 1. Load assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('job')
      .populate('repository')
      .lean();

    if (!assessment) throw new Error(`Assessment not found: ${assessmentId}`);

    const job = assessment.job;
    const repo = assessment.repository;

    if (!job) throw new Error(`Assessment ${assessmentId} has no linked job.`);
    if (!repo) throw new Error(`Assessment ${assessmentId} has no linked repository.`);

    // 2. Filter to meaningful gaps only
    const gaps = (assessment.skillResults || []).filter(
      (sr) => sr.status === 'not_demonstrated' || sr.status === 'partially_demonstrated'
    );

    if (gaps.length === 0) {
      return { recommendations: [], source: 'none', skipped: true, message: 'No gaps found — all skills are demonstrated.' };
    }

    // 3. Check if current recommendations already exist and are fresh
    if (!forceRegenerate) {
      const existingCount = await Recommendation.countDocuments({
        assessment: assessment._id,
        assessmentRevision: assessment.revisionNumber,
        isStale: false,
      });
      if (existingCount === gaps.length) {
        const existing = await Recommendation.find({
          assessment: assessment._id,
          assessmentRevision: assessment.revisionNumber,
        }).lean();
        return { recommendations: existing, source: 'cached', skipped: true };
      }
    }

    // 4. Load evidence
    const allEvIds = gaps.flatMap((g) => g.evidenceIds || []);
    const evidenceDocs = await Evidence.find({ evidenceId: { $in: allEvIds } }).lean();
    const evidenceMap = {};
    for (const ev of evidenceDocs) evidenceMap[ev.evidenceId] = ev;

    // 5. Call LLM or use deterministic fallback
    let llmResults = null;
    let source = 'deterministic';

    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        const r = await generateWithGemini({ job, repo, gaps, evidenceMap });
        llmResults = r.result;
        source = r.source;
      } catch (err) {
        console.warn(`[SkillGapAnalysis] Gemini call failed (${err.message}). Using deterministic fallback.`);
      }
    } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      try {
        const r = await generateWithOpenAI({ job, repo, gaps, evidenceMap });
        llmResults = r.result;
        source = r.source;
      } catch (err) {
        console.warn(`[SkillGapAnalysis] OpenAI call failed (${err.message}). Using deterministic fallback.`);
      }
    }

    // 6. Build recommendation documents
    const savedRecs = [];

    for (const gap of gaps) {
      // Get LLM result for this skill (match by skill name, case-insensitive)
      const llmRec = llmResults?.recommendations?.find(
        (r) => r.skill.toLowerCase() === gap.skill.toLowerCase()
      );

      // Build the content object — prefer LLM, fallback to deterministic
      let content;
      if (llmRec) {
        content = {
          title: llmRec.title,
          whyItMatters: llmRec.whyItMatters,
          whatCurrentEvidenceShows: llmRec.whatCurrentEvidenceShows,
          whatRemainsMissing: llmRec.whatRemainsMissing,
          implementationPlan: llmRec.implementationPlan,
          implementationSteps: llmRec.implementationSteps,
          acceptanceCriteria: llmRec.acceptanceCriteria,
          suggestedTests: llmRec.suggestedTests,
          difficultyLevel: llmRec.difficultyLevel,
          estimatedEffort: llmRec.estimatedEffort,
          learningResources: llmRec.learningResources,
        };
      } else {
        content = buildDeterministicRecommendation(
          gap.skill,
          gap.status,
          gap.classification,
          gap.explanation
        );
      }

      const priority = calculatePriority(gap.classification, gap.status);

      // Upsert: findOneAndUpdate to prevent duplicates on retry
      const savedRec = await Recommendation.findOneAndUpdate(
        {
          assessment: assessment._id,
          skill: gap.skill,
        },
        {
          $set: {
            assessmentRevision: assessment.revisionNumber,
            job: job._id,
            repository: repo._id,
            skill: gap.skill,
            requirementClassification: gap.classification,
            snapshotStatus: gap.status,
            snapshotExplanation: gap.explanation || '',
            snapshotEvidenceIds: gap.evidenceIds || [],
            ...content,
            priority,
            generationSource: source,
            generationPromptVersion: '1.0',
            isStale: false,
            stalenessReason: '',
          },
          // Only reset taskStatus/notes if this is a forced regeneration;
          // otherwise preserve existing progress
          ...(forceRegenerate
            ? {
                $set: {
                  taskStatus: 'pending',
                  taskNotes: '',
                  taskCompletedAt: null,
                },
              }
            : {}),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      savedRecs.push(savedRec);
    }

    // 7. Mark older recommendations for this (job, repo) pair as stale
    await Recommendation.updateMany(
      {
        job: job._id,
        repository: repo._id,
        assessment: { $ne: assessment._id },
        isStale: false,
      },
      {
        $set: {
          isStale: true,
          stalenessReason: `Superseded by assessment revision ${assessment.revisionNumber} (${assessment._id}).`,
        },
      }
    );

    return { recommendations: savedRecs, source, skipped: false };
  }

  /**
   * Mark recommendations as stale when a new assessment is created for the same
   * job + repository combination. Called by the assessment system after a new
   * revision is saved.
   *
   * @param {string} jobId
   * @param {string} repositoryId
   * @param {string} newAssessmentId - The newly created assessment (excluded from staleness)
   * @param {number} newRevisionNumber
   */
  static async markRecommendationsStale(jobId, repositoryId, newAssessmentId, newRevisionNumber) {
    const result = await Recommendation.updateMany(
      {
        job: jobId,
        repository: repositoryId,
        assessment: { $ne: newAssessmentId },
        isStale: false,
      },
      {
        $set: {
          isStale: true,
          stalenessReason: `A new assessment (revision ${newRevisionNumber}) was created for this repository. Re-generate recommendations to reflect the latest evidence.`,
        },
      }
    );
    return result.modifiedCount;
  }

  /**
   * Update task progress for a single recommendation.
   * IMPORTANT: This does NOT touch the Assessment or any skillResult.
   *
   * @param {string} recommendationId
   * @param {Object} update - { taskStatus, taskNotes }
   * @returns {Promise<Recommendation>}
   */
  static async updateTaskProgress(recommendationId, { taskStatus, taskNotes }) {
    const allowedStatuses = ['pending', 'in_progress', 'completed'];
    if (!allowedStatuses.includes(taskStatus)) {
      throw Object.assign(new Error(`Invalid taskStatus: ${taskStatus}.`), { status: 400 });
    }

    const update = { taskStatus };
    if (taskNotes !== undefined) update.taskNotes = taskNotes;
    if (taskStatus === 'completed') {
      update.taskCompletedAt = new Date();
    } else {
      update.taskCompletedAt = null;
    }

    const rec = await Recommendation.findByIdAndUpdate(
      recommendationId,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!rec) {
      throw Object.assign(new Error(`Recommendation not found: ${recommendationId}`), { status: 404 });
    }

    return rec;
  }
}
