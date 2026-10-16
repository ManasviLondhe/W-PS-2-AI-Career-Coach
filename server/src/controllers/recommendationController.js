/**
 * RecommendationController
 *
 * Handles HTTP routing for Feature 4 — Personalized Skill-Gap Analysis.
 * All endpoints read authoritative data from MongoDB; they do NOT trust
 * client-supplied skill statuses, classifications, or evidence.
 */

import { z } from 'zod';
import { Recommendation, Assessment } from '../models/index.js';
import { SkillGapAnalysisService } from '../services/skillGapAnalysisService.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const generateRecommendationsSchema = z.object({
  assessmentId: z.string().min(1, 'assessmentId is required.'),
  forceRegenerate: z.boolean().optional().default(false),
});

export const updateTaskProgressSchema = z.object({
  taskStatus: z.enum(['pending', 'in_progress', 'completed'], {
    errorMap: () => ({ message: 'taskStatus must be pending, in_progress, or completed.' }),
  }),
  taskNotes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Controller class
// ---------------------------------------------------------------------------

export class RecommendationController {
  /**
   * POST /api/recommendations/generate
   * Generate (or refresh) recommendations for a given assessment.
   * Idempotent — safe to call multiple times; uses upsert under the hood.
   */
  static async generateRecommendations(req, res, next) {
    try {
      const { assessmentId, forceRegenerate } = req.validatedBody;

      // Verify the assessment exists before calling the service
      const assessmentExists = await Assessment.exists({ _id: assessmentId });
      if (!assessmentExists) {
        return res.status(404).json({
          success: false,
          error: { message: `Assessment not found: ${assessmentId}`, code: 'NOT_FOUND' },
        });
      }

      const result = await SkillGapAnalysisService.generateRecommendations(assessmentId, {
        forceRegenerate,
      });

      return res.status(result.skipped ? 200 : 201).json({
        success: true,
        data: {
          recommendations: result.recommendations,
          source: result.source,
          cached: result.skipped,
          message: result.message || null,
          count: result.recommendations.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/recommendations
   * List recommendations. Supports filtering by assessmentId, jobId, repositoryId,
   * skill, taskStatus, and isStale.
   */
  static async listRecommendations(req, res, next) {
    try {
      const query = {};
      if (req.query.assessmentId) query.assessment = req.query.assessmentId;
      if (req.query.jobId) query.job = req.query.jobId;
      if (req.query.repositoryId) query.repository = req.query.repositoryId;
      if (req.query.skill) query.skill = new RegExp(req.query.skill, 'i');
      if (req.query.taskStatus) query.taskStatus = req.query.taskStatus;
      if (req.query.isStale !== undefined) query.isStale = req.query.isStale === 'true';

      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
      const skip = (page - 1) * limit;

      const [recommendations, total] = await Promise.all([
        Recommendation.find(query)
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('assessment', 'revisionNumber commitSha coverageScore createdAt')
          .populate('job', 'title employer')
          .populate('repository', 'fullName url')
          .lean(),
        Recommendation.countDocuments(query),
      ]);

      return res.json({
        success: true,
        data: {
          recommendations,
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

  /**
   * GET /api/recommendations/:id
   * Retrieve a single recommendation by its MongoDB ID.
   */
  static async getRecommendationById(req, res, next) {
    try {
      const rec = await Recommendation.findById(req.params.id)
        .populate('assessment', 'revisionNumber commitSha coverageScore createdAt skillResults')
        .populate('job', 'title employer originalSourceUrl normalizedRequirements')
        .populate('repository', 'fullName url language')
        .lean();

      if (!rec) {
        return res.status(404).json({
          success: false,
          error: { message: 'Recommendation not found.', code: 'NOT_FOUND' },
        });
      }

      return res.json({ success: true, data: rec });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/recommendations/:id/progress
   * Update task progress for a recommendation.
   *
   * DATA INTEGRITY: This endpoint ONLY updates taskStatus and taskNotes.
   * It NEVER modifies the Assessment, skillResults, or any evidence record.
   */
  static async updateTaskProgress(req, res, next) {
    try {
      const { taskStatus, taskNotes } = req.validatedBody;

      const updated = await SkillGapAnalysisService.updateTaskProgress(req.params.id, {
        taskStatus,
        taskNotes,
      });

      return res.json({
        success: true,
        data: updated,
        message: `Task marked as "${taskStatus}". Note: this does not change the skill assessment. The repository must be rescanned for the assessment status to update.`,
      });
    } catch (err) {
      if (err.status === 404 || err.status === 400) {
        return res.status(err.status).json({
          success: false,
          error: { message: err.message, code: err.status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR' },
        });
      }
      next(err);
    }
  }

  /**
   * GET /api/recommendations/by-assessment/:assessmentId
   * Convenience endpoint: get all recommendations for a specific assessment.
   * Returns them sorted by priority descending (required + not_demonstrated first).
   */
  static async getByAssessment(req, res, next) {
    try {
      const { assessmentId } = req.params;

      // Verify assessment exists
      const assessment = await Assessment.findById(assessmentId)
        .populate('job', 'title employer')
        .populate('repository', 'fullName url language')
        .lean();

      if (!assessment) {
        return res.status(404).json({
          success: false,
          error: { message: `Assessment not found: ${assessmentId}`, code: 'NOT_FOUND' },
        });
      }

      const recommendations = await Recommendation.find({ assessment: assessmentId })
        .sort({ priority: -1, createdAt: -1 })
        .lean();

      // Summarize skill statuses from the assessment for context
      const skillSummary = (assessment.skillResults || []).map((sr) => ({
        skill: sr.skill,
        classification: sr.classification,
        status: sr.status,
        confidence: sr.confidence,
      }));

      return res.json({
        success: true,
        data: {
          assessment: {
            _id: assessment._id,
            revisionNumber: assessment.revisionNumber,
            commitSha: assessment.commitSha,
            coverageScore: assessment.coverageScore,
            createdAt: assessment.createdAt,
            job: assessment.job,
            repository: assessment.repository,
          },
          skillSummary,
          recommendations,
          counts: {
            total: recommendations.length,
            pending: recommendations.filter((r) => r.taskStatus === 'pending').length,
            inProgress: recommendations.filter((r) => r.taskStatus === 'in_progress').length,
            completed: recommendations.filter((r) => r.taskStatus === 'completed').length,
            stale: recommendations.filter((r) => r.isStale).length,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
