import { Assessment, Job, Repository, Evidence, ChangeEvent } from '../models/index.js';
import { AssessmentService } from '../services/assessmentService.js';
import { z } from 'zod';

export const runAssessmentSchema = z.object({
  jobId: z.string().min(1, 'jobId is required.'),
  repositoryId: z.string().min(1, 'repositoryId is required.'),
});

export class AssessmentController {
  static async listAssessments(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
      const skip = (page - 1) * limit;

      const query = {};
      if (req.query.jobId) query.job = req.query.jobId;
      if (req.query.repositoryId) query.repository = req.query.repositoryId;

      const [assessments, total] = await Promise.all([
        Assessment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('job', 'title employer originalSourceUrl')
          .populate('repository', 'fullName url defaultBranch')
          .lean(),
        Assessment.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          assessments,
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

  static async createAssessment(req, res, next) {
    try {
      const { jobId, repositoryId } = req.validatedBody;
      const assessment = await AssessmentService.runAssessment(jobId, repositoryId, {
        type: 'manual',
        message: 'Analysis initiated manually from dashboard',
      });

      res.status(201).json({ success: true, data: assessment });
    } catch (err) {
      next(err);
    }
  }

  static async getAssessmentById(req, res, next) {
    try {
      const assessment = await Assessment.findById(req.params.id)
        .populate('job')
        .populate('repository')
        .lean();

      if (!assessment) {
        return res.status(404).json({ success: false, error: { message: 'Assessment not found.' } });
      }

      // Collect all evidence IDs across all skills
      const allEvIds = [];
      for (const sr of assessment.skillResults || []) {
        if (sr.evidenceIds) allEvIds.push(...sr.evidenceIds);
      }

      const evidences = await Evidence.find({
        evidenceId: { $in: allEvIds },
        repository: assessment.repository._id || assessment.repository,
        commitSha: assessment.commitSha,
      }).lean();
      const evidenceMap = {};
      for (const ev of evidences) {
        evidenceMap[ev.evidenceId] = ev;
      }

      res.json({
        success: true,
        data: {
          ...assessment,
          evidenceMap,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAssessmentHistory(req, res, next) {
    try {
      const target = await Assessment.findById(req.params.id);
      if (!target) {
        return res.status(404).json({ success: false, error: { message: 'Assessment not found.' } });
      }

      const history = await Assessment.find({
        job: target.job,
        repository: target.repository,
      })
        .sort({ revisionNumber: -1 })
        .populate('job', 'title employer')
        .populate('repository', 'fullName url')
        .lean();

      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  static async compareAssessments(req, res, next) {
    try {
      const current = await Assessment.findById(req.params.id)
        .populate('job')
        .populate('repository')
        .lean();

      if (!current) {
        return res.status(404).json({ success: false, error: { message: 'Assessment not found.' } });
      }

      let previous = null;
      if (req.query.compareWith) {
        if (req.query.compareWith.match(/^[0-9a-fA-F]{24}$/)) {
          previous = await Assessment.findById(req.query.compareWith).lean();
        } else {
          previous = await Assessment.findOne({
            job: current.job._id || current.job,
            repository: current.repository._id || current.repository,
            revisionNumber: parseInt(req.query.compareWith, 10),
          }).lean();
        }
      } else {
        previous = await Assessment.findOne({
          job: current.job._id || current.job,
          repository: current.repository._id || current.repository,
          revisionNumber: { $lt: current.revisionNumber },
        })
          .sort({ revisionNumber: -1 })
          .lean();
      }

      // Collect all evidence IDs
      const allEvIds = [];
      for (const sr of current.skillResults || []) {
        if (sr.evidenceIds) allEvIds.push(...sr.evidenceIds);
      }
      if (previous) {
        for (const sr of previous.skillResults || []) {
          if (sr.evidenceIds) allEvIds.push(...sr.evidenceIds);
        }
      }

      const repositoryId = current.repository._id || current.repository;
      const evidences = await Evidence.find({
        evidenceId: { $in: allEvIds },
        repository: repositoryId,
      }).lean();
      const evidenceMap = {};
      for (const ev of evidences) {
        evidenceMap[ev.evidenceId] = ev;
      }

      // Compute diff of skills
      const comparison = [];
      const prevSkillMap = new Map();
      if (previous && previous.skillResults) {
        for (const sr of previous.skillResults) {
          prevSkillMap.set(sr.skill.toLowerCase(), sr);
        }
      }

      for (const currSkill of current.skillResults || []) {
        const prevSkill = prevSkillMap.get(currSkill.skill.toLowerCase());
        const statusChanged = prevSkill ? prevSkill.status !== currSkill.status : true;
        const previousStatus = prevSkill ? prevSkill.status : 'not_assessed';

        const prevEvIds = new Set(prevSkill?.evidenceIds || []);
        const newEvidenceIds = (currSkill.evidenceIds || []).filter((id) => !prevEvIds.has(id));

        comparison.push({
          skill: currSkill.skill,
          classification: currSkill.classification,
          currentStatus: currSkill.status,
          previousStatus,
          statusChanged,
          newEvidenceIds,
          currentExplanation: currSkill.explanation,
          previousExplanation: prevSkill?.explanation || 'No prior assessment recorded.',
          currentConfidence: currSkill.confidence,
          previousConfidence: prevSkill?.confidence || 'N/A',
        });
      }

      // Find change event associated with this revision if any
      const changeEvent = await ChangeEvent.findOne({
        resultingAssessment: current._id,
      })
        .populate('repository', 'fullName url')
        .lean();

      res.json({
        success: true,
        data: {
          current,
          previous,
          comparison,
          evidenceMap,
          changeEvent,
          coverageDiff: previous ? current.coverageScore - previous.coverageScore : 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLatestByRepo(req, res, next) {
    try {
      const assessment = await Assessment.findOne({ repository: req.params.repositoryId })
        .sort({ createdAt: -1 })
        .populate('job')
        .populate('repository')
        .lean();

      if (!assessment) {
        return res.status(404).json({ success: false, error: { message: 'No assessment found for this repository.' } });
      }

      const allEvIds = [];
      for (const sr of assessment.skillResults || []) {
        if (sr.evidenceIds) allEvIds.push(...sr.evidenceIds);
      }

      const evidences = await Evidence.find({
        evidenceId: { $in: allEvIds },
        repository: assessment.repository._id || assessment.repository,
        commitSha: assessment.commitSha,
      }).lean();
      const evidenceMap = {};
      for (const ev of evidences) {
        evidenceMap[ev.evidenceId] = ev;
      }

      res.json({
        success: true,
        data: {
          ...assessment,
          evidenceMap,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getEvidenceById(req, res, next) {
    try {
      const ev = await Evidence.findOne({ evidenceId: req.params.evidenceId }).populate('repository');
      if (!ev) {
        return res.status(404).json({ success: false, error: { message: 'Evidence not found.' } });
      }
      res.json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  }

  static async listEvidence(req, res, next) {
    try {
      const query = {};
      if (req.query.repositoryId) query.repository = req.query.repositoryId;
      if (req.query.skill) query.skill = req.query.skill;
      if (req.query.commitSha) query.commitSha = req.query.commitSha;

      const items = await Evidence.find(query).sort({ createdAt: -1 }).limit(100).lean();
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }
}
