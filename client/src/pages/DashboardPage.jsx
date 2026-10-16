import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  jobApi,
  repoApi,
  assessmentApi,
  activityApi,
} from '../services/api.js';
import { CoverageGauge } from '../components/CoverageGauge.jsx';
import { SkillCard } from '../components/SkillCard.jsx';
import { SkillDetailDrawer } from '../components/SkillDetailDrawer.jsx';
import { EvidenceModal } from '../components/EvidenceModal.jsx';
import { TrackRepoModal } from '../components/TrackRepoModal.jsx';
import { JobImportModal } from '../components/JobImportModal.jsx';
import { Badge } from '../components/Badge.jsx';
import {
  Play,
  RefreshCw,
  GitCommit,
  GitBranch,
  Calendar,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Loader2,
  Plus,
  GitFork,
  Briefcase,
  FileCode2,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Activity,
  Layers,
} from 'lucide-react';

export function DashboardPage({ latestEvent, onSetActiveContext }) {
  const [jobs, setJobs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [activityEvents, setActivityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [skillFilter, setSkillFilter] = useState('all'); // 'all', 'demonstrated', 'partially_demonstrated', 'not_demonstrated', 'required'
  const [error, setError] = useState('');
  const [trackRepoOpen, setTrackRepoOpen] = useState(false);
  const [importJobOpen, setImportJobOpen] = useState(false);

  const navigate = useNavigate();

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsRes, reposRes, actRes] = await Promise.all([
        jobApi.list(),
        repoApi.list(),
        activityApi.getActivity({ limit: 6 }).catch(() => ({ data: { changeEvents: [] } })),
      ]);

      const jobList = jobsRes.data?.jobs || [];
      const repoList = reposRes.data || [];
      setJobs(jobList);
      setRepos(repoList);
      setActivityEvents(actRes.data?.changeEvents || []);

      if (jobList.length > 0 && !selectedJobId) setSelectedJobId(jobList[0]._id);
      if (repoList.length > 0 && !selectedRepoId) setSelectedRepoId(repoList[0]._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch assessment whenever selected repository changes
  useEffect(() => {
    if (!selectedRepoId) return;

    async function loadAssessment() {
      try {
        const res = await assessmentApi.latestByRepo(selectedRepoId);
        if (res.data) {
          setAssessment(res.data);
          if (res.data.job?._id) setSelectedJobId(res.data.job._id);
          onSetActiveContext?.({
            assessment: res.data,
            job: res.data.job,
            repo: res.data.repository,
          });
        }
      } catch (err) {
        setAssessment(null);
      }
    }
    loadAssessment();
  }, [selectedRepoId, onSetActiveContext]);

  // Handle live SSE event notifications
  useEffect(() => {
    if (!latestEvent) return;

    if (latestEvent.type === 'commit_detected' || latestEvent.type === 'assessment_updated') {
      if (selectedRepoId) {
        assessmentApi.latestByRepo(selectedRepoId).then((res) => {
          if (res.data) setAssessment(res.data);
        }).catch(() => {});
      }
      activityApi.getActivity({ limit: 6 }).then((res) => {
        setActivityEvents(res.data?.changeEvents || []);
      }).catch(() => {});
    }
  }, [latestEvent, selectedRepoId]);

  // Run assessment manually
  const handleRunAssessment = async () => {
    if (!selectedJobId || !selectedRepoId) return;
    setAnalyzing(true);
    setError('');

    try {
      const res = await assessmentApi.create({
        jobId: selectedJobId,
        repositoryId: selectedRepoId,
      });
      const populated = await assessmentApi.get(res.data._id);
      setAssessment(populated.data);
      onSetActiveContext?.({
        assessment: populated.data,
        job: populated.data.job,
        repo: populated.data.repository,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Trigger manual commit poll
  const handlePollNow = async () => {
    if (!selectedRepoId) return;
    setPolling(true);
    setError('');

    try {
      await repoApi.pollNow(selectedRepoId);
      const res = await assessmentApi.latestByRepo(selectedRepoId);
      if (res.data) setAssessment(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPolling(false);
    }
  };

  const selectedJob = jobs.find((j) => j._id === selectedJobId) || assessment?.job;
  const selectedRepo = repos.find((r) => r._id === selectedRepoId) || assessment?.repository;

  // Filter skills
  const filteredSkills = (assessment?.skillResults || []).filter((sr) => {
    if (skillFilter === 'all') return true;
    if (skillFilter === 'demonstrated') return sr.status === 'demonstrated';
    if (skillFilter === 'partially_demonstrated') return sr.status === 'partially_demonstrated';
    if (skillFilter === 'not_demonstrated') return sr.status === 'not_demonstrated';
    if (skillFilter === 'required') return sr.classification === 'required';
    if (skillFilter === 'preferred') return sr.classification === 'preferred';
    return true;
  });

  const demonstratedCount = (assessment?.skillResults || []).filter((s) => s.status === 'demonstrated').length;
  const partialCount = (assessment?.skillResults || []).filter((s) => s.status === 'partially_demonstrated').length;
  const notDemonstratedCount = (assessment?.skillResults || []).filter((s) => s.status === 'not_demonstrated').length;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Your portfolio, decoded.</h1>
          <p className="page-subtitle">
            See what your repositories demonstrate against the roles you care about with automated commit updates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTrackRepoOpen(true)}
            className="btn btn-secondary"
            id="btn-connect-repo-dash"
          >
            <GitFork size={15} />
            <span>Connect Repository</span>
          </button>

          <button
            onClick={handlePollNow}
            disabled={polling || !selectedRepoId}
            className="btn btn-secondary"
            id="btn-poll-now-dash"
          >
            {polling ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{polling ? 'Checking GitHub...' : 'Check Commits'}</span>
          </button>

          <button
            onClick={handleRunAssessment}
            disabled={analyzing || !selectedJobId || !selectedRepoId}
            className="btn btn-primary"
            id="btn-run-assessment-dash"
          >
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            <span>{analyzing ? 'Analyzing Code...' : 'New Assessment'}</span>
          </button>
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

      {/* Target Selector Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="grid-2">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Target Job Posting</label>
              <button
                onClick={() => setImportJobOpen(true)}
                style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} />
                <span>Import Job</span>
              </button>
            </div>
            <select
              className="form-select"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              id="dash-select-job"
            >
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.employer} — {j.title} ({j.requiredSkills?.length || 0} required skills)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Connected GitHub Repository</label>
              <button
                onClick={() => setTrackRepoOpen(true)}
                style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} />
                <span>Track Repo</span>
              </button>
            </div>
            <select
              className="form-select"
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              id="dash-select-repo"
            >
              {repos.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.fullName} ({r.defaultBranch}) {r.lastSuccessfullyAnalyzedSha ? `• ${r.lastSuccessfullyAnalyzedSha.slice(0, 7)}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Tracked Repos
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {repos.length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Continuous commit polling
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Demonstrated
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>
            {demonstratedCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Concrete AST / code evidence
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Gaps In Scope
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.2rem' }}>
            {partialCount + notDemonstratedCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Requires additional code
          </div>
        </div>

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Analyzed Commit
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>
            {assessment?.commitSha ? assessment.commitSha.slice(0, 7) : 'Pending'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {assessment?.triggeringEvent?.message || 'Ready for analysis'}
          </div>
        </div>
      </div>

      {assessment ? (
        <>
          {/* Main Assessment Overview Card */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    PORTFOLIO EVIDENCE COVERAGE
                  </span>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                    {selectedJob?.title} @ {selectedJob?.employer}
                  </h2>
                </div>

                <Link
                  to={`/assessments/${assessment._id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem' }}
                >
                  <span>Detailed Assessment</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                <CoverageGauge
                  score={assessment.coverageScore}
                  formula={assessment.scoringConfiguration?.formula}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                    <span><strong>{demonstratedCount}</strong> Demonstrated in analyzed files</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warning)' }} />
                    <span><strong>{partialCount}</strong> Partially demonstrated</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    <span><strong>{notDemonstratedCount}</strong> Not demonstrated in analyzed scope</span>
                  </div>
                </div>
              </div>

              {/* Formula notice */}
              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '1.25rem', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Coverage percentage is a deterministic ratio of verifiable implementation evidence versus role requirements. It is not an ATS score or hiring guarantee.
              </div>
            </div>

            {/* Quick Actions & Reassessment Panel */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  REVISION AUDIT TRAIL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    Revision #{assessment.revisionNumber}
                  </span>
                  <Badge status="demonstrated">Immutable</Badge>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Triggered by: <strong>{assessment.triggeringEvent?.type || 'initial'}</strong>
                  <br />
                  Analyzed at: {new Date(assessment.createdAt).toLocaleTimeString()}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <Link to="/history" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                  <span>Compare Revision History</span>
                  <ArrowRight size={13} />
                </Link>
                <Link to="/gaps" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                  <span>View Skill Gap Roadmap</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* AI Career Coach Synthesis Banner */}
          {assessment.limitations && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
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
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {assessment.limitations}
              </p>
            </div>
          )}

          {/* Evaluated Competencies Matrix */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  Evaluated Competencies ({assessment.skillResults?.length || 0})
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any card to inspect grounded evidence, line ranges, and recommended actions
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                <button
                  onClick={() => setSkillFilter('all')}
                  className={`btn btn-sm ${skillFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  All ({assessment.skillResults?.length || 0})
                </button>
                <button
                  onClick={() => setSkillFilter('demonstrated')}
                  className={`btn btn-sm ${skillFilter === 'demonstrated' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Demonstrated ({demonstratedCount})
                </button>
                <button
                  onClick={() => setSkillFilter('not_demonstrated')}
                  className={`btn btn-sm ${skillFilter === 'not_demonstrated' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Not in Scope ({notDemonstratedCount})
                </button>
                <button
                  onClick={() => setSkillFilter('required')}
                  className={`btn btn-sm ${skillFilter === 'required' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Required Only
                </button>
              </div>
            </div>

            <div className="grid-3">
              {filteredSkills.map((sr) => (
                <div
                  key={sr.skill}
                  onClick={() => setSelectedSkill(sr)}
                  style={{ cursor: 'pointer' }}
                >
                  <SkillCard
                    skillResult={sr}
                    onSelectEvidence={(ev) => setSelectedEvidence(ev)}
                    evidenceMap={assessment.evidenceMap || {}}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity & Skill Gap Spotlight Grid */}
          <div className="grid-2">
            {/* Live Repository Activity Feed */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Recent Change Events</h3>
                </div>
                <Link to="/activity" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                  View All Events →
                </Link>
              </div>

              {activityEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No repository commit changes detected yet. The polling worker is actively watching for new commits.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activityEvents.slice(0, 4).map((evt) => (
                    <div
                      key={evt._id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <GitCommit size={15} color="var(--primary)" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {evt.commitMessage || 'Commit pushed'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {evt.previousSha?.slice(0, 7)} → {evt.newSha?.slice(0, 7)} • {evt.changedFiles?.length || 0} file(s) changed
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-demonstrated">Reassessed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skill Gap Spotlight */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="var(--warning)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Skill Gap Spotlight</h3>
                </div>
                <Link to="/gaps" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                  View Full Roadmap →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(assessment.skillResults || [])
                  .filter((s) => s.status !== 'demonstrated')
                  .slice(0, 3)
                  .map((gap) => (
                    <div
                      key={gap.skill}
                      style={{
                        padding: '0.75rem 0.85rem',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid var(--warning)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{gap.skill}</span>
                        <Badge status={gap.classification} type="classification" />
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {gap.recommendations?.[0] || 'Implement a concrete feature demonstrating this skill and push to GitHub.'}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* First-Time User Experience / Empty State */
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div style={{ background: 'var(--primary-subtle)', padding: '1rem', borderRadius: '50%' }}>
            <Layers size={36} color="var(--primary)" />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Welcome to SkillProof AI
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '540px', lineHeight: 1.6 }}>
            SkillProof compares real job expectations against the actual code in your repository. Follow the 3-step checklist below to generate your first evidence assessment.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              textAlign: 'left',
              width: '100%',
              maxWidth: '480px',
              margin: '0.5rem 0',
            }}
          >
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>1</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Select or Import a Target Job</span>
              </div>
              <button onClick={() => setImportJobOpen(true)} className="btn btn-secondary btn-sm">
                Import
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>2</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Connect a GitHub Repository</span>
              </div>
              <button onClick={() => setTrackRepoOpen(true)} className="btn btn-secondary btn-sm">
                Connect
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>3</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Run Initial Evidence Assessment</span>
              </div>
              <button onClick={handleRunAssessment} disabled={analyzing} className="btn btn-primary btn-sm">
                Analyze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Detail Side Drawer */}
      <SkillDetailDrawer
        skillResult={selectedSkill}
        evidenceMap={assessment?.evidenceMap || {}}
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

      {/* Modals */}
      {trackRepoOpen && (
        <TrackRepoModal
          onClose={() => setTrackRepoOpen(false)}
          onSuccess={(newRepo) => {
            setRepos([newRepo, ...repos]);
            setSelectedRepoId(newRepo._id);
          }}
        />
      )}

      {importJobOpen && (
        <JobImportModal
          onClose={() => setImportJobOpen(false)}
          onSuccess={(newJob) => {
            setJobs([newJob, ...jobs]);
            setSelectedJobId(newJob._id);
          }}
        />
      )}
    </div>
  );
}
