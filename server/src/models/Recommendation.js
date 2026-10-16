import mongoose from 'mongoose';

/**
 * Recommendation — persists a single actionable skill-gap recommendation
 * linked to an Assessment revision and a specific job requirement.
 *
 * Data-integrity rules enforced here and in the service layer:
 *  - Changing taskStatus NEVER changes the underlying skillResult.status.
 *  - The assessment and its skillResult are read-only from this model's perspective.
 *  - If the underlying assessment changes (new revision), the recommendation
 *    is marked stale via isStale=true; it is NOT automatically regenerated.
 */
const LearningResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ['documentation', 'tutorial', 'course', 'article', 'video', 'tool'],
      default: 'article',
    },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const RecommendationSchema = new mongoose.Schema(
  {
    // --- Context links ---
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    assessmentRevision: {
      type: Number,
      required: true,
    },
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

    // --- Skill-gap identity ---
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    requirementClassification: {
      type: String,
      enum: ['required', 'preferred'],
      default: 'required',
    },
    // Snapshot of the assessment status at recommendation generation time.
    // This is historical context — it MUST NOT be mutated by task completion.
    snapshotStatus: {
      type: String,
      enum: ['demonstrated', 'partially_demonstrated', 'not_demonstrated', 'unable_to_assess'],
      required: true,
    },
    snapshotExplanation: { type: String, default: '' },
    snapshotEvidenceIds: [{ type: String }],

    // --- Recommendation content ---
    title: {
      type: String,
      required: true,
      trim: true,
    },
    whyItMatters: { type: String, default: '' },
    whatCurrentEvidenceShows: { type: String, default: '' },
    whatRemainsMissing: { type: String, default: '' },
    implementationPlan: { type: String, default: '' },
    implementationSteps: [{ type: String }],
    acceptanceCriteria: [{ type: String }],
    suggestedTests: [{ type: String }],
    difficultyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    estimatedEffort: { type: String, default: '' },
    priority: {
      type: Number,
      default: 50,
      min: 1,
      max: 100,
    },
    learningResources: [LearningResourceSchema],

    // --- Generation metadata ---
    generationSource: {
      type: String,
      enum: ['gemini', 'openai', 'deterministic'],
      default: 'deterministic',
    },
    generationPromptVersion: { type: String, default: '1.0' },

    // --- Task progress tracking ---
    // Allowed transitions: pending → in_progress → completed (or back to in_progress)
    taskStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    taskNotes: { type: String, default: '' },
    taskCompletedAt: { type: Date, default: null },

    // --- Freshness tracking ---
    // Set to true when the linked assessment has been superseded by a newer revision.
    // Does NOT mean the recommendation is wrong — it means a rescan may be warranted.
    isStale: {
      type: Boolean,
      default: false,
    },
    stalenessReason: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Compound index: one set of recommendations per skill per assessment revision
RecommendationSchema.index({ assessment: 1, skill: 1 });
RecommendationSchema.index({ job: 1, repository: 1 });
RecommendationSchema.index({ taskStatus: 1 });
RecommendationSchema.index({ isStale: 1 });

export const Recommendation = mongoose.model('Recommendation', RecommendationSchema);
