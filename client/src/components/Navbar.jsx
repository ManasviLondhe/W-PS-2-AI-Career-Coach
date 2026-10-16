import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Briefcase, GitFork, FileCode, CheckCircle2, History, Activity } from 'lucide-react';

export function Navbar({ sseConnected = true }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="nav-brand">
          <ShieldCheck size={26} color="var(--primary)" />
          <span>SkillProof AI</span>
          <span className="nav-tagline">Your portfolio is your proof</span>
        </Link>

        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-dashboard">
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-jobs">
            <Briefcase size={15} />
            <span>Jobs</span>
          </NavLink>

          <NavLink to="/repositories" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-repos">
            <GitFork size={15} />
            <span>Repositories</span>
          </NavLink>

          <NavLink to="/evidence" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-evidence">
            <FileCode size={15} />
            <span>Evidence</span>
          </NavLink>

          <NavLink to="/gaps" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-gaps">
            <CheckCircle2 size={15} />
            <span>Skill Gaps</span>
          </NavLink>

          <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-history">
            <History size={15} />
            <span>History</span>
          </NavLink>

          <NavLink to="/activity" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-activity">
            <Activity size={15} />
            <span>Activity</span>
          </NavLink>

          <div
            className="live-indicator"
            title="Real-time background commit detection and reassessment worker active"
            style={{ marginLeft: '0.5rem' }}
          >
            <div className="live-pulse" />
            <span>LIVE SYNC</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
