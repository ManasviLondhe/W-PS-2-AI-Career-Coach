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
    originalSourceUrl: {
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
      },
    ],
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

export const Job = mongoose.model('Job', JobSchema);
