import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jobApi, repoApi, assessmentApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  Briefcase,
  ExternalLink,
  ArrowLeft,
  Play,
  RefreshCw,
  GitFork,
  Calendar,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export function JobDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchJobAndRepos() {
      try {
        setLoading(true);
        const [jobRes, repoRes] = await Promise.all([jobApi.get(id), repoApi.list()]);
        setJob(jobRes.data);
        const repoList = repoRes.data || [];
        setRepos(repoList);
        if (repoList.length > 0) setSelectedRepoId(repoList[0]._id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchJobAndRepos();
  }, [id]);

  const handleCompare = async () => {
    if (!selectedRepoId) return;
    setAssessing(true);
    setError('');

    try {
      const res = await assessmentApi.create({
        jobId: job._id,
        repositoryId: selectedRepoId,
      });
      navigate(`/assessments/${res.data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAssessing(false);
    }
  };

  const handleReExtract = async () => {
    setExtracting(true);
    try {
      const res = await jobApi.extractSkills(job._id);
      setJob(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
        <h2>Job Posting Not Found</h2>
        <Link to="/jobs" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Jobs
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/jobs"
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
          <span>Back to All Jobs</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                {job.employer}
              </span>
              <Badge status={job.sourceVerificationState} type="verification" />
            </div>
            <h1 className="page-title">{job.title}</h1>
          </div>

          {job.originalSourceUrl && (
            <a
              href={job.originalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.4rem' }}
            >
              <span>View Original Posting</span>
              <ExternalLink size={13} />
            </a>
          )}
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
          }}
        >
          {error}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid-3" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Job Description and Origin */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              <Briefcase size={18} color="var(--primary)" />
              <span>Role Overview & Requirements</span>
            </h3>

            <div
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-subtle)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'inherit',
                maxHeight: '500px',
                overflowY: 'auto',
              }}
            >
              {job.description || 'No raw text provided for this posting.'}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-light)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Ingestion Method: <strong>{job.sourceType}</strong></span>
              <span>Retrieved: {new Date(job.retrievalTimestamp || job.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Extracted Skills & Assessment Trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Action Box: Compare with My Repository */}
          <div className="card" style={{ border: '2px solid var(--primary-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
              EVIDENCE VERIFICATION
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.35rem 0 0.75rem' }}>
              Compare with Repository
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Select a connected GitHub repository to inspect for required competencies and produce a verifiable assessment.
            </p>

            <div className="form-group">
              <label className="form-label">Repository</label>
              <select
                className="form-select"
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
              >
                {repos.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.fullName} ({r.defaultBranch})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCompare}
              disabled={assessing || !selectedRepoId}
              className="btn btn-primary"
              style={{ width: '100%', gap: '0.5rem' }}
              id="btn-job-compare"
            >
              {assessing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              <span>{assessing ? 'Analyzing Evidence...' : 'Run Portfolio Assessment'}</span>
            </button>
          </div>

          {/* Extracted Requirements Breakdown */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>
                Extracted Competencies
              </h3>
              <button
                onClick={handleReExtract}
                disabled={extracting}
                style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                title="Re-run Skill Extraction"
              >
                <RefreshCw size={12} className={extracting ? 'animate-spin' : ''} />
                <span>Re-extract</span>
              </button>
            </div>

            {/* Required Skills */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                Required Skills ({job.requiredSkills?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {job.requiredSkills?.map((s) => (
                  <span key={s} className="badge badge-required">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Preferred Skills */}
            {job.preferredSkills?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  Preferred Skills ({job.preferredSkills?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {job.preferredSkills?.map((s) => (
                    <span key={s} className="badge badge-preferred">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
