import mongoose from 'mongoose';

const FindingSchema = new mongoose.Schema(
  {
    findingId: { type: String, required: true },
    skill: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'Languages',
        'Frontend',
        'Backend',
        'Databases',
        'Architecture',
        'Security',
        'Testing',
        'DevOps',
        'APIs',
        'General',
      ],
      default: 'General',
    },
    evidenceType: {
      type: String,
      enum: ['implementation', 'dependency', 'test', 'configuration', 'documentation', 'workflow'],
      default: 'implementation',
    },
    repoFullName: { type: String, required: true },
    filePath: { type: String, required: true },
    lineRange: {
      start: { type: Number, required: true },
      end: { type: Number, required: true },
    },
    codeExcerpt: { type: String, default: '' },
    explanation: { type: String, required: true },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    limitations: { type: String, default: '' },
    sourcePermalink: { type: String, required: true },
  },
  { _id: false }
);

const InspectedFileSchema = new mongoose.Schema(
  {
    repoFullName: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, default: 0 },
    language: { type: String, default: '' },
    type: { type: String, default: 'source' },
  },
  { _id: false }
);

const SkippedFileSchema = new mongoose.Schema(
  {
    repoFullName: { type: String, required: true },
    path: { type: String, required: true },
    reason: { type: String, required: true },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const RepositorySnapshotSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    url: { type: String, required: true },
    selectedBranch: { type: String, default: 'main' },
    commitSha: { type: String, required: true },
    commitMessage: { type: String, default: '' },
    commitDate: { type: Date },
    stars: { type: Number, default: 0 },
    primaryLanguage: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const PortfolioScanSchema = new mongoose.Schema(
  {
    scanId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'repository'],
      default: 'repository',
    },
    githubUser: {
      login: { type: String },
      name: { type: String },
      avatarUrl: { type: String },
      bio: { type: String },
      htmlUrl: { type: String },
      publicRepos: { type: Number },
    },
    repositories: [RepositorySnapshotSchema],
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      step: { type: String, default: 'queued' },
      percent: { type: Number, default: 0 },
      message: { type: String, default: 'Scan initialized' },
      currentRepo: { type: String, default: '' },
      currentFile: { type: String, default: '' },
      filesScanned: { type: Number, default: 0 },
      totalFiles: { type: Number, default: 0 },
    },
    inspectedFiles: [InspectedFileSchema],
    skippedFiles: [SkippedFileSchema],
    findings: [FindingSchema],
    skillsSummary: [
      {
        skill: { type: String, required: true },
        category: { type: String, default: 'General' },
        count: { type: Number, default: 1 },
        highestConfidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        evidenceTypes: [{ type: String }],
      },
    ],
    languagesDetected: [{ type: String }],
    frameworksDetected: [{ type: String }],
    scopeStatement: {
      type: String,
      default:
        'This assessment evaluates concrete, authentic code implementations identified within the inspected repository scope at the verified commit SHA. It does not reflect external repositories or unanalyzed contributions.',
    },
    analysisMode: {
      type: String,
      enum: ['deterministic', 'llm'],
      default: 'deterministic',
    },
    llmProvider: { type: String, default: 'deterministic' },
    stats: {
      totalRepositories: { type: Number, default: 0 },
      totalFilesInspected: { type: Number, default: 0 },
      totalFilesSkipped: { type: Number, default: 0 },
      totalBytesInspected: { type: Number, default: 0 },
      totalFindings: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    error: {
      message: { type: String, default: '' },
      code: { type: String, default: '' },
      details: { type: mongoose.Schema.Types.Mixed },
    },
    scanTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PortfolioScanSchema.index({ 'githubUser.login': 1, createdAt: -1 });
PortfolioScanSchema.index({ 'repositories.fullName': 1, createdAt: -1 });
PortfolioScanSchema.index({ 'repositories.commitSha': 1 });

export const PortfolioScan = mongoose.model('PortfolioScan', PortfolioScanSchema);
