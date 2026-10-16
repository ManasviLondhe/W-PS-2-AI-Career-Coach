import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobApi } from '../services/api.js';
import { JobImportModal } from '../components/JobImportModal.jsx';
import {
  Briefcase,
  Plus,
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  Search,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Clock,
  Link2,
  FileText,
  RefreshCw,
} from 'lucide-react';

export function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [initialModalUrl, setInitialModalUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'verified', 'pasted'
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await jobApi.list({ limit: 50 });
      setJobs(res.data?.jobs || []);
    } catch (err) {
      setError(err.message || 'Failed to load saved jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDeleteJob = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this job requirement?')) return;
    try {
      await jobApi.delete(id);
      setJobs((prev) => prev.filter((j) => j._id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleQuickAnalyzeSubmit = (e) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setInitialModalUrl(quickUrl.trim());
    setModalOpen(true);
    setQuickUrl('');
  };

  const handleOpenPastedModal = () => {
    setInitialModalUrl('');
    setModalOpen(true);
  };

  // Filter jobs based on search query and source type
  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      job.title?.toLowerCase().includes(query) ||
      job.employer?.toLowerCase().includes(query) ||
      job.requiredSkills?.some((s) => s.toLowerCase().includes(query));

    const matchesSource =
      sourceFilter === 'all' ||
      (sourceFilter === 'verified' && (job.sourceVerificationState === 'verified_url' || job.sourceVerificationState === 'verified_api')) ||
      (sourceFilter === 'pasted' && job.sourceVerificationState === 'unverified_pasted');

    return matchesSearch && matchesSource;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Requirements</h1>
          <p className="page-subtitle">
            Understand what employers expect before you compare your portfolio.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={handleOpenPastedModal}
            className="btn btn-secondary"
            id="btn-open-paste-modal"
          >
            <FileText size={16} />
            <span>Paste Job Description</span>
          </button>
          <button
            onClick={() => {
              setInitialModalUrl('');
              setModalOpen(true);
            }}
            className="btn btn-primary"
            id="btn-open-job-import"
          >
            <Plus size={16} />
            <span>Analyze New Job</span>
          </button>
        </div>
      </div>

      {/* Prominent Job URL Input Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, var(--bg-subtle) 100%)',
          border: '1px solid var(--border-light)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
            Instant Role Ingestion & Requirement Extraction
          </span>
        </div>

        <form onSubmit={handleQuickAnalyzeSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <Link2
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="url"
              className="form-input"
              style={{ paddingLeft: '2.5rem', height: '44px', fontSize: '0.92rem' }}
              placeholder="Paste a real job posting URL (e.g., https://boards.greenhouse.io/... or https://jobs.lever.co/...)"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              id="input-quick-job-url"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ height: '44px', padding: '0 1.5rem' }}
            id="btn-quick-analyze"
          >
            <span>Analyze Job</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* Error Callout */}
      {error && (
        <div
          style={{
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={loadJobs} className="btn btn-sm btn-secondary">
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Source Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
          <button
            onClick={() => setSourceFilter('all')}
            className={`btn btn-sm ${sourceFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            All Saved ({jobs.length})
          </button>
          <button
            onClick={() => setSourceFilter('verified')}
            className={`btn btn-sm ${sourceFilter === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            Verified URLs
          </button>
          <button
            onClick={() => setSourceFilter('pasted')}
            className={`btn btn-sm ${sourceFilter === 'pasted' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            User-Provided
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.1rem', fontSize: '0.84rem' }}
            placeholder="Search role, company, skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="input-search-jobs"
          />
        </div>
      </div>

      {/* Jobs Grid or Empty State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading target job requirements...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Briefcase size={38} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {jobs.length === 0 ? 'No Job Requirements Saved Yet' : 'No Matching Jobs Found'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
            {jobs.length === 0
              ? 'Enter a public posting URL above or paste a job description to extract required and preferred skills for your portfolio.'
              : 'Try clearing your search filters to view all saved job opportunities.'}
          </p>
          {jobs.length === 0 && (
            <button
              onClick={() => {
                setInitialModalUrl('https://boards.greenhouse.io/stripe/jobs/backend-software-engineer');
                setModalOpen(true);
              }}
              className="btn btn-secondary"
            >
              <Plus size={16} />
              <span>Import Sample Posting</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid-2">
          {filteredJobs.map((job) => {
            const isVerifiedUrl = job.sourceVerificationState === 'verified_url' || job.sourceVerificationState === 'verified_api';
            const dateStr = job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '';

            return (
              <div
                key={job._id}
                className="card"
                onClick={() => navigate(`/jobs/${job._id}`)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
              >
                <div>
                  {/* Top Badges & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isVerifiedUrl ? (
                        <span className="badge badge-demonstrated" style={{ fontSize: '0.68rem' }}>
                          <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
                          Verified Source
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                          User-Provided
                        </span>
                      )}
                      {job.employmentType && (
                        <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                          {job.employmentType}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteJob(job._id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Delete requirement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Title & Employer */}
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {job.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.employer}</span>
                    {job.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={12} color="var(--text-muted)" />
                        {job.location}
                      </span>
                    )}
                  </div>

                  {/* Role Summary if available */}
                  {job.roleSummary && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {job.roleSummary}
                    </p>
                  )}

                  {/* Required Skills Chips */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Required Skills ({job.requiredSkills?.length || 0}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(job.requiredSkills || []).slice(0, 5).map((skill) => (
                        <span key={skill} className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                          {skill}
                        </span>
                      ))}
                      {(job.requiredSkills || []).length > 5 && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem' }}>
                          +{(job.requiredSkills || []).length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preferred Skills Chips */}
                  {(job.preferredSkills || []).length > 0 && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Preferred ({job.preferredSkills?.length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(job.preferredSkills || []).slice(0, 4).map((skill) => (
                          <span key={skill} className="badge badge-partial" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '0.75rem',
                    marginTop: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={12} />
                    <span>Added {dateStr || 'Recently'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {job.originalSourceUrl && (
                      <a
                        href={job.originalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                        title="Open external source posting"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Inspect <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      {modalOpen && (
        <JobImportModal
          initialUrl={initialModalUrl}
          onClose={() => setModalOpen(false)}
          onSuccess={(newJob) => {
            loadJobs();
            if (newJob?._id) {
              navigate(`/jobs/${newJob._id}`);
            }
          }}
        />
      )}
    </div>
  );
}
