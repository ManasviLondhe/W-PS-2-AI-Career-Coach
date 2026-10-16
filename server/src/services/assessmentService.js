import { Job, Repository, Evidence, Assessment } from '../models/index.js';
import { githubService } from './githubService.js';
import { EvidenceExtractor } from './evidenceExtractor.js';
import { ScoringService } from './scoringService.js';
import { AiCoachService } from './aiCoachService.js';
import { validateEvidenceItem } from './evidenceValidator.js';

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
    const skippedFiles = [];
    for (const item of filesToFetch) {
      const content = await githubService.getFileContent(repo.owner, repo.name, item.path, commitSha);
      if (content !== null) {
        retrievedFiles.push({ path: item.path, content });
      } else {
        skippedFiles.push(item.path);
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
      const validEvidenceItems = [];
      for (const evItem of extraction.evidenceItems) {
        let validatedEvidence;
        try {
          validatedEvidence = validateEvidenceItem(evItem, retrievedFiles, {
            owner: repo.owner,
            repo: repo.name,
            commitSha,
          });
        } catch (validationError) {
          console.warn(
            `[AssessmentService] Skipping invalid evidence for ${skill}: ${validationError.message}`
          );
          continue;
        }

        // Save to Evidence collection
        let evDoc = await Evidence.findOne({
          evidenceId: validatedEvidence.evidenceId,
          repository: repo._id,
          commitSha,
        });
        if (evDoc) {
          // The scoped lookup prevents reusing a citation from another
          // repository or commit.
        }

        if (!evDoc) {
          evDoc = new Evidence({
            evidenceId: validatedEvidence.evidenceId,
            repository: repo._id,
            commitSha: validatedEvidence.commitSha,
            filePath: validatedEvidence.filePath,
            lineRange: validatedEvidence.lineRange,
            skill: validatedEvidence.skill,
            evidenceType: validatedEvidence.evidenceType,
            codeExcerpt: validatedEvidence.codeExcerpt,
            explanation: validatedEvidence.explanation,
            sourcePermalink: validatedEvidence.sourcePermalink,
            confidence: validatedEvidence.confidence,
            limitations: validatedEvidence.limitations,
          });
          await evDoc.save();
        }
        evidenceMap[evDoc.evidenceId] = evDoc;
        skillEvidenceIds.push(evDoc.evidenceId);
        validEvidenceItems.push(evDoc);
      }

      let status = extraction.status;
      let confidence = extraction.confidence;
      if (validEvidenceItems.length === 0) {
        status = 'not_demonstrated';
        confidence = 'high';
      } else if (!validEvidenceItems.some((item) => item.confidence === 'high') && validEvidenceItems.length < 2) {
        status = 'partially_demonstrated';
        confidence = 'medium';
      } else {
        status = 'demonstrated';
        confidence = 'high';
      }

      preliminaryResults.push({
        skill,
        classification,
        status,
        evidenceIds: skillEvidenceIds,
        confidence,
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
        // AI recommendations are advisory; deterministic evidence remains
        // authoritative for status, confidence, rationale, and scope.
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
      inspectedScope: {
        files: retrievedFiles.map((file) => file.path),
        skippedFiles,
        limitations:
          skippedFiles.length > 0
            ? `${skippedFiles.length} source file(s) could not be retrieved from the pinned commit.`
            : 'All selected source files were retrieved from the pinned commit.',
      },
      skillResults: finalSkillResults,
      coverageScore: scoreResult.coverageScore,
      scoringConfiguration: scoreResult.config,
      limitations: scoreResult.explanation,
      triggeringEvent: {
        type: triggeringEvent.type || 'initial',
        commitSha,
        message: triggeringEvent.message || latestCommit.message || 'Analysis initiated',
      },
    });

    await assessment.save();

    // 10. Update repository tracked state
    repo.lastSuccessfullyAnalyzedSha = commitSha;
    repo.latestObservedSha = commitSha;
    repo.lastAnalysisTimestamp = new Date();
    repo.errorState = { message: '', timestamp: null };
    await repo.save();

    return assessment;
  }
}
