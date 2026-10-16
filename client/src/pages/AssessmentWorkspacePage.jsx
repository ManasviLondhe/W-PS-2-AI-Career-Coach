import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assessmentApi } from '../services/api.js';
import { CoverageGauge } from '../components/CoverageGauge.jsx';
import { Badge } from '../components/Badge.jsx';
import { SkillDetailDrawer } from '../components/SkillDetailDrawer.jsx';
import { EvidenceModal } from '../components/EvidenceModal.jsx';
import {
  ShieldCheck,
  ArrowLeft,
  GitCommit,
  GitBranch,
  Calendar,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  FileCode2,
  Loader2,
  ArrowUpDown,
  Briefcase,
  GitFork,
} from 'lucide-react';

export function AssessmentWorkspacePage() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('importance'); // 'importance', 'status', 'name'
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssessment() {
      try {
        setLoading(true);
        const res = await assessmentApi.get(id);
        setAssessment(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAssessment();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Assessment Not Found</h2>
        <Link to="/dashboard" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { job, repository, skillResults = [], coverageScore, revisionNumber, commitSha, triggeringEvent, limitations, evidenceMap = {} } = assessment;

  // Filter skills
  const filtered = skillResults.filter((sr) => {
    const matchesSearch = sr.skill.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'demonstrated') return sr.status === 'demonstrated';
    if (statusFilter === 'partially_demonstrated') return sr.status === 'partially_demonstrated';
    if (statusFilter === 'not_demonstrated') return sr.status === 'not_demonstrated';
    if (statusFilter === 'required') return sr.classification === 'required';
    if (statusFilter === 'preferred') return sr.classification === 'preferred';
    return true;
  });

  // Sort skills
  filtered.sort((a, b) => {
    if (sortBy === 'importance') {
      if (a.classification === 'required' && b.classification !== 'required') return -1;
      if (a.classification !== 'required' && b.classification === 'required') return 1;
    } else if (sortBy === 'status') {
      const order = { demonstrated: 1, partially_demonstrated: 2, not_demonstrated: 3 };
      return (order[a.status] || 99) - (order[b.status] || 99);
    } else if (sortBy === 'name') {
      return a.skill.localeCompare(b.skill);
    }
    return 0;
  });

  const demonstratedCount = skillResults.filter((s) => s.status === 'demonstrated').length;
  const partialCount = skillResults.filter((s) => s.status === 'partially_demonstrated').length;
  const notDemonstratedCount = skillResults.filter((s) => s.status === 'not_demonstrated').length;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Dashboard</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                Assessment Revision #{revisionNumber}
              </span>
              <Badge status="demonstrated">Immutable Revision</Badge>
            </div>
            <h1 className="page-title" style={{ fontSize: '1.4rem' }}>
              {job?.title} @ {job?.employer}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
              <span>Repo: <strong>{repository?.fullName}</strong></span>
              <span>Commit: <strong>{commitSha?.slice(0, 7)}</strong></span>
              <span>Trigger: <strong>{triggeringEvent?.type || 'manual'}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to={`/jobs/${job?._id}`} className="btn btn-secondary btn-sm">
              <Briefcase size={13} />
              <span>View Job</span>
            </Link>
            <Link to={`/repositories/${repository?._id}`} className="btn btn-secondary btn-sm">
              <GitFork size={13} />
              <span>View Repository</span>
            </Link>
            <Link to="/history" className="btn btn-secondary btn-sm">
              <History size={13} />
              <span>Revision History</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Assessment Summary Section */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Evidence Coverage Score</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Evaluated {new Date(assessment.createdAt).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
            <CoverageGauge score={coverageScore} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span><strong>{demonstratedCount}</strong> Demonstrated competencies</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} color="var(--warning)" />
                <span><strong>{partialCount}</strong> Partially demonstrated competencies</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={16} color="var(--text-muted)" />
                <span><strong>{notDemonstratedCount}</strong> Not demonstrated in analyzed scope</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trigger details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Commit Context
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
            <GitCommit size={18} color="var(--primary)" />
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{commitSha?.slice(0, 7)}</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {triggeringEvent?.message || 'Assessment initiated against commit head'}
          </p>
          <a
            href={`https://github.com/${repository?.owner}/${repository?.name}/commit/${commitSha}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <span>Inspect Commit on GitHub</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* AI Synthesis & Limitations */}
      {limitations && (
        <div
          className="card"
          style={{
            marginBottom: '2rem',
            borderLeft: '4px solid var(--primary)',
            background: 'linear-gradient(to right, #FFFFFF, var(--bg-subtle))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <Sparkles size={17} color="var(--primary)" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              AI Career Coach Evaluation
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {limitations}
          </p>
        </div>
      )}

      {/* Requirement Matrix Toolbar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Search box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', width: '260px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search competencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.84rem', width: '100%' }}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {['all', 'demonstrated', 'partially_demonstrated', 'not_demonstrated', 'required', 'preferred'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
              >
                {tab === 'all' && 'All Skills'}
                {tab === 'demonstrated' && 'Demonstrated'}
                {tab === 'partially_demonstrated' && 'Partially Demonstrated'}
                {tab === 'not_demonstrated' && 'Not in Scope'}
                {tab === 'required' && 'Required'}
                {tab === 'preferred' && 'Preferred'}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowUpDown size={13} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.5rem',
                fontSize: '0.78rem',
                background: '#FFFFFF',
              }}
            >
              <option value="importance">Sort by Requirement Importance</option>
              <option value="status">Sort by Assessment Status</option>
              <option value="name">Sort by Alphabetical Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skill Requirement Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Competency</th>
              <th>Requirement Type</th>
              <th>Assessment Status</th>
              <th>Evidence Anchors</th>
              <th>Verdict Summary</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No skills match the selected filter.
                </td>
              </tr>
            ) : (
              filtered.map((sr) => {
                const evidences = (sr.evidenceIds || []).map((id) => evidenceMap[id]).filter(Boolean);

                return (
                  <tr
                    key={sr.skill}
                    onClick={() => setSelectedSkill(sr)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{sr.skill}</span>
                    </td>
                    <td>
                      <Badge status={sr.classification} type="classification" />
                    </td>
                    <td>
                      <Badge status={sr.status} />
                    </td>
                    <td>
                      {evidences.length > 0 ? (
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                          {evidences.length} verified location(s)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          None in scope
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '320px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sr.explanation}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSkill(sr);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
                      >
                        <span>Inspect Proof</span>
                        <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Skill Detail Drawer */}
      <SkillDetailDrawer
        skillResult={selectedSkill}
        evidenceMap={evidenceMap}
        onClose={() => setSelectedSkill(null)}
        onSelectEvidence={(ev) => setSelectedEvidence(ev)}
      />

      {/* Evidence Modal */}
      {selectedEvidence && (
        <EvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
}
