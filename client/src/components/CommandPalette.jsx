import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Briefcase,
  GitFork,
  FileCode2,
  CheckCircle2,
  History,
  Activity,
  Settings,
  Plus,
  RefreshCw,
  X,
  ArrowRight,
} from 'lucide-react';

export function CommandPalette({ isOpen, onClose, onOpenImportJob, onOpenTrackRepo, onPollCommits }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      } else if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    {
      group: 'Navigation',
      label: 'Dashboard Overview',
      desc: 'View portfolio coverage and target job analysis',
      icon: <LayoutDashboard size={16} />,
      action: () => { navigate('/dashboard'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Job Explorer',
      desc: 'Discover and import roles with verified source URLs',
      icon: <Briefcase size={16} />,
      action: () => { navigate('/jobs'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Connected Repositories',
      desc: 'Manage tracked GitHub repositories and branches',
      icon: <GitFork size={16} />,
      action: () => { navigate('/repositories'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Evidence Explorer',
      desc: 'Browse code excerpts, line numbers and commit links',
      icon: <FileCode2 size={16} />,
      action: () => { navigate('/evidence'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Skill Gap Analysis',
      desc: 'Actionable roadmaps for partially and unproven skills',
      icon: <CheckCircle2 size={16} />,
      action: () => { navigate('/gaps'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Assessment Revision History',
      desc: 'Before-and-after comparisons across git commits',
      icon: <History size={16} />,
      action: () => { navigate('/history'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Live Activity Timeline',
      desc: 'Real-time repository change detection and audit stream',
      icon: <Activity size={16} />,
      action: () => { navigate('/activity'); onClose(false); },
    },
    {
      group: 'Navigation',
      label: 'Settings & Integrations',
      desc: 'Inspect backend health, MongoDB Atlas and GitHub rate limits',
      icon: <Settings size={16} />,
      action: () => { navigate('/settings'); onClose(false); },
    },
    {
      group: 'Quick Actions',
      label: 'Import Target Job',
      desc: 'Extract required competencies from Greenhouse, Lever, or URL',
      icon: <Plus size={16} color="var(--primary)" />,
      action: () => { onClose(false); onOpenImportJob?.(); },
    },
    {
      group: 'Quick Actions',
      label: 'Track New Repository',
      desc: 'Connect a public GitHub repo for continuous verification',
      icon: <GitFork size={16} color="var(--primary)" />,
      action: () => { onClose(false); onOpenTrackRepo?.(); },
    },
    {
      group: 'Quick Actions',
      label: 'Poll GitHub Commits Now',
      desc: 'Trigger background worker to detect pushed commits',
      icon: <RefreshCw size={16} color="var(--success)" />,
      action: () => { onClose(false); onPollCommits?.(); },
    },
  ];

  const filtered = items.filter(
    (i) =>
      i.label.toLowerCase().includes(query.toLowerCase()) ||
      i.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="command-palette-backdrop" onClick={() => onClose(false)} id="command-palette-modal">
      <div className="command-palette-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', gap: '0.75rem' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Type a command or navigate... (e.g., jobs, commits, gaps, settings)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
            id="command-palette-input"
          />
          <button onClick={() => onClose(false)} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No commands matching &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={idx}
                onClick={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: 'var(--bg-subtle)',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>Use <strong>Esc</strong> to close</span>
          <span>Proofspace Command System</span>
        </div>
      </div>
    </div>
  );
}
