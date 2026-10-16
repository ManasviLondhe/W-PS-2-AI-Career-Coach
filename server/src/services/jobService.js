import { Job } from '../models/Job.js';
import { validateSafeUrl, validateRedirectUrl } from '../utils/ssrfProtection.js';
import { extractJobFromHtml } from '../utils/htmlExtractor.js';
import { JobExtractionService } from './jobExtractionService.js';
import { normalizeSkillName, SKILL_TAXONOMY } from './skillDictionary.js';

const MAX_RESPONSE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB maximum
const MAX_REDIRECTS = 4;

export class JobService {
  /**
   * Safe public URL fetcher with SSRF-safe redirect following and size limits.
   */
  static async fetchUrlContent(rawUrl) {
    let currentUrl = validateSafeUrl(rawUrl);
    let originalUrl = currentUrl.href;
    let resolvedUrl = currentUrl.href;
    let redirectsCount = 0;

    // Check for Greenhouse API match
    const ghMatch = originalUrl.match(/boards(?:\.greenhouse\.io|-api\.greenhouse\.io\/v1\/boards)\/([^/]+)\/jobs\/(\d+)/i);
    if (ghMatch) {
      return this._fetchGreenhouse(ghMatch[1], ghMatch[2], originalUrl);
    }

    // Check for Lever API match
    const leverMatch = originalUrl.match(/(?:jobs\.lever\.co|api\.lever\.co\/v0\/postings)\/([^/]+)\/([a-f0-9-]+)/i);
    if (leverMatch) {
      return this._fetchLever(leverMatch[1], leverMatch[2], originalUrl);
    }

    // Generic HTTP fetch loop with SSRF-safe redirect validation
    while (redirectsCount <= MAX_REDIRECTS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let response;
      try {
        response = await fetch(currentUrl.href, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkillProofAI/1.0 (Public Job Requirement Parser)',
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'manual', // Manual redirect control to validate each target against SSRF!
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Connection timed out while retrieving the job posting URL.');
        }
        throw new Error(`Failed to connect to job URL: ${fetchErr.message}`);
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle Redirects safely
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const redirectLocation = response.headers.get('location');
        if (!redirectLocation) {
          throw new Error(`Received redirect HTTP ${response.status} without Location header.`);
        }

        // Validate redirect location against SSRF
        currentUrl = validateRedirectUrl(redirectLocation, currentUrl.href);
        resolvedUrl = currentUrl.href;
        redirectsCount++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Remote job source returned HTTP ${response.status} (${response.statusText || 'Error'}).`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain') &&
        !contentType.includes('application/xhtml+xml') &&
        !contentType.includes('application/json')
      ) {
        throw new Error(`Unsupported content type "${contentType}". Only public web postings are supported.`);
      }

      const rawHtml = await response.text();
      if (rawHtml.length > MAX_RESPONSE_BYTES) {
        throw new Error('Remote posting exceeds maximum size limit (2.5 MB).');
      }

      const parsed = extractJobFromHtml(rawHtml, resolvedUrl);

      return {
        originalUrl,
        resolvedUrl,
        sourceType: 'manual_url',
        sourceVerificationState: 'verified_url',
        title: parsed.title,
        employer: parsed.employer,
        location: parsed.location,
        employmentType: parsed.employmentType,
        description: parsed.description,
      };
    }

    throw new Error('Too many redirects encountered while resolving job URL.');
  }

  /**
   * Preview analysis from a public URL without immediate persistence.
   */
  static async analyzeUrl(rawUrl) {
    const fetched = await this.fetchUrlContent(rawUrl);
    const extracted = await JobExtractionService.extractRequirements({
      text: fetched.description,
      initialTitle: fetched.title,
      initialEmployer: fetched.employer,
      sourceUrl: fetched.resolvedUrl,
    });

    return {
      ...fetched,
      ...extracted,
      title: extracted.title || fetched.title,
      employer: extracted.employer || fetched.employer,
      location: extracted.location || fetched.location,
      employmentType: extracted.employmentType || fetched.employmentType,
    };
  }

  /**
   * Preview analysis from user-pasted text.
   */
  static async analyzeText({ text, title = '', employer = '' }) {
    if (!text || text.trim().length === 0) {
      throw new Error('Job description text cannot be empty.');
    }

    const extracted = await JobExtractionService.extractRequirements({
      text: text.trim(),
      initialTitle: title.trim(),
      initialEmployer: employer.trim(),
    });

    return {
      originalUrl: '',
      resolvedUrl: '',
      sourceType: 'pasted',
      sourceVerificationState: 'unverified_pasted',
      description: text.trim(),
      ...extracted,
      title: extracted.title || title || 'Software Engineer',
      employer: extracted.employer || employer || 'Organization',
    };
  }

  /**
   * Import and save a job from a public URL.
   */
  static async importFromUrl(rawUrl, manualTitle = '', manualEmployer = '') {
    const analysis = await this.analyzeUrl(rawUrl);

    const job = new Job({
      title: manualTitle.trim() || analysis.title,
      employer: manualEmployer.trim() || analysis.employer,
      location: analysis.location || '',
      employmentType: analysis.employmentType || '',
      roleSummary: analysis.roleSummary || '',
      originalSourceUrl: analysis.originalUrl,
      resolvedSourceUrl: analysis.resolvedUrl,
      sourceType: analysis.sourceType,
      sourceVerificationState: analysis.sourceVerificationState,
      description: analysis.description,
      requiredSkills: analysis.requiredSkills,
      preferredSkills: analysis.preferredSkills,
      normalizedRequirements: analysis.normalizedRequirements,
      responsibilities: analysis.responsibilities,
      qualifications: analysis.qualifications,
      extractionStatus: 'completed',
      extractionMode: analysis.extractionMode,
      extractionLimitations: analysis.limitations,
      retrievalTimestamp: new Date(),
    });

    await job.save();
    return job;
  }

  /**
   * Create and save a job from user-pasted text or confirmed analysis.
   */
  static async createPastedJob({
    title,
    employer,
    location = '',
    employmentType = '',
    description = '',
    roleSummary = '',
    requiredSkills = [],
    preferredSkills = [],
    normalizedRequirements = [],
    responsibilities = [],
    qualifications = [],
    sourceUrl = '',
  }) {
    if (!title || !employer) {
      throw new Error('Title and employer are required.');
    }

    let finalRequired = requiredSkills;
    let finalPreferred = preferredSkills;
    let finalNormalized = normalizedRequirements;

    // If normalized requirements not pre-supplied, run extraction
    if (!finalNormalized || finalNormalized.length === 0) {
      const extracted = await JobExtractionService.extractRequirements({
        text: description || `${title}\n${employer}`,
        initialTitle: title,
        initialEmployer: employer,
      });

      finalRequired = Array.from(new Set([...finalRequired, ...extracted.requiredSkills]));
      finalPreferred = Array.from(new Set([...finalPreferred, ...extracted.preferredSkills]));
      finalNormalized = extracted.normalizedRequirements;
    }

    const job = new Job({
      title: title.trim(),
      employer: employer.trim(),
      location: location.trim(),
      employmentType: employmentType.trim(),
      roleSummary: roleSummary.trim(),
      originalSourceUrl: sourceUrl.trim(),
      resolvedSourceUrl: sourceUrl.trim(),
      sourceType: sourceUrl ? 'manual_url' : 'pasted',
      sourceVerificationState: sourceUrl ? 'verified_url' : 'unverified_pasted',
      description: description || '',
      requiredSkills: finalRequired,
      preferredSkills: finalPreferred,
      normalizedRequirements: finalNormalized,
      responsibilities,
      qualifications,
      extractionStatus: 'completed',
      extractionMode: 'deterministic',
      extractionLimitations: sourceUrl
        ? 'Saved requirement verified against external URL.'
        : 'User-provided job description; not independently verified against external URL.',
      retrievalTimestamp: new Date(),
    });

    await job.save();
    return job;
  }

  /**
   * Update an existing job with user corrections.
   */
  static async updateJob(jobId, updates) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    if (updates.title) job.title = updates.title.trim();
    if (updates.employer) job.employer = updates.employer.trim();
    if (updates.location !== undefined) job.location = updates.location.trim();
    if (updates.employmentType !== undefined) job.employmentType = updates.employmentType.trim();
    if (updates.roleSummary !== undefined) job.roleSummary = updates.roleSummary.trim();
    if (updates.description !== undefined) job.description = updates.description;

    if (Array.isArray(updates.requiredSkills)) {
      job.requiredSkills = updates.requiredSkills.map(normalizeSkillName).filter(Boolean);
    }
    if (Array.isArray(updates.preferredSkills)) {
      job.preferredSkills = updates.preferredSkills.map(normalizeSkillName).filter(Boolean);
    }

    if (Array.isArray(updates.normalizedRequirements)) {
      job.normalizedRequirements = updates.normalizedRequirements.map((r) => ({
        name: normalizeSkillName(r.name) || r.name,
        category: r.category || SKILL_TAXONOMY[r.name]?.category || 'General',
        isRequired: r.importance === 'required' || r.isRequired === true,
        importance: r.importance || (r.isRequired ? 'required' : 'preferred'),
        description: r.description || `Experience with ${r.name}`,
        source_excerpt: r.source_excerpt || '',
        confidence: r.confidence || 'high',
      }));

      // Keep required/preferred skill string arrays synchronized
      job.requiredSkills = job.normalizedRequirements.filter((r) => r.isRequired).map((r) => r.name);
      job.preferredSkills = job.normalizedRequirements.filter((r) => !r.isRequired).map((r) => r.name);
    }

    if (Array.isArray(updates.responsibilities)) job.responsibilities = updates.responsibilities;
    if (Array.isArray(updates.qualifications)) job.qualifications = updates.qualifications;

    await job.save();
    return job;
  }

  /**
   * Re-extract requirements and skills from stored job description.
   */
  static async reExtractSkills(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const extracted = await JobExtractionService.extractRequirements({
      text: job.description || `${job.title}\n${job.employer}`,
      initialTitle: job.title,
      initialEmployer: job.employer,
      sourceUrl: job.originalSourceUrl,
    });

    job.requiredSkills = extracted.requiredSkills;
    job.preferredSkills = extracted.preferredSkills;
    job.normalizedRequirements = extracted.normalizedRequirements;
    if (extracted.roleSummary && !job.roleSummary) job.roleSummary = extracted.roleSummary;
    if (extracted.responsibilities?.length > 0 && (!job.responsibilities || job.responsibilities.length === 0)) {
      job.responsibilities = extracted.responsibilities;
    }
    if (extracted.qualifications?.length > 0 && (!job.qualifications || job.qualifications.length === 0)) {
      job.qualifications = extracted.qualifications;
    }
    job.extractionMode = extracted.extractionMode;
    job.extractionLimitations = extracted.limitations;
    job.extractionStatus = 'completed';

    await job.save();
    return job;
  }

  // --- Internal Platform API Fetchers ---

  static async _fetchGreenhouse(boardToken, jobId, originalUrl) {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`;
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Greenhouse API responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const cleanText = extractJobFromHtml(data.content || '', originalUrl).description;

    return {
      originalUrl,
      resolvedUrl: originalUrl,
      sourceType: 'greenhouse',
      sourceVerificationState: 'verified_api',
      title: data.title || 'Software Engineer',
      employer: boardToken.charAt(0).toUpperCase() + boardToken.slice(1),
      location: data.location?.name || '',
      employmentType: 'Full-time',
      description: cleanText,
    };
  }

  static async _fetchLever(company, postingId, originalUrl) {
    const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(postingId)}`;
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Lever API responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const listsText = (data.lists || []).map((l) => `${l.text}\n${l.content}`).join('\n');
    const combinedHtml = `${data.description || ''}\n${listsText}`;
    const cleanText = extractJobFromHtml(combinedHtml, originalUrl).description;

    return {
      originalUrl,
      resolvedUrl: originalUrl,
      sourceType: 'lever',
      sourceVerificationState: 'verified_api',
      title: data.text || 'Software Engineer',
      employer: company.charAt(0).toUpperCase() + company.slice(1),
      location: [data.categories?.location, data.categories?.commitment].filter(Boolean).join(' · '),
      employmentType: data.categories?.commitment || 'Full-time',
      description: cleanText,
    };
  }
}
