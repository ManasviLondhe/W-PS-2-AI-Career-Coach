import mongoose from 'mongoose';
import { ChangeEvent, Assessment, Repository } from '../models/index.js';
import { pollingWorker } from '../workers/pollingWorker.js';
import { githubService } from '../services/githubService.js';
import { env } from '../config/env.js';

export class ActivityController {
  static async getActivity(req, res, next) {
    try {
      const limit = Math.min(50, parseInt(req.query.limit || '20', 10));

      const [changeEvents, recentAssessments] = await Promise.all([
        ChangeEvent.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('repository', 'fullName url')
          .populate('resultingAssessment', 'revisionNumber coverageScore')
          .lean(),
        Assessment.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('job', 'title employer')
          .populate('repository', 'fullName')
          .lean(),
      ]);

      res.json({
        success: true,
        data: {
          changeEvents,
          recentAssessments,
          workerStatus: pollingWorker.getStatus(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getActivityByAssessment(req, res, next) {
    try {
      const events = await ChangeEvent.find({ resultingAssessment: req.params.assessmentId })
        .sort({ createdAt: -1 })
        .populate('repository', 'fullName url')
        .lean();

      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  }

  static async getHealth(req, res, next) {
    try {
      const dbState = mongoose.connection.readyState;
      const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: {
          status: dbStatus,
          connected: dbState === 1,
        },
        worker: pollingWorker.getStatus(),
        githubRateLimit: githubService.getRateLimitStatus(),
        llm: {
          provider: env.LLM_PROVIDER,
          configured: Boolean(
            (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) ||
              (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) ||
              env.LLM_PROVIDER === 'deterministic'
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
