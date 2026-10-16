import { Job } from '../models/Job.js';
import { JobService } from '../services/jobService.js';
import { z } from 'zod';

export const importJobSchema = z.object({
  type: z.enum(['url', 'pasted']),
  url: z.string().optional(),
  title: z.string().optional(),
  employer: z.string().optional(),
  description: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
});

export class JobController {
  static async listJobs(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
      const skip = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        Job.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Job.countDocuments(),
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
        return res.status(404).json({ success: false, error: { message: 'Job not found.' } });
      }
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  static async importJob(req, res, next) {
    try {
      const { type, url, title, employer, description, requiredSkills, preferredSkills } = req.validatedBody;

      let job;
      if (type === 'url') {
        if (!url) {
          return res.status(400).json({ success: false, error: { message: 'URL is required for URL import.' } });
        }
        job = await JobService.importFromUrl(url, title, employer);
      } else {
        if (!title || !employer) {
          return res.status(400).json({ success: false, error: { message: 'Title and employer are required for pasted import.' } });
        }
        job = await JobService.createPastedJob({
          title,
          employer,
          description: description || '',
          requiredSkills: requiredSkills || [],
          preferredSkills: preferredSkills || [],
        });
      }

      res.status(201).json({ success: true, data: job });
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

  static async extractSkills(req, res, next) {
    try {
      const job = await JobService.reExtractSkills(req.params.id);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
}
