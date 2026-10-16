import mongoose from 'mongoose';

const AssessmentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    revisionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    commitSha: {
      type: String,
      required: true,
      trim: true,
    },
    inspectedScope: {
      files: [{ type: String, trim: true }],
      skippedFiles: [{ type: String, trim: true }],
      limitations: { type: String, default: '' },
    },
    skillResults: [
      {
        skill: { type: String, required: true },
        classification: { type: String, enum: ['required', 'preferred'], default: 'required' },
        status: {
          type: String,
          enum: ['demonstrated', 'partially_demonstrated', 'not_demonstrated'],
          required: true,
        },
        evidenceIds: [{ type: String }],
        confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        explanation: { type: String, default: '' },
        limitations: { type: String, default: '' },
        recommendations: [{ type: String }],
        lastAnalysisTimestamp: { type: Date, default: Date.now },
      },
    ],
    coverageScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    scoringConfiguration: {
      requiredWeight: { type: Number, default: 2.0 },
      preferredWeight: { type: Number, default: 1.0 },
      demonstratedScore: { type: Number, default: 1.0 },
      partiallyDemonstratedScore: { type: Number, default: 0.5 },
      notDemonstratedScore: { type: Number, default: 0.0 },
      formula: {
        type: String,
        default: 'Coverage = 100 * sum(weight * evidence_score) / sum(weight)',
      },
    },
    limitations: {
      type: String,
      default:
        'Assessment evaluates explicit code implementation within the analyzed repository scope and does not reflect skills gained through other projects or unanalyzed repositories.',
    },
    triggeringEvent: {
      type: {
        type: String,
        enum: ['manual', 'commit_detected', 'initial'],
        default: 'initial',
      },
      commitSha: { type: String, default: '' },
      message: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

AssessmentSchema.index({ job: 1, repository: 1, revisionNumber: 1 }, { unique: true });
AssessmentSchema.index({ repository: 1, createdAt: -1 });

export const Assessment = mongoose.model('Assessment', AssessmentSchema);
