import { Job } from '../models/Job.js';
import { JobService } from '../services/jobService.js';
import { z } from 'zod';

export const analyzeUrlSchema = z.object({
  url: z.string().min(1, 'URL is required.'),
});

export const analyzeTextSchema = z.object({
  text: z.string().min(1, 'Job description text is required.'),
  title: z.string().optional(),
  employer: z.string().optional(),
});

export const importJobSchema = z.object({
  type: z.enum(['url', 'pasted']),
  url: z.string().optional(),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  employer: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  description: z.string().optional(),
  roleSummary: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  normalizedRequirements: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().optional(),
        isRequired: z.boolean().optional(),
        importance: z.enum(['required', 'preferred']).optional(),
        description: z.string().optional(),
        source_excerpt: z.string().optional(),
        confidence: z.enum(['high', 'medium', 'low']).optional(),
      })
    )
    .optional(),
  responsibilities: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
});

export const updateJobSchema = z.object({
  title: z.string().optional(),
  employer: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  roleSummary: z.string().optional(),
  description: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  normalizedRequirements: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().optional(),
        isRequired: z.boolean().optional(),
        importance: z.enum(['required', 'preferred']).optional(),
        description: z.string().optional(),
        source_excerpt: z.string().optional(),
        confidence: z.enum(['high', 'medium', 'low']).optional(),
      })
    )
    .optional(),
  responsibilities: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
});

export class JobController {
  static async listJobs(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
      const skip = (page - 1) * limit;

      const query = {};
      if (req.query.search) {
        const regex = new RegExp(req.query.search.trim(), 'i');
        query.$or = [{ title: regex }, { employer: regex }, { requiredSkills: regex }];
      }

      if (req.query.skill) {
        query.requiredSkills = req.query.skill;
      }

      if (req.query.sourceType) {
        query.sourceType = req.query.sourceType;
      }

      const [jobs, total] = await Promise.all([
        Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Job.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getJobById(req, res, next) {
    try {
      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ success: false, error: { message: 'Job requirement not found.' } });
      }
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Preview analysis of a public URL without saving yet.
   */
  static async analyzeUrl(req, res, next) {
    try {
      const { url } = req.validatedBody;
      const analysis = await JobService.analyzeUrl(url);
      res.json({ success: true, data: analysis });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Preview analysis of user-pasted text without saving yet.
   */
  static async analyzeText(req, res, next) {
    try {
      const { text, title, employer } = req.validatedBody;
      const analysis = await JobService.analyzeText({ text, title, employer });
      res.json({ success: true, data: analysis });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Save a job requirement (either directly or after reviewing analysis).
   */
  static async importJob(req, res, next) {
    try {
      const {
        type,
        url,
        sourceUrl,
        title,
        employer,
        location,
        employmentType,
        description,
        roleSummary,
        requiredSkills,
        preferredSkills,
        normalizedRequirements,
        responsibilities,
        qualifications,
      } = req.validatedBody;

      let job;
      if (type === 'url') {
        if (!url && !sourceUrl) {
          return res.status(400).json({ success: false, error: { message: 'URL is required for URL import.' } });
        }

        // If pre-analyzed metadata is passed (from review step), save directly
        if (title && employer && normalizedRequirements && normalizedRequirements.length > 0) {
          job = await JobService.createPastedJob({
            title,
            employer,
            location: location || '',
            employmentType: employmentType || '',
            description: description || '',
            roleSummary: roleSummary || '',
            requiredSkills: requiredSkills || [],
            preferredSkills: preferredSkills || [],
            normalizedRequirements,
            responsibilities: responsibilities || [],
            qualifications: qualifications || [],
            sourceUrl: url || sourceUrl || '',
          });
        } else {
          job = await JobService.importFromUrl(url || sourceUrl, title, employer);
        }
      } else {
        if (!title || !employer) {
          return res.status(400).json({ success: false, error: { message: 'Title and employer are required for pasted import.' } });
        }
        job = await JobService.createPastedJob({
          title,
          employer,
          location: location || '',
          employmentType: employmentType || '',
          description: description || '',
          roleSummary: roleSummary || '',
          requiredSkills: requiredSkills || [],
          preferredSkills: preferredSkills || [],
          normalizedRequirements: normalizedRequirements || [],
          responsibilities: responsibilities || [],
          qualifications: qualifications || [],
          sourceUrl: sourceUrl || '',
        });
      }

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing job.
   */
  static async updateJob(req, res, next) {
    try {
      const updated = await JobService.updateJob(req.params.id, req.validatedBody);
      res.json({ success: true, data: updated, message: 'Job requirement updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Re-extract requirements and skills from stored description.
   */
  static async retryAnalysis(req, res, next) {
    try {
      const job = await JobService.reExtractSkills(req.params.id);
      res.json({ success: true, data: job, message: 'Requirements re-analyzed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async extractSkills(req, res, next) {
    try {
      const job = await JobService.reExtractSkills(req.params.id);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  static async deleteJob(req, res, next) {
    try {
      const job = await Job.findByIdAndDelete(req.params.id);
      if (!job) {
        return res.status(404).json({ success: false, error: { message: 'Job not found.' } });
      }
      res.json({ success: true, message: 'Job deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }
}
