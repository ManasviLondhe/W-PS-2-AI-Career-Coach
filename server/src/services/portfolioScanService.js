import crypto from 'crypto';
import { PortfolioScan, Evidence, Repository } from '../models/index.js';
import { githubService } from './githubService.js';
import { PortfolioScannerService } from './portfolioScannerService.js';
import { PortfolioSkillAnalyzer } from './portfolioSkillAnalyzer.js';
import { env } from '../config/env.js';

export class PortfolioScanService {
  /**
   * Start a portfolio scan.
   * Can run synchronously or return a scanId immediately for async polling.
   */
  static async startScan({ username, repositories, runAsync = true, limits = {} }) {
    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      throw new Error('Please select at least one repository to scan.');
    }

    const maxRepos = limits.maxRepos || env.MAX_REPOSITORIES_PER_SCAN || 5;
    if (repositories.length > maxRepos) {
      throw new Error(`Exceeded maximum limit of ${maxRepos} repositories per scan.`);
    }

    const scanId = `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Resolve user profile if username is provided
    let githubUser = null;
    if (username && githubService.validateUsername(username)) {
      try {
        githubUser = await githubService.getUser(username);
      } catch (err) {
        // User may be a repo-only scan, proceed
      }
    }

    const scanRecord = new PortfolioScan({
      scanId,
      targetType: username ? 'user' : 'repository',
      githubUser: githubUser
        ? {
            login: githubUser.login,
            name: githubUser.name,
            avatarUrl: githubUser.avatarUrl,
            bio: githubUser.bio,
            htmlUrl: githubUser.htmlUrl,
            publicRepos: githubUser.publicRepos,
          }
        : undefined,
      repositories: [],
      status: 'in_progress',
      progress: {
        step: 'validating',
        percent: 5,
        message: 'Initializing scan and validating repository targets...',
        filesScanned: 0,
        totalFiles: 0,
      },
      scanTimestamp: new Date(),
    });

    await scanRecord.save();

    // If async requested, trigger background execution and return scanId immediately
    if (runAsync) {
      setImmediate(() => {
        this._runScanPipeline(scanId, { username, repositories, limits }).catch((err) => {
          console.error(`Background scan failed for ${scanId}:`, err);
        });
      });

      return {
        scanId,
        status: 'in_progress',
        message: 'Scan started in background.',
        progress: scanRecord.progress,
      };
    }

    // Synchronous execution
    return await this._runScanPipeline(scanId, { username, repositories, limits });
  }

  /**
   * Internal pipeline executing each scan step and updating MongoDB progress
   */
  static async _runScanPipeline(scanId, { username, repositories, limits }) {
    const startTime = Date.now();
    const scan = await PortfolioScan.findOne({ scanId });
    if (!scan) throw new Error(`Scan ${scanId} not found.`);

    try {
      // Step 1: Validating repositories and resolving exact commit SHAs
      await this._updateProgress(scan, {
        step: 'validating',
        percent: 15,
        message: `Validating ${repositories.length} repository target(s) and resolving commit SHAs...`,
      });

      const repoMetadataMap = {};
      const repoSnapshots = [];

      for (const target of repositories) {
        const { owner, repo: name } = githubService.parseRepoIdentifier(
          typeof target === 'string' ? target : target.repoUrl || `${target.owner}/${target.repo}`
        );

        const meta = await githubService.getRepository(owner, name);
        const selectedBranch = (typeof target === 'object' && target.branch) || meta.defaultBranch || 'main';
        const commit = await githubService.getLatestCommitSha(owner, name, selectedBranch);

        const snapshot = {
          owner,
          name,
          fullName: meta.fullName,
          url: meta.url,
          selectedBranch,
          commitSha: commit.sha,
          commitMessage: commit.message,
          commitDate: new Date(commit.date),
          stars: meta.stars,
          primaryLanguage: meta.language,
          description: meta.description,
        };

        repoSnapshots.push(snapshot);
        repoMetadataMap[meta.fullName] = snapshot;
      }

      scan.repositories = repoSnapshots;
      await scan.save();

      // Step 2 & 3: Tree Discovery and File Filtering
      await this._updateProgress(scan, {
        step: 'tree_discovery',
        percent: 30,
        message: 'Discovering file trees and applying security/binary filters...',
      });

      const allInspectable = [];
      const allSkipped = [];

      for (const repo of repoSnapshots) {
        const rawTree = await githubService.getRawFileTree(repo.owner, repo.name, repo.commitSha);
        const { inspectable, skipped } = PortfolioScannerService.filterTree(
          rawTree,
          repo.fullName,
          limits
        );

        allInspectable.push(...inspectable);
        allSkipped.push(...skipped);
      }

      scan.inspectedFiles = allInspectable;
      scan.skippedFiles = allSkipped;
      scan.progress.totalFiles = allInspectable.length;
      await scan.save();

      // Step 4: Source Content Retrieval
      await this._updateProgress(scan, {
        step: 'source_retrieval',
        percent: 50,
        message: `Fetching verified source code across ${allInspectable.length} file(s)...`,
      });

      const filesWithContent = [];

      for (const repo of repoSnapshots) {
        const repoFiles = allInspectable.filter((f) => f.repoFullName === repo.fullName);
        const contents = await PortfolioScannerService.retrieveFileContents(
          repo.owner,
          repo.name,
          repo.commitSha,
          repoFiles,
          (prog) => {
            // Live update progress without flooding DB
            scan.progress.filesScanned = filesWithContent.length + prog.processedCount;
            scan.progress.currentFile = prog.currentFile;
            scan.progress.currentRepo = repo.fullName;
          }
        );

        filesWithContent.push(...contents);
      }

      await this._updateProgress(scan, {
        step: 'skill_analysis',
        percent: 75,
        message: `Analyzing syntax, patterns, and framework implementations across ${filesWithContent.length} source file(s)...`,
      });

      // Step 5: Demonstrated Skill Analysis
      const analysisResult = await PortfolioSkillAnalyzer.analyzePortfolio(
        filesWithContent,
        repoMetadataMap
      );

      scan.findings = analysisResult.findings;
      scan.skillsSummary = analysisResult.skillsSummary;
      scan.languagesDetected = analysisResult.languagesDetected;
      scan.frameworksDetected = analysisResult.frameworksDetected;
      scan.analysisMode = analysisResult.analysisMode;
      scan.llmProvider = analysisResult.llmProvider;

      // Step 6: Finalizing & Persisting
      await this._updateProgress(scan, {
        step: 'saving',
        percent: 90,
        message: 'Persisting snapshot, evidence citations, and updating repository records...',
      });

      const durationMs = Date.now() - startTime;
      const totalBytes = filesWithContent.reduce((sum, f) => sum + (f.actualSize || f.size || 0), 0);

      scan.stats = {
        totalRepositories: repoSnapshots.length,
        totalFilesInspected: allInspectable.length,
        totalFilesSkipped: allSkipped.length,
        totalBytesInspected: totalBytes,
        totalFindings: analysisResult.findings.length,
        durationMs,
      };

      scan.status = 'completed';
      scan.progress = {
        step: 'completed',
        percent: 100,
        message: `Scan successfully completed in ${(durationMs / 1000).toFixed(1)}s. Identified ${analysisResult.skillsSummary.length} verified skill(s) across ${analysisResult.findings.length} evidence citation(s).`,
        filesScanned: filesWithContent.length,
        totalFiles: allInspectable.length,
      };

      await scan.save();

      // Mirror evidence items into Evidence collection for Feature 1 & 3 compatibility
      await this._mirrorToEvidenceCollection(scan, repoMetadataMap);

      // Ensure repositories are tracked in Repository model
      await this._syncWithRepositoryModel(repoSnapshots);

      return scan;
    } catch (err) {
      console.error(`Portfolio scan error for ${scanId}:`, err);
      scan.status = 'failed';
      scan.progress = {
        step: 'failed',
        percent: 100,
        message: `Scan failed: ${err.message}`,
        filesScanned: 0,
        totalFiles: 0,
      };
      scan.error = {
        message: err.message,
        code: err.code || 'SCAN_ERROR',
        details: err.stack,
      };
      await scan.save();
      throw err;
    }
  }

  static async _updateProgress(scan, { step, percent, message }) {
    scan.progress.step = step;
    scan.progress.percent = percent;
    scan.progress.message = message;
    await scan.save();
  }

  /**
   * Mirror findings into the existing Evidence collection for cross-feature integration
   */
  static async _mirrorToEvidenceCollection(scan, repoMetadataMap) {
    for (const f of scan.findings) {
      try {
        const repoMeta = repoMetadataMap[f.repoFullName];
        if (!repoMeta) continue;

        let repoDoc = await Repository.findOne({ fullName: f.repoFullName });
        if (!repoDoc) {
          repoDoc = new Repository({
            owner: repoMeta.owner,
            name: repoMeta.name,
            fullName: repoMeta.fullName,
            url: repoMeta.url,
            defaultBranch: repoMeta.selectedBranch || 'main',
            trackingState: 'active',
            latestObservedSha: repoMeta.commitSha,
            lastSuccessfullyAnalyzedSha: repoMeta.commitSha,
          });
          await repoDoc.save();
        }

        const existingEv = await Evidence.findOne({
          repository: repoDoc._id,
          commitSha: repoMeta.commitSha,
          filePath: f.filePath,
          skill: f.skill,
        });

        if (!existingEv) {
          const ev = new Evidence({
            evidenceId: f.findingId,
            repository: repoDoc._id,
            commitSha: repoMeta.commitSha,
            filePath: f.filePath,
            lineRange: f.lineRange,
            skill: f.skill,
            evidenceType: f.evidenceType,
            codeExcerpt: f.codeExcerpt,
            explanation: f.explanation,
            sourcePermalink: f.sourcePermalink,
            confidence: f.confidence,
            limitations: f.limitations,
          });
          await ev.save();
        }
      } catch (err) {
        // Non-blocking mirror error
      }
    }
  }

  /**
   * Sync scanned repositories with the Repository tracking collection
   */
  static async _syncWithRepositoryModel(repoSnapshots) {
    for (const snap of repoSnapshots) {
      try {
        let repo = await Repository.findOne({ fullName: snap.fullName });
        if (repo) {
          repo.latestObservedSha = snap.commitSha;
          repo.lastSuccessfullyAnalyzedSha = snap.commitSha;
          repo.lastAnalysisTimestamp = new Date();
          repo.stars = snap.stars;
          repo.description = snap.description;
          if (snap.primaryLanguage) repo.language = snap.primaryLanguage;
          await repo.save();
        } else {
          repo = new Repository({
            owner: snap.owner,
            name: snap.name,
            fullName: snap.fullName,
            url: snap.url,
            defaultBranch: snap.selectedBranch,
            stars: snap.stars,
            description: snap.description,
            language: snap.primaryLanguage,
            trackingState: 'active',
            latestObservedSha: snap.commitSha,
            lastSuccessfullyAnalyzedSha: snap.commitSha,
            lastAnalysisTimestamp: new Date(),
          });
          await repo.save();
        }
      } catch (err) {
        // Non-blocking sync error
      }
    }
  }

  /**
   * Retrieve scan status, progress and full details by scanId or _id
   */
  static async getScan(identifier) {
    let scan = await PortfolioScan.findOne({ scanId: identifier });
    if (!scan && /^[0-9a-fA-F]{24}$/.test(identifier)) {
      scan = await PortfolioScan.findById(identifier);
    }
    return scan;
  }

  /**
   * List previous scan snapshots with pagination
   */
  static async listScans({ username, repoFullName, page = 1, limit = 20 }) {
    const query = {};
    if (username) {
      query['githubUser.login'] = new RegExp(`^${username}$`, 'i');
    }
    if (repoFullName) {
      query['repositories.fullName'] = repoFullName;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [scans, total] = await Promise.all([
      PortfolioScan.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-inspectedFiles -skippedFiles') // omit large arrays for summary list
        .lean(),
      PortfolioScan.countDocuments(query),
    ]);

    return {
      scans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get scan history snapshots for a specific repository
   */
  static async getRepoHistory(owner, repo) {
    const fullName = `${owner}/${repo}`;
    return await PortfolioScan.find({ 'repositories.fullName': fullName })
      .sort({ createdAt: -1 })
      .select('-inspectedFiles -skippedFiles')
      .lean();
  }
}
