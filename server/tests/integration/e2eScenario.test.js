import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { Job, Repository, Assessment, Evidence, ChangeEvent } from '../../src/models/index.js';
import { AssessmentService } from '../../src/services/assessmentService.js';
import { githubService } from '../../src/services/githubService.js';
import { pollingWorker } from '../../src/workers/pollingWorker.js';

describe('Mandatory End-to-End Scenario: Java Present -> SQL Missing -> SQL Added -> Automatic Reassessment', () => {
  let job;
  let repo;
  let initialAssessment;

  before(async () => {
    await connectDatabase();

    // 1. Create target job requiring Java and SQL
    job = new Job({
      title: 'Backend Software Engineer',
      employer: 'Stripe',
      originalSourceUrl: 'https://stripe.com/jobs/backend-software-engineer',
      sourceType: 'manual_url',
      sourceVerificationState: 'verified_url',
      description: 'Requirements: Java, SQL, REST APIs, Git, Testing.',
      requiredSkills: ['Java', 'SQL', 'REST APIs', 'Git', 'Testing'],
      preferredSkills: ['Docker'],
      normalizedRequirements: [
        { name: 'Java', category: 'Languages', isRequired: true },
        { name: 'SQL', category: 'Databases', isRequired: true },
        { name: 'REST APIs', category: 'Architecture', isRequired: true },
        { name: 'Git', category: 'DevOps', isRequired: true },
        { name: 'Testing', category: 'QA', isRequired: true },
      ],
    });
    await job.save();

    // 2. Create tracked repository
    repo = new Repository({
      owner: 'student',
      name: 'payment-microservice',
      fullName: 'student/payment-microservice',
      url: 'https://github.com/student/payment-microservice',
      defaultBranch: 'main',
      trackingState: 'active',
      latestObservedSha: '1111111111111111111111111111111111111111',
      lastSuccessfullyAnalyzedSha: '',
    });
    await repo.save();
  });

  after(async () => {
    await disconnectDatabase();
  });

  test('Step 1 & 2: Initial assessment has Java demonstrated and SQL "Not demonstrated in analyzed scope"', async () => {
    // Mock GitHub service files for commit 1: Has Java, but NO SQL
    const commit1Sha = '1111111111111111111111111111111111111111';
    
    // Save original methods
    const originalGetCommit = githubService.getLatestCommitSha;
    const originalGetTree = githubService.getFileTree;
    const originalGetContent = githubService.getFileContent;

    githubService.getLatestCommitSha = async () => ({
      sha: commit1Sha,
      message: 'Initial Java Spring Boot payment service',
      author: 'Student Developer',
      date: new Date().toISOString(),
    });

    githubService.getFileTree = async () => [
      { path: 'src/main/java/PaymentService.java', type: 'blob' },
      { path: 'README.md', type: 'blob' },
    ];

    githubService.getFileContent = async (owner, r, path) => {
      if (path === 'src/main/java/PaymentService.java') {
        return `
package com.stripe.payment;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {
    public void executePayment() {}
}
        `.trim();
      }
      return '# Payment Microservice';
    };

    try {
      initialAssessment = await AssessmentService.runAssessment(job._id, repo._id, {
        type: 'initial',
        commitSha: commit1Sha,
        message: 'Initial baseline assessment',
      });

      assert.equal(initialAssessment.revisionNumber, 1);
      assert.equal(initialAssessment.commitSha, commit1Sha);

      // Check Java verdict: Must be Demonstrated
      const javaResult = initialAssessment.skillResults.find((s) => s.skill === 'Java');
      assert.ok(javaResult);
      assert.equal(javaResult.status, 'demonstrated');
      assert.ok(javaResult.evidenceIds.length > 0);

      // Check SQL verdict: Must be "not_demonstrated" in analyzed scope
      const sqlResult = initialAssessment.skillResults.find((s) => s.skill === 'SQL');
      assert.ok(sqlResult);
      assert.equal(sqlResult.status, 'not_demonstrated');
      assert.equal(sqlResult.evidenceIds.length, 0);
      assert.match(sqlResult.explanation, /No (verifiable|qualifying) implementation of SQL/);
    } finally {
      githubService.getLatestCommitSha = originalGetCommit;
      githubService.getFileTree = originalGetTree;
      githubService.getFileContent = originalGetContent;
    }
  });

  test('Step 3 & 4: New commit adds database/queries.sql -> Worker detects change -> Reassesses SQL to Demonstrated', async () => {
    const commit2Sha = '2222222222222222222222222222222222222222';

    // Mock commit 2: Adds database/queries.sql
    const originalGetCommit = githubService.getLatestCommitSha;
    const originalGetTree = githubService.getFileTree;
    const originalGetContent = githubService.getFileContent;
    const originalCompare = githubService.compareCommits;

    githubService.getLatestCommitSha = async () => ({
      sha: commit2Sha,
      message: 'feat: add database queries and payment schema',
      author: 'Student Developer',
      date: new Date().toISOString(),
    });

    githubService.compareCommits = async () => ({
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 1,
      changedFiles: [
        {
          filename: 'database/queries.sql',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
        },
      ],
    });

    githubService.getFileTree = async () => [
      { path: 'src/main/java/PaymentService.java', type: 'blob' },
      { path: 'database/queries.sql', type: 'blob' },
      { path: 'README.md', type: 'blob' },
    ];

    githubService.getFileContent = async (owner, r, path) => {
      if (path === 'src/main/java/PaymentService.java') {
        return '@Service public class PaymentService {}';
      }
      if (path === 'database/queries.sql') {
        return `
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL
);

SELECT id, amount, status FROM payments WHERE id = $1;
        `.trim();
      }
      return '# Payment Microservice';
    };

    try {
      // Execute background worker cycle on repo
      const freshRepo = await Repository.findById(repo._id);
      await pollingWorker._processRepository(freshRepo);

      // Verify a ChangeEvent was created
      const changeEvents = await ChangeEvent.find({ repository: repo._id });
      assert.ok(changeEvents.length >= 1);
      const latestChange = changeEvents[changeEvents.length - 1];
      assert.equal(latestChange.previousSha, initialAssessment.commitSha);
      assert.equal(latestChange.newSha, commit2Sha);
      assert.ok(latestChange.affectedSkills.includes('SQL'));

      // Verify that Revision #2 was generated
      const rev2Assessment = await Assessment.findOne({
        job: job._id,
        repository: repo._id,
        revisionNumber: 2,
      });

      assert.ok(rev2Assessment, 'Revision 2 must be created');
      assert.equal(rev2Assessment.commitSha, commit2Sha);

      // Verify SQL status transitioned to Demonstrated!
      const sqlResultRev2 = rev2Assessment.skillResults.find((s) => s.skill === 'SQL');
      assert.ok(sqlResultRev2);
      assert.equal(sqlResultRev2.status, 'demonstrated');
      assert.ok(sqlResultRev2.evidenceIds.length > 0);

      // Verify evidence citation points to database/queries.sql
      const sqlEvidence = await Evidence.findOne({ evidenceId: sqlResultRev2.evidenceIds[0] });
      assert.ok(sqlEvidence);
      assert.equal(sqlEvidence.filePath, 'database/queries.sql');
      assert.equal(sqlEvidence.commitSha, commit2Sha);
      assert.match(sqlEvidence.sourcePermalink, /database\/queries\.sql/);

      // Step 5: Verify Revision #1 is still preserved immutably
      const rev1Check = await Assessment.findOne({
        job: job._id,
        repository: repo._id,
        revisionNumber: 1,
      });
      assert.ok(rev1Check, 'Revision 1 must remain intact');
      const sqlRev1Check = rev1Check.skillResults.find((s) => s.skill === 'SQL');
      assert.equal(sqlRev1Check.status, 'not_demonstrated');

      // Verify coverage score increased
      assert.ok(rev2Assessment.coverageScore > rev1Check.coverageScore);
    } finally {
      githubService.getLatestCommitSha = originalGetCommit;
      githubService.getFileTree = originalGetTree;
      githubService.getFileContent = originalGetContent;
      githubService.compareCommits = originalCompare;
    }
  });
});
