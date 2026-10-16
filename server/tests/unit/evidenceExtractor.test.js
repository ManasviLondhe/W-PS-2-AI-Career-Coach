import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceExtractor } from '../../src/services/evidenceExtractor.js';

describe('EvidenceExtractor — Code Syntax & Implementation Verification', () => {
  const repoInfo = {
    owner: 'testowner',
    repo: 'payments-service',
    commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
  };

  test('detects Java Spring Boot service and creates commit-pinned permalink', () => {
    const files = [
      {
        path: 'src/main/java/com/stripe/service/PaymentService.java',
        content: `
package com.stripe.service;

import org.springframework.stereotype.Service;

@Service
public class PaymentService {
    public void processPayment(String id) {
        // Business logic
    }
}
        `.trim(),
      },
    ];

    const result = EvidenceExtractor.extractEvidenceForSkill('Java', files, repoInfo);
    assert.equal(result.status, 'demonstrated');
    assert.equal(result.confidence, 'high');
    assert.ok(result.evidenceItems.length > 0);

    const ev = result.evidenceItems[0];
    assert.equal(ev.filePath, 'src/main/java/com/stripe/service/PaymentService.java');
    assert.match(ev.sourcePermalink, /https:\/\/github\.com\/testowner\/payments-service\/blob\/a1b2c3d4e5f678901234567890abcdef12345678/);
    assert.ok(ev.lineRange.start >= 1);
    assert.ok(ev.lineRange.end > ev.lineRange.start);
  });

  test('produces deterministic evidence IDs for the same snapshot and distinct IDs for different commits', () => {
    const files = [
      {
        path: 'src/main/java/com/stripe/service/PaymentService.java',
        content: `package com.stripe.service;\n\n@Service\npublic class PaymentService {}`,
      },
    ];

    const first = EvidenceExtractor.extractEvidenceForSkill('Java', files, repoInfo);
    const second = EvidenceExtractor.extractEvidenceForSkill('Java', files, repoInfo);
    const otherCommit = EvidenceExtractor.extractEvidenceForSkill('Java', files, {
      ...repoInfo,
      commitSha: 'ffffffffffffffffffffffffffffffffffffffff',
    });

    assert.equal(first.evidenceItems[0].evidenceId, second.evidenceItems[0].evidenceId);
    assert.notEqual(first.evidenceItems[0].evidenceId, otherCommit.evidenceItems[0].evidenceId);
  });

  test('reports not_demonstrated with honest analyzed scope wording when skill absent', () => {
    const files = [
      {
        path: 'src/main/java/com/stripe/service/PaymentService.java',
        content: 'public class PaymentService {}',
      },
      {
        path: 'README.md',
        content: '# Payments Service\nI know SQL and relational databases.',
      },
    ];

    const result = EvidenceExtractor.extractEvidenceForSkill('SQL', files, repoInfo);
    assert.equal(result.status, 'not_demonstrated');
    assert.equal(result.evidenceItems.length, 0);

    // Verify respectful wording rule: never say "unqualified" or "lacks skill"
    assert.match(result.explanation, /No qualifying implementation of SQL was identified within the analyzed repository files/);
    assert.match(result.limitations, /Assessment is confined to analyzed files on branch commit/);
    assert.doesNotMatch(result.explanation.toLowerCase(), /lacks|unqualified|missing ability/);
  });

  test('detects parameterized SQL queries and schema definitions', () => {
    const files = [
      {
        path: 'database/schema.sql',
        content: `
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT id, amount FROM transactions WHERE id = $1;
        `.trim(),
      },
    ];

    const result = EvidenceExtractor.extractEvidenceForSkill('SQL', files, repoInfo);
    assert.equal(result.status, 'demonstrated');
    assert.ok(result.evidenceItems.length > 0);
    assert.equal(result.evidenceItems[0].skill, 'SQL');
    assert.equal(result.evidenceItems[0].confidence, 'high');
  });

  test('detects React functional components and hooks', () => {
    const files = [
      {
        path: 'src/components/UserProfile.jsx',
        content: `
import React, { useState, useEffect } from 'react';

export function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);
    return <div className="profile">{user?.name}</div>;
}
        `.trim(),
      },
    ];

    const result = EvidenceExtractor.extractEvidenceForSkill('React', files, repoInfo);
    assert.equal(result.status, 'demonstrated');
    assert.equal(result.confidence, 'high');
  });

  test('detects automated unit tests and assertions', () => {
    const files = [
      {
        path: 'tests/paymentService.test.js',
        content: `
describe('PaymentService', () => {
    it('should charge correct amount', () => {
        expect(100).toBe(100);
    });
});
        `.trim(),
      },
    ];

    const result = EvidenceExtractor.extractEvidenceForSkill('Testing', files, repoInfo);
    assert.equal(result.status, 'demonstrated');
  });
});
