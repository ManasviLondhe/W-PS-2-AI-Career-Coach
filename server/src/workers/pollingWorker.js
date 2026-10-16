import { Repository, Job, Assessment, ChangeEvent } from '../models/index.js';
import { githubService } from '../services/githubService.js';
import { AssessmentService } from '../services/assessmentService.js';
import { sseService } from './sseService.js';
import { env } from '../config/env.js';

export class PollingWorker {
  constructor() {
    this.intervalId = null;
    this.isPolling = false;
    this.activeRepoIds = new Set();
    this.pollCount = 0;
    this.lastPollTime = null;
    this.lastError = null;
  }

  start() {
    if (this.intervalId) return;
    console.log(`[Worker] Starting background repository polling worker (interval: ${env.POLL_INTERVAL_MS}ms)...`);
    this.intervalId = setInterval(() => {
      this.pollCycle().catch((err) => {
        console.error('[Worker] Error in poll cycle:', err.message);
        this.lastError = { message: err.message, timestamp: new Date() };
      });
    }, env.POLL_INTERVAL_MS);

    // Run first cycle immediately
    this.pollCycle().catch((err) => {
      console.error('[Worker] Initial poll error:', err.message);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Worker] Polling worker stopped.');
    }
  }

  getStatus() {
    return {
      isRunning: Boolean(this.intervalId),
      pollCount: this.pollCount,
      lastPollTime: this.lastPollTime,
      activeRepoPolls: Array.from(this.activeRepoIds),
      lastError: this.lastError,
      connectedClients: sseService.getConnectedCount(),
    };
  }

  async pollCycle() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollCount++;
    this.lastPollTime = new Date();

