import mongoose from 'mongoose';

const ChangeEventSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    previousSha: {
      type: String,
      default: '',
    },
    newSha: {
      type: String,
      required: true,
    },
    commitMessage: {
      type: String,
      default: '',
    },
    author: {
      type: String,
      default: '',
    },
    changedFiles: [
      {
        filename: { type: String, required: true },
        status: {
          type: String,
          enum: ['added', 'modified', 'renamed', 'removed', 'unknown'],
          default: 'modified',
        },
        additions: { type: Number, default: 0 },
        deletions: { type: Number, default: 0 },
        changes: { type: Number, default: 0 },
      },
    ],
    affectedSkills: [{ type: String }],
    processingState: {
      type: String,
      enum: ['detected', 'analyzing', 'completed', 'failed'],
      default: 'detected',
    },
    resultingAssessmentRevision: {
      type: Number,
    },
    resultingAssessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
    },
    errorInformation: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

ChangeEventSchema.index({ repository: 1, newSha: 1 });
ChangeEventSchema.index({ createdAt: -1 });

export const ChangeEvent = mongoose.model('ChangeEvent', ChangeEventSchema);
