import { Job, Repository, Evidence, Assessment } from '../models/index.js';
import { githubService } from './githubService.js';
import { EvidenceExtractor } from './evidenceExtractor.js';
import { ScoringService } from './scoringService.js';
import { AiCoachService } from './aiCoachService.js';
import { SkillGapAnalysisService } from './skillGapAnalysisService.js';

export class AssessmentService {
  /**
   * Run full assessment of a repository against a job requirement set.
   * @param {string} jobId
   * @param {string} repositoryId
   * @param {Object} [triggeringEvent] - { type: 'manual' | 'commit_detected' | 'initial', commitSha, message }
   */
  static async runAssessment(jobId, repositoryId, triggeringEvent = { type: 'initial' }) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const repo = await Repository.findById(repositoryId);
    if (!repo) throw new Error(`Repository not found: ${repositoryId}`);

    // 1. Fetch latest commit SHA if not set
    const latestCommit = await githubService.getLatestCommitSha(repo.owner, repo.name, repo.defaultBranch);
    const commitSha = latestCommit.sha;

    // 2. Fetch file tree
    const tree = await githubService.getFileTree(repo.owner, repo.name, commitSha);

    // 3. Fetch content for relevant files (bounded up to 60 relevant code files)
    const filesToFetch = tree
      .filter((item) => {
        const p = item.path.toLowerCase();
        return (
          p.endsWith('.js') ||
          p.endsWith('.jsx') ||
          p.endsWith('.ts') ||
          p.endsWith('.tsx') ||
          p.endsWith('.java') ||
          p.endsWith('.py') ||
          p.endsWith('.sql') ||
          p.endsWith('.json') ||
          p.endsWith('.yml') ||
          p.endsWith('.yaml') ||
          p.endsWith('dockerfile') ||
          p.endsWith('.gitignore')
        );
      })
      .slice(0, 60);

    const retrievedFiles = [];
    for (const item of filesToFetch) {
      const content = await githubService.getFileContent(repo.owner, repo.name, item.path, commitSha);
      if (content !== null) {
        retrievedFiles.push({ path: item.path, content });
      }
    }

    // 4. Combine all job skills (required + preferred)
    const allSkills = [
      ...job.requiredSkills.map((s) => ({ skill: s, classification: 'required' })),
      ...job.preferredSkills.map((s) => ({ skill: s, classification: 'preferred' })),
    ];

    // Ensure we don't have duplicate skill names
    const uniqueSkillsMap = new Map();
    for (const item of allSkills) {
      if (!uniqueSkillsMap.has(item.skill)) {
        uniqueSkillsMap.set(item.skill, item.classification);
      }
    }

    const savedEvidenceDocs = [];
    const evidenceMap = {};
    const preliminaryResults = [];

    // 5. Extract evidence for each skill
    for (const [skill, classification] of uniqueSkillsMap.entries()) {
      const extraction = EvidenceExtractor.extractEvidenceForSkill(skill, retrievedFiles, {
        owner: repo.owner,
        repo: repo.name,
        commitSha,
      });

      const skillEvidenceIds = [];
      for (const evItem of extraction.evidenceItems) {
        // Save to Evidence collection
        let evDoc = await Evidence.findOne({ evidenceId: evItem.evidenceId });
        if (!evDoc) {
          evDoc = new Evidence({
            evidenceId: evItem.evidenceId,
            repository: repo._id,
            commitSha: evItem.commitSha,
            filePath: evItem.filePath,
            lineRange: evItem.lineRange,
            skill: evItem.skill,
            evidenceType: evItem.evidenceType,
            codeExcerpt: evItem.codeExcerpt,
            explanation: evItem.explanation,
            sourcePermalink: evItem.sourcePermalink,
            confidence: evItem.confidence,
            limitations: evItem.limitations,
          });
          await evDoc.save();
        }
        savedEvidenceDocs.push(evDoc);
        evidenceMap[evDoc.evidenceId] = evDoc;
        skillEvidenceIds.push(evDoc.evidenceId);
      }

      preliminaryResults.push({
        skill,
        classification,
        status: extraction.status,
        evidenceIds: skillEvidenceIds,
        confidence: extraction.confidence,
        explanation: extraction.explanation,
        limitations: extraction.limitations,
        recommendations: [],
        lastAnalysisTimestamp: new Date(),
      });
    }

    // 6. Enrich with AI Career Coach insights
    const coachData = await AiCoachService.generateCoaching({
      job,
      repo,
      skillAssessments: preliminaryResults,
      evidenceMap,
    });

    const finalSkillResults = preliminaryResults.map((pr) => {
      const insight = coachData.skillInsights?.find((si) => si.skill.toLowerCase() === pr.skill.toLowerCase());
      return {
        ...pr,
        explanation: insight?.explanation || pr.explanation,
        limitations: insight?.limitations || pr.limitations,
        recommendations: insight?.recommendations || [],
      };
    });

    // 7. Calculate deterministic coverage score
    const scoreResult = ScoringService.calculateCoverage(finalSkillResults);

    // 8. Determine revision number
    const latestAssessment = await Assessment.findOne({
      job: job._id,
      repository: repo._id,
    }).sort({ revisionNumber: -1 });

    const nextRevision = latestAssessment ? latestAssessment.revisionNumber + 1 : 1;

    // 9. Save immutable Assessment document
    const assessment = new Assessment({
      job: job._id,
      repository: repo._id,
      revisionNumber: nextRevision,
      commitSha,
      skillResults: finalSkillResults,
      coverageScore: scoreResult.coverageScore,
      scoringConfiguration: scoreResult.config,
      limitations: coachData.overallSummary || scoreResult.explanation,
      triggeringEvent: {
        type: triggeringEvent.type || 'initial',
        commitSha,
        message: triggeringEvent.message || latestCommit.message || 'Analysis initiated',
      },
    });

    await assessment.save();

    // 10. Mark any existing skill-gap recommendations for this job+repo as stale,
    //     since a newer assessment revision now supersedes them.
    //     This is a best-effort operation — failure here does not fail the assessment.
    try {
      await SkillGapAnalysisService.markRecommendationsStale(
        job._id.toString(),
        repo._id.toString(),
        assessment._id.toString(),
        nextRevision
      );
    } catch (staleErr) {
      console.warn(`[AssessmentService] Failed to mark recommendations stale: ${staleErr.message}`);
    }

    // 11. Update repository tracked state
    repo.lastSuccessfullyAnalyzedSha = commitSha;
    repo.latestObservedSha = commitSha;
    repo.lastAnalysisTimestamp = new Date();
    repo.errorState = { message: '', timestamp: null };
    await repo.save();

    return assessment;
  }
}
