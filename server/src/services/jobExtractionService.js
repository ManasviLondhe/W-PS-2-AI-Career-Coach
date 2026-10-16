import { z } from 'zod';
import { env } from '../config/env.js';
import { SKILL_TAXONOMY, normalizeSkillName } from './skillDictionary.js';

const requirementItemSchema = z.object({
  name: z.string(),
  category: z.string().default('General'),
  importance: z.enum(['required', 'preferred']).default('required'),
  description: z.string().default(''),
  source_excerpt: z.string().default(''),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
});

const extractedJobSchema = z.object({
  title: z.string(),
  employer: z.string(),
  location: z.string().optional().default(''),
  employmentType: z.string().optional().default(''),
  roleSummary: z.string().optional().default(''),
  responsibilities: z.array(z.string()).optional().default([]),
  qualifications: z.array(z.string()).optional().default([]),
  requirements: z.array(requirementItemSchema).default([]),
  limitations: z.string().optional().default(''),
});

export class JobExtractionService {
  /**
   * Main entry point to extract structured job requirements.
   * Uses Gemini/OpenAI if API keys are present; otherwise falls back to deterministic parsing.
   */
  static async extractRequirements({ text, initialTitle = '', initialEmployer = '', sourceUrl = '' }) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Cannot extract requirements: job posting text is empty.');
    }

    // Try LLM if configured
    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        const result = await this._extractWithGemini({ text, initialTitle, initialEmployer });
        return {
          ...result,
          extractionMode: 'ai_llm',
        };
      } catch (err) {
        console.warn(`[JobExtractor] Gemini extraction failed (${err.message}). Using deterministic fallback.`);
      }
    } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      try {
        const result = await this._extractWithOpenAI({ text, initialTitle, initialEmployer });
        return {
          ...result,
          extractionMode: 'ai_llm',
        };
      } catch (err) {
        console.warn(`[JobExtractor] OpenAI extraction failed (${err.message}). Using deterministic fallback.`);
      }
    }

    // High-quality deterministic extraction fallback
    const result = this._extractDeterministic({ text, initialTitle, initialEmployer, sourceUrl });
    return {
      ...result,
      extractionMode: 'deterministic',
    };
  }

  /**
   * Gemini 1.5 Flash structured extraction
   */
  static async _extractWithGemini({ text, initialTitle, initialEmployer }) {
    const prompt = this._buildPrompt({ text, initialTitle, initialEmployer });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(rawContent);
    const validated = extractedJobSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Gemini schema validation failed: ${validated.error.message}`);
    }

    return this._normalizeExtractedResult(validated.data, text);
  }

  /**
   * OpenAI structured extraction
   */
  static async _extractWithOpenAI({ text, initialTitle, initialEmployer }) {
    const prompt = this._buildPrompt({ text, initialTitle, initialEmployer });
    const url = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(rawContent);
    const validated = extractedJobSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`OpenAI schema validation failed: ${validated.error.message}`);
    }

    return this._normalizeExtractedResult(validated.data, text);
  }

  static _buildPrompt({ text, initialTitle, initialEmployer }) {
    return `
You are an expert technical talent parser for SkillProof AI, an evidence-based developer career coach.
Analyze the following real job or internship posting text and extract structured requirements.
Ground every requirement in the supplied text. Do NOT invent skills or qualifications not mentioned.
Do NOT categorize a skill as "required" if the posting states it as preferred, nice-to-have, or bonus.
For each requirement, provide an exact quote as source_excerpt from the text.

Posting context:
Title hint: ${initialTitle || 'Unknown'}
Employer hint: ${initialEmployer || 'Unknown'}

Posting Content:
"""
${text.slice(0, 15000)}
"""

Output JSON strictly adhering to:
{
  "title": "Detected job title",
  "employer": "Detected employer name",
  "location": "Location if mentioned (e.g. Remote, San Francisco, CA) or empty",
  "employmentType": "Full-time, Internship, Part-time, Contract, or empty",
  "roleSummary": "1-2 sentence concise summary of the core role purpose",
  "responsibilities": ["Array of explicit responsibilities mentioned"],
  "qualifications": ["Array of explicit qualifications or experience requirements"],
  "requirements": [
    {
      "name": "Canonical skill name (e.g. Java, SQL, React, Node.js, Docker, Testing, Git, REST APIs)",
      "category": "Languages | Frameworks | Databases | DevOps | Quality Assurance | Architecture | etc.",
      "importance": "required" or "preferred",
      "description": "What this role expects the candidate to do with this skill",
      "source_excerpt": "Exact sentence or bullet from posting text supporting this requirement",
      "confidence": "high" or "medium"
    }
  ],
  "limitations": "Any ambiguities or gaps in the posting content"
}
`.trim();
  }

  /**
   * High-quality deterministic rule-based extractor
   */
  static _extractDeterministic({ text, initialTitle, initialEmployer, sourceUrl }) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const PREFERRED_SECTION_PATTERNS = [
      /^preferred\b/i,
      /nice to have/i,
      /preferred qualifications/i,
      /bonus points/i,
      /plus/i,
      /what would be great/i,
      /preferred skills/i,
      /desired qualifications/i,
      /what we'd love to see/i,
    ];

    const REQUIRED_SECTION_PATTERNS = [
      /requirements/i,
      /required qualifications/i,
      /what you will bring/i,
      /minimum qualifications/i,
      /who you are/i,
      /core competencies/i,
      /basic qualifications/i,
      /what you need/i,
    ];

    const RESPONSIBILITY_SECTION_PATTERNS = [
      /responsibilities/i,
      /what you will do/i,
      /what you'll do/i,
      /the role/i,
      /key duties/i,
      /your mission/i,
    ];

    let currentSection = 'general';
    const responsibilities = [];
    const qualifications = [];
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
      if (RESPONSIBILITY_SECTION_PATTERNS.some((pat) => pat.test(line))) {
        currentSection = 'responsibilities';
        continue;
      }

      if (currentSection === 'responsibilities' && (line.startsWith('•') || line.startsWith('-') || line.length > 25)) {
        if (responsibilities.length < 8) responsibilities.push(line.replace(/^[•\-]\s*/, ''));
      }
      if ((currentSection === 'required' || currentSection === 'preferred') && (line.startsWith('•') || line.startsWith('-'))) {
        if (qualifications.length < 8) qualifications.push(line.replace(/^[•\-]\s*/, ''));
      }

      const lowerLine = line.toLowerCase();

      // Scan taxonomy
      for (const [canonical, meta] of Object.entries(SKILL_TAXONOMY)) {
        const matched = meta.synonyms.some((syn) => {
          const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escapeRegex(syn)}([^a-zA-Z0-9_#+]|$)`, 'i');
          return regex.test(lowerLine);
        });

        if (matched) {
          const isPreferredSection = currentSection === 'preferred';
          const existing = detectedSkillsMap.get(canonical);

          if (!existing) {
            detectedSkillsMap.set(canonical, {
              name: canonical,
              category: meta.category,
              importance: isPreferredSection ? 'preferred' : 'required',
              description: `Proficiency in ${canonical} as mentioned in the role posting.`,
              source_excerpt: line.slice(0, 250),
              confidence: isPreferredSection || currentSection === 'required' ? 'high' : 'medium',
            });
          } else if (!isPreferredSection && existing.importance === 'preferred') {
            // Upgrade to required if subsequently mentioned in required section
            existing.importance = 'required';
            existing.source_excerpt = line.slice(0, 250);
            existing.confidence = 'high';
          }
        }
      }
    }

    // Role summary from introductory paragraphs
    const introLines = lines.slice(0, 5).filter((l) => l.length > 40 && !l.includes(':'));
    const roleSummary = introLines.length > 0 ? introLines.slice(0, 2).join(' ') : `Position for ${initialTitle || 'Software Engineer'}.`;

    const requirements = Array.from(detectedSkillsMap.values());

    return this._normalizeExtractedResult(
      {
        title: initialTitle || 'Software Engineer',
        employer: initialEmployer || 'Organization',
        location: /remote/i.test(text.slice(0, 3000)) ? 'Remote' : '',
        employmentType: /intern/i.test(text.slice(0, 3000)) ? 'Internship' : 'Full-time',
        roleSummary: roleSummary.slice(0, 400),
        responsibilities,
        qualifications,
        requirements,
        limitations: 'Extracted using deterministic rule-based analysis. Configure GEMINI_API_KEY or OPENAI_API_KEY for advanced LLM reasoning.',
      },
      text
    );
  }

  static _normalizeExtractedResult(raw, originalText) {
    const requiredSkills = [];
    const preferredSkills = [];
    const normalizedRequirements = [];

    const seenSkills = new Set();

    for (const req of raw.requirements || []) {
      const canonical = normalizeSkillName(req.name);
      if (!canonical || seenSkills.has(canonical)) continue;
      seenSkills.add(canonical);

      const isReq = req.importance === 'required';
      if (isReq) {
        requiredSkills.push(canonical);
      } else {
        preferredSkills.push(canonical);
      }

      normalizedRequirements.push({
        name: canonical,
        category: req.category || SKILL_TAXONOMY[canonical]?.category || 'General',
        importance: req.importance,
        isRequired: isReq,
        description: req.description || `Experience with ${canonical}`,
        source_excerpt: req.source_excerpt || '',
        confidence: req.confidence || 'high',
      });
    }

    return {
      title: raw.title?.trim() || 'Software Engineer',
      employer: raw.employer?.trim() || 'Organization',
      location: raw.location?.trim() || '',
      employmentType: raw.employmentType?.trim() || '',
      roleSummary: raw.roleSummary?.trim() || '',
      responsibilities: raw.responsibilities || [],
      qualifications: raw.qualifications || [],
      requiredSkills,
      preferredSkills,
      normalizedRequirements,
      limitations: raw.limitations || '',
    };
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
