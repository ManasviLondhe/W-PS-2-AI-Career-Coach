import React from 'react';
import { Info } from 'lucide-react';

export function CoverageGauge({ score = 0, formula = 'Coverage = 100 * sum(weight * evidence_score) / sum(weight)' }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = '#10b981'; // Green
  if (score < 40) {
    strokeColor = '#ef4444'; // Red
  } else if (score < 75) {
    strokeColor = '#f59e0b'; // Amber
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={strokeColor}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {score}%
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Coverage
          </span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Evidence Coverage Score
          </span>
          <span title={formula} style={{ cursor: 'help', color: 'var(--text-muted)' }}>
            <Info size={14} />
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.4 }}>
          Deterministic ratio of verifiable implementation evidence versus role requirements.
        </p>
      </div>
    </div>
  );
}
