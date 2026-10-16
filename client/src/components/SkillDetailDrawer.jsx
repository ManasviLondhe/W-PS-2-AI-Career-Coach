import React from 'react';
import { X, ExternalLink, Code2, ShieldAlert, Sparkles, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { Badge } from './Badge.jsx';

export function SkillDetailDrawer({ skillResult, evidenceMap = {}, onClose, onSelectEvidence }) {
  if (!skillResult) return null;

  const {
    skill,
    classification,
    status,
    evidenceIds = [],
    explanation,
    limitations,
    recommendations = [],
  } = skillResult;

  const evidences = evidenceIds.map((id) => evidenceMap[id]).filter(Boolean);

  return (
    <div className="drawer-overlay" onClick={onClose} id="skill-detail-drawer-overlay">
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Badge status={classification} type="classification" />
              <Badge status={status} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {skill}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Assessment Evaluation */}
        <div>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.45rem' }}>
            Assessment Verdict & Rationale
          </h3>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {explanation}
          </p>
        </div>

        {/* Verified Code Evidence Excerpts */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Verified Code Evidence ({evidences.length})
            </h3>
            {evidences.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>
                Commit-Pinned
              </span>
            )}
          </div>

          {evidences.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              <HelpCircle size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
              <p>No verifiable implementation of {skill} was detected in the examined repository files.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {evidences.map((ev) => (
                <div
                  key={ev.evidenceId}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      padding: '0.6rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-light)',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Code2 size={14} color="var(--primary)" />
                      <span style={{ fontWeight: 600 }}>
                        {ev.filePath}:{ev.lineRange?.start}-{ev.lineRange?.end}
                      </span>
                    </div>

                    <a
                      href={ev.sourcePermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                    >
                      <span>GitHub</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div style={{ padding: '0.85rem' }}>
                    <pre className="code-panel" style={{ fontSize: '0.76rem', maxHeight: '180px' }}>
                      <code>{ev.codeExcerpt}</code>
                    </pre>

                    <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong>Why this counts: </strong>{ev.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio Recommendations */}
        {recommendations.length > 0 && (
          <div
            style={{
              background: 'var(--warning-subtle)',
              border: '1px solid var(--warning-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={16} color="var(--warning)" />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--warning)' }}>
                Recommended Action to Demonstrate {skill}
              </h4>
            </div>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Scope and Disclaimer */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderLeft: '3px solid var(--text-muted)',
            padding: '0.75rem 1rem',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Analyzed Scope Limitation: </strong>
          {limitations || 'Assessment evaluated exclusively from repository code snapshot. Unanalyzed files or external projects are not reflected.'}
        </div>
      </div>
    </div>
  );
}
