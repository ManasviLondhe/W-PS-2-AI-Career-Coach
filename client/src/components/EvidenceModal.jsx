import React from 'react';
import { X, ExternalLink, Code2, ShieldAlert } from 'lucide-react';
import { Badge } from './Badge.jsx';

export function EvidenceModal({ evidence, onClose }) {
  if (!evidence) return null;

  return (
    <div className="modal-overlay" onClick={onClose} id="evidence-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {evidence.skill} Evidence
              </h2>
              <Badge status={evidence.confidence === 'high' ? 'demonstrated' : 'partially_demonstrated'}>
                {evidence.confidence.toUpperCase()} Confidence
              </Badge>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              ID: {evidence.evidenceId} • Commit: {evidence.commitSha?.slice(0, 7)}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Source location bar */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <Code2 size={16} color="var(--primary)" />
            <span>
              {evidence.filePath}:{evidence.lineRange?.start}-{evidence.lineRange?.end}
            </span>
          </div>

          <a
            href={evidence.sourcePermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            id="view-on-github-permalink"
          >
            <span>View on GitHub</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Code Excerpt */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            VERIFIED CODE EXCERPT
          </div>
          <pre className="code-block" style={{ maxHeight: '280px' }}>
            <code>{evidence.codeExcerpt || '// No excerpt stored'}</code>
          </pre>
        </div>

        {/* Explanation */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Implementation Verification
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {evidence.explanation}
          </p>
        </div>

        {/* Limitations */}
        {evidence.limitations && (
          <div
            style={{
              background: 'var(--bg-subtle)',
              borderLeft: '3px solid var(--text-muted)',
              padding: '0.65rem 0.85rem',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
            }}
          >
            <ShieldAlert size={16} color="var(--text-muted)" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <strong>Scope Disclaimer: </strong>
              {evidence.limitations}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
