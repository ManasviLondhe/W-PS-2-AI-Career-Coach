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
  title: z.string().default('Software Engineer'),
  employer: z.string().default('Organization'),
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
   * Attempts Gemini/OpenAI if configured; automatically falls back to deterministic parsing
   * if LLM credentials are absent, invalid, or exhausted.
   */
  static async extractRequirements({ text, initialTitle = '', initialEmployer = '', sourceUrl = '' }) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Cannot extract requirements: job posting text is empty.');
    }

    let fallbackReason = '';

    // Try Gemini if configured
    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        const result = await this._extractWithGemini({ text, initialTitle, initialEmployer });
        return {
          ...result,
          extractionMode: 'ai_llm',
        };
      } catch (err) {
        fallbackReason = `Gemini extraction failed (${err.message}). Extracted using deterministic rule-based analysis.`;
        console.warn(`[JobExtractor] ${fallbackReason}`);
      }
    } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      try {
        const result = await this._extractWithOpenAI({ text, initialTitle, initialEmployer });
        return {
          ...result,
          extractionMode: 'ai_llm',
        };
      } catch (err) {
        fallbackReason = `OpenAI extraction failed (${err.message}). Extracted using deterministic rule-based analysis.`;
        console.warn(`[JobExtractor] ${fallbackReason}`);
      }
    } else {
      fallbackReason = 'Extracted using deterministic rule-based analysis. Configure GEMINI_API_KEY for advanced AI reasoning.';
    }

    // High-quality deterministic extraction fallback
    const result = this._extractDeterministic({
      text,
      initialTitle,
      initialEmployer,
      sourceUrl,
      fallbackReason,
    });

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
      const errText = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const jsonErr = JSON.parse(errText);
        msg = jsonErr.error?.message || msg;
      } catch {}
      throw new Error(`Gemini API error: ${msg}`);
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
      const errText = await res.text();
      throw new Error(`OpenAI API error: HTTP ${res.status} ${errText.slice(0, 100)}`);
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
      "name": "Canonical skill name (e.g. Java, Python, C++, SQL, Algorithms, Data Structures, Distributed Systems, AWS, Docker, Testing)",
      "category": "Languages | Frameworks | Databases | Computer Science Fundamentals | Architecture / Infrastructure | DevOps | Quality Assurance",
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
  static _extractDeterministic({ text, initialTitle, initialEmployer, sourceUrl, fallbackReason = '' }) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const PREFERRED_SECTION_PATTERNS = [
      /^preferred\b/i,
      /preferred qualifications/i,
      /nice to have/i,
      /bonus points/i,
      /plus/i,
      /what would be great/i,
      /preferred skills/i,
      /desired qualifications/i,
      /what we'd love to see/i,
    ];

    const REQUIRED_SECTION_PATTERNS = [
      /^basic qualifications/i,
      /^requirements\b/i,
      /required qualifications/i,
      /minimum qualifications/i,
      /core competencies/i,
      /basic requirements/i,
      /what you will bring/i,
      /who you are/i,
    ];

    const RESPONSIBILITY_SECTION_PATTERNS = [
      /^responsibilities/i,
      /key job responsibilities/i,
      /what you will do/i,
      /what you'll do/i,
      /the role/i,
      /key duties/i,
      /your mission/i,
    ];

    const FOOTER_SECTION_PATTERNS = [
      /^job details/i,
      /^join us on/i,
      /^find careers/i,
      /^working at amazon/i,
      /^working at/i,
      /^about/i,
      /^equal opportunity/i,
    ];

    let currentSection = 'intro';
    const responsibilities = [];
    const qualifications = [];
    const detectedSkillsMap = new Map();

    for (const line of lines) {
      if (FOOTER_SECTION_PATTERNS.some((pat) => pat.test(line))) {
        currentSection = 'footer';
        continue;
      }
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

      if (currentSection === 'footer') {
        continue;
      }

      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
      const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();

      if (currentSection === 'responsibilities' && (isBullet || cleanLine.length > 25)) {
        if (responsibilities.length < 8 && cleanLine.length > 10) {
          responsibilities.push(cleanLine);
        }
      }
      if ((currentSection === 'required' || currentSection === 'preferred') && isBullet) {
        if (qualifications.length < 10 && cleanLine.length > 10) {
          qualifications.push(cleanLine);
        }
      }

      const lowerLine = line.toLowerCase();

      // Scan taxonomy
      for (const [canonical, meta] of Object.entries(SKILL_TAXONOMY)) {
        const matched = meta.synonyms.some((syn) => {
          const escaped = escapeRegex(syn);
          const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i');
          return regex.test(lowerLine);
        });

        if (matched) {
          const isExplicitRequired = currentSection === 'required';
          const isExplicitPreferred = currentSection === 'preferred';

          let importance = isExplicitRequired ? 'required' : 'preferred';
          let confidence = isExplicitRequired || isExplicitPreferred ? 'high' : 'medium';

          const existing = detectedSkillsMap.get(canonical);

          if (!existing) {
            detectedSkillsMap.set(canonical, {
              name: canonical,
              category: meta.category,
              importance,
              description: `Proficiency in ${canonical} as mentioned in the role posting.`,
              source_excerpt: cleanLine.slice(0, 250),
              confidence,
            });
          } else {
            // Upgrade importance if found in required section
            if (isExplicitRequired) {
              existing.importance = 'required';
              existing.source_excerpt = cleanLine.slice(0, 250);
              existing.confidence = 'high';
            } else if (isExplicitPreferred && existing.confidence === 'medium') {
              existing.importance = 'preferred';
              existing.source_excerpt = cleanLine.slice(0, 250);
              existing.confidence = 'high';
            }
          }
        }
      }
    }

    // Role summary from intro text
    const introLines = lines.slice(0, 10).filter(
      (l) => l.length > 50 && !l.includes(':') && !l.startsWith('•') && !l.startsWith('-')
    );
    const roleSummary =
      introLines.length > 0 ? introLines.slice(0, 2).join(' ') : `Position for ${initialTitle || 'Software Engineer'}.`;

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
        limitations: fallbackReason || 'Extracted using deterministic rule-based analysis.',
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

      // Check excerpt grounding against original text
      let excerpt = req.source_excerpt ? req.source_excerpt.trim() : '';
      let confidence = req.confidence || 'high';

      if (!excerpt || !originalText.toLowerCase().includes(excerpt.toLowerCase().slice(0, 30))) {
        // Try finding a matching line in originalText
        const lines = originalText.split(/\r?\n/);
        const matchingLine = lines.find((l) => l.toLowerCase().includes(canonical.toLowerCase()));
        if (matchingLine) {
          excerpt = matchingLine.replace(/^[•\-*]\s*/, '').trim().slice(0, 250);
        } else {
          confidence = 'medium';
        }
      }

      normalizedRequirements.push({
        name: canonical,
        category: req.category || SKILL_TAXONOMY[canonical]?.category || 'General',
        importance: req.importance,
        isRequired: isReq,
        description: req.description || `Experience with ${canonical}`,
        source_excerpt: excerpt,
        confidence,
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
