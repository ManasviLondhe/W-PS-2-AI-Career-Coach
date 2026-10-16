import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  Briefcase,
  GitFork,
  FileCode2,
  CheckCircle2,
  History,
  Activity,
  Settings,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  GitCommit,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette.jsx';
import { AiAssistantDrawer } from './AiAssistantDrawer.jsx';
import { JobImportModal } from './JobImportModal.jsx';
import { TrackRepoModal } from './TrackRepoModal.jsx';
import { repoApi } from '../services/api.js';

export function AppShell({ children, latestEvent, activeAssessment, activeJob, activeRepo, onRefreshData }) {
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [pollingLive, setPollingLive] = useState(false);
  const [bannerNotice, setBannerNotice] = useState(null);

  const location = useLocation();

  // Listen for real-time commit detection and reassessment
  useEffect(() => {
    if (!latestEvent) return;

    if (latestEvent.type === 'commit_detected') {
      setBannerNotice({
        type: 'commit',
        message: `New commit detected: "${latestEvent.data.commitMessage || latestEvent.data.newSha.slice(0, 7)}" on ${latestEvent.data.repository}. Reassessing affected skills...`,
        sha: latestEvent.data.newSha,
        timestamp: new Date().toLocaleTimeString(),
      });
    } else if (latestEvent.type === 'assessment_updated') {
      setBannerNotice({
        type: 'reassessment',
        message: `Reassessment complete! Revision #${latestEvent.data.revisionNumber} generated with ${latestEvent.data.coverageScore}% coverage on ${latestEvent.data.repository}.`,
        sha: latestEvent.data.commitSha,
        timestamp: new Date().toLocaleTimeString(),
      });
      onRefreshData?.();
    }
  }, [latestEvent, onRefreshData]);

  const handlePollNow = async () => {
    if (activeRepo?._id) {
      setPollingLive(true);
      try {
        await repoApi.pollNow(activeRepo._id);
        onRefreshData?.();
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        setPollingLive(false);
      }
    } else {
      setRepoModalOpen(true);
    }
  };

  // Determine breadcrumb based on route
  const getBreadcrumb = () => {
    const p = location.pathname;
    if (p === '/' || p === '/dashboard') return ['Workspace', 'Dashboard Overview'];
    if (p.startsWith('/jobs')) return ['Workspace', 'Job Explorer'];
    if (p === '/repositories/connect') return ['Workspace', 'Connect Repository'];
    if (p.startsWith('/repositories')) return ['Workspace', 'Repository Explorer'];
    if (p.startsWith('/assessments') || p === '/evidence') return ['Evidence', 'Evidence Explorer'];
    if (p === '/gaps') return ['Evidence', 'Skill Gap Analysis'];
    if (p === '/history') return ['Evidence', 'Assessment Revision History'];
    if (p === '/activity') return ['Monitoring', 'Live Activity Timeline'];
    if (p === '/settings') return ['Monitoring', 'Settings & System Health'];
    return ['SkillProof AI', 'Workspace'];
  };

  const [section, pageTitle] = getBreadcrumb();

  return (
    <div className="app-shell">
      {/* Left Collapsible Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="app-sidebar">
        <div className="sidebar-header">
          {!collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link to="/dashboard" className="sidebar-brand">
                <ShieldCheck size={24} color="var(--primary)" />
                <span>SkillProof AI</span>
              </Link>
              <span className="worcflow-tag">SPONSORED BY WORCFLOW</span>
            </div>
          ) : (
            <Link to="/dashboard" title="SkillProof AI">
              <ShieldCheck size={26} color="var(--primary)" />
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              padding: '0.35rem',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* Workspace Group */}
          <div>
            <div className="nav-section-title">Workspace</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-dashboard">
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/jobs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-jobs">
              <Briefcase size={17} />
              <span>Job Explorer</span>
            </NavLink>
            <NavLink to="/repositories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-repos">
              <GitFork size={17} />
              <span>Repositories</span>
            </NavLink>
          </div>

          {/* Evidence Group */}
          <div>
            <div className="nav-section-title">Evidence & Skills</div>
            <NavLink to="/assessments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-assessments">
              <ShieldCheck size={17} />
              <span>Assessments</span>
            </NavLink>
            <NavLink to="/evidence" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-evidence">
              <FileCode2 size={17} />
              <span>Evidence Explorer</span>
            </NavLink>
            <NavLink to="/gaps" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-gaps">
              <CheckCircle2 size={17} />
              <span>Skill Gaps</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-history">
              <History size={17} />
              <span>Revision History</span>
            </NavLink>
          </div>

          {/* Monitoring Group */}
          <div>
            <div className="nav-section-title">Monitoring</div>
            <NavLink to="/activity" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-activity">
              <Activity size={17} />
              <span>Activity Timeline</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} id="nav-item-settings">
              <Settings size={17} />
              <span>Settings & Health</span>
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={() => setAiAssistantOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: '0.45rem 0.65rem' }}
            title="Ask AI Career Coach"
          >
            <Bot size={15} color="var(--primary)" />
            {!collapsed && <span>AI Career Coach</span>}
          </button>

          <div className="workspace-badge">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
            <span>Local Hackathon Prototype</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <div className="workspace-canvas">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            <span>{section}</span>
            <span>/</span>
            <span className="breadcrumb-active">{pageTitle}</span>
          </div>

          <div className="topbar-actions">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="command-launcher"
              id="btn-open-command-palette"
            >
              <Search size={14} />
              <span>Search commands...</span>
              <span className="kbd">Ctrl K</span>
            </button>

            <button
              onClick={handlePollNow}
              disabled={pollingLive}
              className="btn btn-secondary btn-sm"
              title="Poll GitHub for new commits immediately"
              id="topbar-poll-commits"
            >
              <RefreshCw size={13} className={pollingLive ? 'animate-spin' : ''} />
              <span style={{ fontSize: '0.78rem' }}>Check Commits</span>
            </button>

            <div className="live-sync-pill" title="Automated background repository change detector active">
              <div className="live-pulse" />
              <span>LIVE SYNC</span>
            </div>
          </div>
        </header>

        {/* Live Reassessment Banner */}
        {bannerNotice && (
          <div
            style={{
              background: bannerNotice.type === 'commit' ? 'var(--primary-subtle)' : 'var(--success-subtle)',
              borderBottom: `1px solid ${bannerNotice.type === 'commit' ? 'var(--primary-border)' : 'var(--success-border)'}`,
              color: bannerNotice.type === 'commit' ? 'var(--primary)' : 'var(--success)',
              padding: '0.75rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
            id="global-live-event-banner"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="live-pulse" />
              <span>{bannerNotice.message}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{bannerNotice.timestamp}</span>
              <button
                onClick={() => setBannerNotice(null)}
                style={{ color: 'inherit', opacity: 0.7 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="content-body">{children}</main>
      </div>

      {/* Global Modals & Drawers */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={setCommandPaletteOpen}
        onOpenImportJob={() => setJobModalOpen(true)}
        onOpenTrackRepo={() => setRepoModalOpen(true)}
        onPollCommits={handlePollNow}
      />

      <AiAssistantDrawer
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        assessment={activeAssessment}
        job={activeJob}
        repo={activeRepo}
      />

      {jobModalOpen && (
        <JobImportModal
          onClose={() => setJobModalOpen(false)}
          onSuccess={() => onRefreshData?.()}
        />
      )}

      {repoModalOpen && (
        <TrackRepoModal
          onClose={() => setRepoModalOpen(false)}
          onSuccess={() => onRefreshData?.()}
        />
      )}
    </div>
  );
}
