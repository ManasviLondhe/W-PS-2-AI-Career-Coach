import mongoose from 'mongoose';

const RepositorySchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    defaultBranch: {
      type: String,
      default: 'main',
    },
    stars: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: '',
    },
    trackingState: {
      type: String,
      enum: ['active', 'paused', 'error'],
      default: 'active',
    },
    latestObservedSha: {
      type: String,
      default: '',
    },
    lastSuccessfullyAnalyzedSha: {
      type: String,
      default: '',
    },
    pollingState: {
      isPolling: { type: Boolean, default: false },
      lastPolledAt: { type: Date },
      lastPollError: { type: String, default: '' },
      pollCount: { type: Number, default: 0 },
    },
    lastAnalysisTimestamp: {
      type: Date,
    },
    errorState: {
      message: { type: String, default: '' },
      timestamp: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

RepositorySchema.index({ trackingState: 1 });

export const Repository = mongoose.model('Repository', RepositorySchema);
