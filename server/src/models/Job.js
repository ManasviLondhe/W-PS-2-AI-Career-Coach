import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    employer: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    employmentType: {
      type: String,
      default: '',
      trim: true,
    },
    roleSummary: {
      type: String,
      default: '',
      trim: true,
    },
    originalSourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedSourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ['greenhouse', 'lever', 'manual_url', 'pasted'],
      default: 'pasted',
    },
    sourceVerificationState: {
      type: String,
      enum: ['verified_api', 'verified_url', 'unverified_pasted', 'unverified_failed'],
      default: 'unverified_pasted',
    },
    description: {
      type: String,
      default: '',
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    preferredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    normalizedRequirements: [
      {
        name: { type: String, required: true },
        category: { type: String, default: 'General' },
        isRequired: { type: Boolean, default: true },
        importance: { type: String, enum: ['required', 'preferred'], default: 'required' },
        description: { type: String, default: '' },
        source_excerpt: { type: String, default: '' },
        confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
      },
    ],
    responsibilities: [
      {
        type: String,
        trim: true,
      },
    ],
    qualifications: [
      {
        type: String,
        trim: true,
      },
    ],
    extractionStatus: {
      type: String,
      enum: ['completed', 'partial', 'failed'],
      default: 'completed',
    },
    extractionMode: {
      type: String,
      enum: ['ai_llm', 'deterministic'],
      default: 'deterministic',
    },
    extractionLimitations: {
      type: String,
      default: '',
    },
    retrievalTimestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
JobSchema.index({ employer: 1, title: 1 });
JobSchema.index({ originalSourceUrl: 1 });
JobSchema.index({ createdAt: -1 });

export const Job = mongoose.model('Job', JobSchema);
