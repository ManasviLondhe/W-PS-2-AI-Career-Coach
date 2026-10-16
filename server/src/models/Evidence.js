import mongoose from 'mongoose';

const EvidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    commitSha: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    lineRange: {
      start: { type: Number, required: true },
      end: { type: Number, required: true },
    },
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    evidenceType: {
      type: String,
      enum: ['implementation', 'schema_query', 'test_behavior', 'configuration', 'workflow'],
      default: 'implementation',
    },
    codeExcerpt: {
      type: String,
      default: '',
    },
    explanation: {
      type: String,
      default: '',
    },
    sourcePermalink: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    limitations: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

EvidenceSchema.index({ repository: 1, commitSha: 1 });
EvidenceSchema.index({ skill: 1 });

export const Evidence = mongoose.model('Evidence', EvidenceSchema);
