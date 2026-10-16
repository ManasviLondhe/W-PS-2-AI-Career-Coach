import { z } from 'zod';
import { env } from '../config/env.js';

const coachFeedbackSchema = z.object({
  overallSummary: z.string(),
  skillInsights: z.array(
    z.object({
      skill: z.string(),
      status: z.enum(['demonstrated', 'partially_demonstrated', 'not_demonstrated']),
      explanation: z.string(),
      limitations: z.string(),
      recommendations: z.array(z.string()),
    })
  ),
});

export class AiCoachService {
  /**
   * Generates coaching explanations and recommendations.
   * Uses LLM if configured; otherwise provides high-quality deterministic coaching.
   */
  static async generateCoaching({ job, repo, skillAssessments, evidenceMap }) {
    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        return await this._generateWithGemini({ job, repo, skillAssessments, evidenceMap });
      } catch (err) {
        console.warn(`Gemini API call failed (${err.message}). Using deterministic coach fallback.`);
      }
    } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      try {
        return await this._generateWithOpenAI({ job, repo, skillAssessments, evidenceMap });
      } catch (err) {
        console.warn(`OpenAI API call failed (${err.message}). Using deterministic coach fallback.`);
      }
    }

    // Deterministic Fallback Engine
    return this._generateDeterministicCoaching({ job, repo, skillAssessments, evidenceMap });
  }

  /**
   * Deterministic Career Coach rule engine
   */
  static _generateDeterministicCoaching({ job, repo, skillAssessments, evidenceMap }) {
    const gaps = skillAssessments.filter((s) => s.status === 'not_demonstrated');
    const partial = skillAssessments.filter((s) => s.status === 'partially_demonstrated');
    const demonstrated = skillAssessments.filter((s) => s.status === 'demonstrated');

    let overallSummary = '';
    if (gaps.length === 0 && partial.length === 0) {
      overallSummary = `Strong alignment: All ${skillAssessments.length} evaluated requirements for the ${job.title} role at ${job.employer} are supported by verifiable code implementations in ${repo.fullName}.`;
    } else if (demonstrated.length > 0) {
      overallSummary = `Moderate portfolio alignment for ${job.title} at ${job.employer}. Identified ${demonstrated.length} demonstrated skill(s), ${partial.length} partially demonstrated, and ${gaps.length} skill gap(s) requiring verifiable implementation.`;
    } else {
      overallSummary = `Early stage portfolio for ${job.title} at ${job.employer}. None of the required skills were demonstrated in the current repository scope; adding targeted implementation will bridge these gaps.`;
    }

    const skillInsights = skillAssessments.map((sa) => {
      const evidences = (sa.evidenceIds || []).map((id) => evidenceMap[id]).filter(Boolean);
      const recs = this._getDeterministicRecommendations(sa.skill, sa.status);

      let explanation = sa.explanation;
      if (sa.status === 'demonstrated') {
        const fileList = Array.from(new Set(evidences.map((e) => e.filePath))).join(', ');
        explanation = `Implementation verified in ${fileList}. Code exhibits authentic patterns matching industry requirements.`;
      } else if (sa.status === 'partially_demonstrated') {
        explanation = `Found foundational code references for ${sa.skill}, but comprehensive implementation (error handling, testing, modular design) is missing.`;
      } else {
        explanation = `No verifiable implementation of ${sa.skill} was found in the analyzed repository files (${repo.fullName}).`;
      }

      return {
        skill: sa.skill,
        status: sa.status,
        explanation,
        limitations: `Assessment strictly reflects code analyzed at commit ${repo.latestObservedSha?.slice(0, 7) || 'HEAD'}.`,
        recommendations: recs,
      };
    });

    return {
      overallSummary,
      skillInsights,
    };
  }

  static _getDeterministicRecommendations(skill, status) {
    if (status === 'demonstrated') {
      return [
        `Maintain test coverage around ${skill} modules to prevent regressions during future commits.`,
        `Consider documenting architectural decisions or benchmark metrics in the repository README.`,
      ];
    }

    const lower = skill.toLowerCase();
    switch (lower) {
      case 'sql':
        return [
          'Add a relational database layer using parameterized queries (e.g., PostgreSQL with pg or MySQL).',
          'Create a schema migration script (e.g., schema.sql) defining tables, primary keys, and foreign keys.',
          'Implement data access functions covering SELECT with joins and transactional updates.',
        ];
      case 'java':
        return [
          'Implement core service and controller classes using Spring Boot annotations (@RestController, @Service).',
          'Add JUnit 5 test classes exercising business logic with AssertJ/Mockito.',
        ];
      case 'react':
        return [
          'Build interactive functional components with React hooks (useState, useEffect) and proper prop validation.',
          'Implement client-side state management and asynchronous data fetching from backend endpoints.',
        ];
      case 'node.js':
      case 'nodejs':
        return [
          'Create Express router modules with structured route handlers and error-handling middleware.',
          'Add environment variable validation and graceful shutdown handling.',
        ];
      case 'testing':
        return [
          'Add unit and integration tests using Jest, Vitest, or Mocha with assertion coverage on edge cases.',
          'Integrate an automated test runner into npm test script.',
        ];
      case 'ci/cd':
        return [
          'Add a GitHub Actions workflow (.github/workflows/ci.yml) that triggers on push and runs tests and linting.',
        ];
      case 'docker':
        return [
          'Add a production-ready multi-stage Dockerfile and a docker-compose.yml file to demonstrate containerization.',
        ];
      case 'mongodb':
        return [
          'Define Mongoose models with validation schemas and demonstrate CRUD operations with error handling.',
        ];
      case 'rest apis':
        return [
          'Expose well-formed REST endpoints adhering to HTTP semantics (GET, POST, PUT, DELETE) with status codes.',
        ];
      default:
        return [
          `Add concrete implementation files demonstrating practical hands-on use of ${skill}.`,
          `Avoid bare package references; write dedicated business logic or utility modules exercising ${skill}.`,
        ];
    }
  }

  /**
   * Gemini API integration with structured JSON prompting and Zod validation
   */
  static async _generateWithGemini({ job, repo, skillAssessments, evidenceMap }) {
    const prompt = this._buildPrompt({ job, repo, skillAssessments, evidenceMap });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(rawText);
    const validated = coachFeedbackSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Gemini output failed schema validation: ${validated.error.message}`);
    }

    return validated.data;
  }

  /**
   * OpenAI API integration
   */
  static async _generateWithOpenAI({ job, repo, skillAssessments, evidenceMap }) {
    const prompt = this._buildPrompt({ job, repo, skillAssessments, evidenceMap });
    const url = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(url, {
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
            content: 'You are an objective, evidence-based AI Career Coach. Respond only with valid JSON matching the requested schema.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawText);
    const validated = coachFeedbackSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`OpenAI output failed schema validation: ${validated.error.message}`);
    }

    return validated.data;
  }

  static _buildPrompt({ job, repo, skillAssessments, evidenceMap }) {
    const verifiedData = skillAssessments.map((sa) => ({
      skill: sa.skill,
      status: sa.status,
      classification: sa.classification,
      evidenceIds: sa.evidenceIds,
      evidenceSnippets: (sa.evidenceIds || []).map((id) => {
        const ev = evidenceMap[id];
        return ev ? { path: ev.filePath, lines: ev.lineRange, excerpt: ev.codeExcerpt } : null;
      }).filter(Boolean),
    }));

    return `
You are the AI Career Coach for SkillProof AI.
Evaluate how well the student's GitHub repository demonstrates the requirements for the given job.

STRICT CONSTRAINTS:
1. Do NOT invent or hallucinate file paths, line numbers, commits, or evidence items.
2. Reference ONLY the skills and verified evidence snippets provided.
3. If evidence is missing, state clearly that it is "Not demonstrated in the analyzed repository scope." Never claim the student does not know it.
4. Provide actionable, practical portfolio recommendations for each gap.

Target Job:
- Title: ${job.title}
- Employer: ${job.employer}

Repository:
- Name: ${repo.fullName}

Verified Assessment & Evidence Data:
${JSON.stringify(verifiedData, null, 2)}

Provide JSON response with this exact structure:
{
  "overallSummary": "Concise summary of alignment and key gaps",
  "skillInsights": [
    {
      "skill": "Skill Name",
      "status": "demonstrated" | "partially_demonstrated" | "not_demonstrated",
      "explanation": "Objective explanation based strictly on supplied evidence",
      "limitations": "Scope limitations",
      "recommendations": ["Actionable step 1", "Actionable step 2"]
    }
  ]
}
`;
  }
}
