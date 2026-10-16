import { Job } from '../models/Job.js';
import { validateSafeUrl } from '../utils/ssrfProtection.js';
import { extractSkillsFromText, normalizeSkillName, SKILL_TAXONOMY } from './skillDictionary.js';

export class JobService {
  /**
   * Import job from an external URL (Greenhouse, Lever, or generic web page)
   */
  static async importFromUrl(rawUrl, manualTitle = '', manualEmployer = '') {
    const parsedUrl = validateSafeUrl(rawUrl);
    const href = parsedUrl.href;

    // Check for Greenhouse
    const ghMatch = href.match(/boards(?:\.greenhouse\.io|-api\.greenhouse\.io\/v1\/boards)\/([^/]+)\/jobs\/(\d+)/i);
    if (ghMatch) {
      return this._importGreenhouseJob(ghMatch[1], ghMatch[2], href);
    }

    // Check for Lever
    const leverMatch = href.match(/(?:jobs\.lever\.co|api\.lever\.co\/v0\/postings)\/([^/]+)\/([a-f0-9-]+)/i);
    if (leverMatch) {
      return this._importLeverJob(leverMatch[1], leverMatch[2], href);
    }

    // Generic URL fetch
    return this._importGenericUrl(parsedUrl, manualTitle, manualEmployer);
  }

  /**
   * Import job via Greenhouse public API
   */
  static async _importGreenhouseJob(boardToken, jobId, originalUrl) {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`;
    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Greenhouse API responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = this._stripHtml(data.content || '');
      const skills = extractSkillsFromText(`${data.title}\n${rawText}`);

      const job = new Job({
        title: data.title || 'Software Engineer',
        employer: boardToken.charAt(0).toUpperCase() + boardToken.slice(1),
        originalSourceUrl: originalUrl,
        sourceType: 'greenhouse',
        sourceVerificationState: 'verified_api',
        description: rawText,
        requiredSkills: skills.requiredSkills,
        preferredSkills: skills.preferredSkills,
        normalizedRequirements: skills.normalizedRequirements,
        retrievalTimestamp: new Date(),
      });

      await job.save();
      return job;
    } catch (err) {
      throw new Error(`Failed to import Greenhouse job: ${err.message}`);
    }
  }

  /**
   * Import job via Lever public API
   */
  static async _importLeverJob(company, postingId, originalUrl) {
    const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(postingId)}`;
    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Lever API responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = `${data.descriptionPlain || this._stripHtml(data.description || '')}\n${(data.lists || []).map((l) => `${l.text}\n${this._stripHtml(l.content)}`).join('\n')}`;
      const skills = extractSkillsFromText(`${data.text}\n${rawText}`);

      const job = new Job({
        title: data.text || 'Software Engineer',
        employer: company.charAt(0).toUpperCase() + company.slice(1),
        originalSourceUrl: originalUrl,
        sourceType: 'lever',
        sourceVerificationState: 'verified_api',
        description: rawText,
        requiredSkills: skills.requiredSkills,
        preferredSkills: skills.preferredSkills,
        normalizedRequirements: skills.normalizedRequirements,
        retrievalTimestamp: new Date(),
      });

      await job.save();
      return job;
    } catch (err) {
      throw new Error(`Failed to import Lever job: ${err.message}`);
    }
  }

  /**
   * Generic URL fetch with HTML extraction and validation
   */
  static async _importGenericUrl(parsedUrl, manualTitle = '', manualEmployer = '') {
    try {
      const response = await fetch(parsedUrl.href, {
        headers: {
          'User-Agent': 'SkillProofAI/1.0 (Portfolio & Evidence Skill Verifier)',
          Accept: 'text/html,application/xhtml+xml,text/plain',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status}`);
      }

      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : '';

      const rawText = this._stripHtml(html);
      const skills = extractSkillsFromText(rawText);

      // Determine employer and title
      const employer = manualEmployer || parsedUrl.hostname.replace(/^www\./, '');
      const title = manualTitle || pageTitle || 'Software Role';

      const job = new Job({
        title,
        employer,
        originalSourceUrl: parsedUrl.href,
        sourceType: 'manual_url',
        sourceVerificationState: 'verified_url',
        description: rawText.slice(0, 15000), // bounded storage
        requiredSkills: skills.requiredSkills,
        preferredSkills: skills.preferredSkills,
        normalizedRequirements: skills.normalizedRequirements,
        retrievalTimestamp: new Date(),
      });

      await job.save();
      return job;
    } catch (err) {
      throw new Error(`Failed to import from URL: ${err.message}`);
    }
  }

  /**
   * Create a job from pasted text
   */
  static async createPastedJob({ title, employer, description, requiredSkills = [], preferredSkills = [] }) {
    if (!title || !employer) {
      throw new Error('Title and employer are required.');
    }

    let skills = extractSkillsFromText(description || '');

    // Allow user to supply or supplement skills explicitly
    if (requiredSkills.length > 0 || preferredSkills.length > 0) {
      const explicitRequired = requiredSkills.map(normalizeSkillName).filter(Boolean);
      const explicitPreferred = preferredSkills.map(normalizeSkillName).filter(Boolean);

      const mergedRequired = Array.from(new Set([...skills.requiredSkills, ...explicitRequired]));
      const mergedPreferred = Array.from(
        new Set([...skills.preferredSkills, ...explicitPreferred].filter((s) => !mergedRequired.includes(s)))
      );

      const normalizedRequirements = [
        ...mergedRequired.map((s) => ({
          name: s,
          category: SKILL_TAXONOMY[s]?.category || 'General',
          isRequired: true,
        })),
        ...mergedPreferred.map((s) => ({
          name: s,
          category: SKILL_TAXONOMY[s]?.category || 'General',
          isRequired: false,
        })),
      ];

      skills = {
        requiredSkills: mergedRequired,
        preferredSkills: mergedPreferred,
        normalizedRequirements,
      };
    }

    const job = new Job({
      title: title.trim(),
      employer: employer.trim(),
      originalSourceUrl: '',
      sourceType: 'pasted',
      sourceVerificationState: 'unverified_pasted',
      description: description || '',
      requiredSkills: skills.requiredSkills,
      preferredSkills: skills.preferredSkills,
      normalizedRequirements: skills.normalizedRequirements,
      retrievalTimestamp: new Date(),
    });

    await job.save();
    return job;
  }

  static _stripHtml(html) {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Re-extract skills from stored job description
   */
  static async reExtractSkills(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const skills = extractSkillsFromText(job.description || `${job.title}\n${job.employer}`);
    job.requiredSkills = skills.requiredSkills;
    job.preferredSkills = skills.preferredSkills;
    job.normalizedRequirements = skills.normalizedRequirements;
    await job.save();
    return job;
  }
}
