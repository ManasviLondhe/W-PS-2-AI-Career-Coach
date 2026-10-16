import React from 'react';
import { Badge } from './Badge.jsx';
import { FileCode, ExternalLink, Lightbulb } from 'lucide-react';

export function SkillCard({ skillResult, onSelectEvidence, evidenceMap = {} }) {
  const {
    skill,
    classification,
    status,
    evidenceIds = [],
    explanation,
    recommendations = [],
  } = skillResult;

  const evidences = evidenceIds.map((id) => evidenceMap[id]).filter(Boolean);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {skill}
          </h3>
          <Badge status={classification} type="classification" />
        </div>
        <Badge status={status} />
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45, flex: 1 }}>
        {explanation}
      </p>

      {/* Evidence references */}
      {evidences.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Verified Code Evidence ({evidences.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {evidences.slice(0, 2).map((ev) => (
              <div
                key={ev.evidenceId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-subtle)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {ev.filePath}:{ev.lineRange?.start}-{ev.lineRange?.end}
                </span>
                <button
                  onClick={() => onSelectEvidence(ev)}
                  style={{
                    color: 'var(--primary)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <span>Inspect</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations if gap */}
      {status !== 'demonstrated' && recommendations.length > 0 && (
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.75rem',
            borderLeft: '3px solid var(--warning)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            <Lightbulb size={13} color="var(--warning)" />
            <span>Recommended Portfolio Action</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {recommendations[0]}
          </p>
        </div>
      )}
    </div>
  );
}