    try {
      // Check rate limit safety
      const rateInfo = githubService.getRateLimitStatus();
      if (rateInfo.remaining < 3) {
        console.warn(`[Worker] GitHub rate limit low (${rateInfo.remaining} remaining). Backing off.`);
        return;
      }

      // Fetch active repositories
      const repos = await Repository.find({ trackingState: 'active' })
        .limit(env.MAX_CONCURRENT_POLLS * 2)
        .exec();

      for (const repo of repos) {
        if (this.activeRepoIds.has(repo._id.toString())) {
          continue; // Overlap prevention
        }

        if (this.activeRepoIds.size >= env.MAX_CONCURRENT_POLLS) {
          break; // Bounded concurrency
        }

        this.activeRepoIds.add(repo._id.toString());
        this._processRepository(repo)
          .catch((err) => {
            console.error(`[Worker] Error checking ${repo.fullName}:`, err.message);
            repo.pollingState.lastPollError = err.message;
            repo.save().catch(() => {});
          })
          .finally(() => {
            this.activeRepoIds.delete(repo._id.toString());
          });
      }
    } finally {
      this.isPolling = false;
    }
  }

  async _processRepository(repo) {
    repo.pollingState.isPolling = true;
    repo.pollingState.lastPolledAt = new Date();
    repo.pollingState.pollCount = (repo.pollingState.pollCount || 0) + 1;
    await repo.save();

    let latest;
    try {
      latest = await githubService.getLatestCommitSha(repo.owner, repo.name, repo.defaultBranch);
    } catch (err) {
      repo.pollingState.isPolling = false;
      repo.pollingState.lastPollError = err.message;
      await repo.save();
      return;
    }

    const previousSha = repo.lastSuccessfullyAnalyzedSha;
    const newSha = latest.sha;

    // Check if new commit detected
    if (previousSha && previousSha !== newSha) {
      console.log(`[Worker] New commit detected on ${repo.fullName}: ${previousSha.slice(0, 7)} -> ${newSha.slice(0, 7)}`);

      // 1. Fetch commit diff/comparison
      let diffData;
      try {
        diffData = await githubService.compareCommits(repo.owner, repo.name, previousSha, newSha);
      } catch (diffErr) {
        console.warn(`[Worker] Commit compare failed (${diffErr.message}), falling back to single commit review.`);
        diffData = { changedFiles: [] };
      }

      // Map changed files to affected skills
      const affectedSkills = this._mapFilesToSkills(diffData.changedFiles);

      // 2. Create ChangeEvent in DB
      const changeEvent = new ChangeEvent({
        repository: repo._id,
        previousSha,
        newSha,
        commitMessage: latest.message,
        author: latest.author,
        changedFiles: diffData.changedFiles,
        affectedSkills,
        processingState: 'analyzing',
      });
      await changeEvent.save();

      // Notify SSE subscribers
      sseService.broadcast('commit_detected', {
        repository: repo.fullName,
        previousSha,
        newSha,
        commitMessage: latest.message,
        changedFiles: diffData.changedFiles,
        affectedSkills,
        eventId: changeEvent._id,
      });

      // 3. Find all jobs associated with this repository
      const previousAssessments = await Assessment.find({ repository: repo._id });
      const jobIds = Array.from(new Set(previousAssessments.map((a) => a.job.toString())));

      // If no prior assessment was run, run against all available jobs
      if (jobIds.length === 0) {
        const anyJobs = await Job.find().limit(3);
        for (const j of anyJobs) jobIds.push(j._id.toString());
      }

      let lastAssessment = null;
      for (const jobId of jobIds) {
        try {
          const newAssessment = await AssessmentService.runAssessment(jobId, repo._id, {
            type: 'commit_detected',
            commitSha: newSha,
            message: latest.message,
          });
          lastAssessment = newAssessment;

          // Notify frontend
          sseService.broadcast('assessment_updated', {
            assessmentId: newAssessment._id,
            revisionNumber: newAssessment.revisionNumber,
            coverageScore: newAssessment.coverageScore,
            commitSha: newSha,
            repository: repo.fullName,
          });
        } catch (reassessErr) {
          console.error(`[Worker] Reassessment error for job ${jobId}:`, reassessErr.message);
        }
      }

      // 4. Finalize ChangeEvent
      changeEvent.processingState = 'completed';
      if (lastAssessment) {
        changeEvent.resultingAssessmentRevision = lastAssessment.revisionNumber;
        changeEvent.resultingAssessment = lastAssessment._id;
      }
      await changeEvent.save();

      console.log(`[Worker] Completed automatic reassessment for ${repo.fullName} at revision ${lastAssessment?.revisionNumber || 'N/A'}`);
    } else {
      // No change detected
      repo.latestObservedSha = newSha;
    }

    repo.pollingState.isPolling = false;
    repo.pollingState.lastPollError = '';
    await repo.save();
  }

  _mapFilesToSkills(changedFiles) {
    const skills = new Set();
    for (const file of changedFiles) {
      const p = file.filename.toLowerCase();
      if (p.endsWith('.sql') || /(db|dao|queries|database)/.test(p)) skills.add('SQL');
      if (p.endsWith('.java')) skills.add('Java');
      if (/\.(jsx|tsx)$/.test(p) || /(component|view|page)/.test(p)) skills.add('React');
      if (/\.(js|ts)$/.test(p) && /(server|app|route|controller|middleware)/.test(p)) skills.add('Node.js');
      if (p.endsWith('.js') || p.endsWith('.mjs')) skills.add('JavaScript');
      if (p.endsWith('.ts') || p.endsWith('.tsx')) skills.add('TypeScript');
      if (p.endsWith('.py')) skills.add('Python');
      if (/(model|schema|mongo)/.test(p)) skills.add('MongoDB');
      if (/(api|route|endpoint)/.test(p)) skills.add('REST APIs');
      if (/(test|spec)/.test(p)) skills.add('Testing');
      if (p.includes('.github/workflows/')) skills.add('CI/CD');
      if (/docker/i.test(p)) skills.add('Docker');
    }
    return Array.from(skills);
  }
}

export const pollingWorker = new PollingWorker();
