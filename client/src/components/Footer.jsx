import React from 'react';
import { Shield, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Shield size={18} color="var(--primary)" />
          <span>
            <strong>SkillProof AI</strong> — Evidence-based AI Career Coach | Worcflow Hackathon (W-PS-2)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem' }}>
          <span>Deterministic Scoring</span>
          <span>Commit-pinned Permalinks</span>
          <span>Zero Fabricated Data</span>
        </div>
      </div>
    </footer>
  );
}
