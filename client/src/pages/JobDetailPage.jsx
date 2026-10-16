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
  Calendar,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  MapPin,
  Clock,
  Edit3,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Info,
  Layers,
  FileText,
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);

  // Edit Requirements Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editEmployer, setEditEmployer] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editEmploymentType, setEditEmploymentType] = useState('');
  const [editRequirements, setEditRequirements] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [newSkillImportance, setNewSkillImportance] = useState('required');
  const [savingEdit, setSavingEdit] = useState(false);

  const navigate = useNavigate();

  const fetchJobAndRepos = async () => {
    try {
      setLoading(true);
      setError('');
      const [jobRes, repoRes] = await Promise.all([jobApi.get(id), repoApi.list()]);
      setJob(jobRes.data);
      const repoList = repoRes.data || [];
      setRepos(repoList);
      if (repoList.length > 0 && !selectedRepoId) setSelectedRepoId(repoList[0]._id);
    } catch (err) {
      setError(err.message || 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      setError(err.message || 'Assessment failed to start.');
    } finally {
      setAssessing(false);
    }
  };

  const handleRetryAnalysis = async () => {
    setExtracting(true);
    setError('');
    try {
      const res = await jobApi.retryAnalysis(job._id);
      setJob(res.data);
    } catch (err) {
      setError(err.message || 'Re-extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const handleCopyDescription = () => {
    if (!job?.description) return;
    navigator.clipboard.writeText(job.description);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Open Edit Modal
  const openEditModal = () => {
    setEditTitle(job.title || '');
    setEditEmployer(job.employer || '');
    setEditLocation(job.location || '');
    setEditEmploymentType(job.employmentType || '');
    setEditRequirements(
      job.normalizedRequirements && job.normalizedRequirements.length > 0
        ? job.normalizedRequirements
        : [
            ...(job.requiredSkills || []).map((s) => ({ name: s, importance: 'required', isRequired: true })),
            ...(job.preferredSkills || []).map((s) => ({ name: s, importance: 'preferred', isRequired: false })),
          ]
    );
    setEditModalOpen(true);
  };

  // Save Edited Requirements
  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editEmployer.trim()) {
      alert('Title and Employer are required.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await jobApi.update(job._id, {
        title: editTitle.trim(),
        employer: editEmployer.trim(),
        location: editLocation.trim(),
        employmentType: editEmploymentType.trim(),
        normalizedRequirements: editRequirements,
        requiredSkills: editRequirements.filter((r) => r.importance === 'required' || r.isRequired).map((r) => r.name),
        preferredSkills: editRequirements.filter((r) => r.importance === 'preferred' && !r.isRequired).map((r) => r.name),
      });

      setJob(res.data);
      setEditModalOpen(false);
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading job requirement details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
        <AlertCircle size={36} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Job Posting Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          The requested job requirement could not be found or may have been deleted.
        </p>
        <Link to="/jobs" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to All Jobs</span>
        </Link>
      </div>
    );
  }

  const isVerifiedUrl = job.sourceVerificationState === 'verified_url' || job.sourceVerificationState === 'verified_api';
  const reqList = job.normalizedRequirements || [];
  const requiredReqs = reqList.filter((r) => r.importance === 'required' || r.isRequired);
  const preferredReqs = reqList.filter((r) => r.importance === 'preferred' && !r.isRequired);

  return (
    <div>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/jobs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Job Requirements</span>
        </Link>

        {/* Title & Metadata Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                {job.employer}
              </span>

              {isVerifiedUrl ? (
                <span className="badge badge-demonstrated" style={{ fontSize: '0.72rem' }}>
                  <CheckCircle2 size={12} style={{ marginRight: '3px' }} />
                  Verified External Posting
                </span>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                  User-Provided Description
                </span>
              )}

              {job.location && (
                <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                  <MapPin size={11} style={{ marginRight: '3px' }} />
                  {job.location}
                </span>
              )}

              {job.employmentType && (
                <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                  {job.employmentType}
                </span>
              )}
            </div>

            <h1 className="page-title">{job.title}</h1>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={openEditModal}
              className="btn btn-secondary btn-sm"
              id="btn-edit-job"
            >
              <Edit3 size={14} />
              <span>Edit Requirements</span>
            </button>

            <button
              onClick={handleRetryAnalysis}
              disabled={extracting}
              className="btn btn-secondary btn-sm"
              id="btn-retry-analysis"
              title="Re-run AI extraction on original description"
            >
              <RefreshCw size={14} className={extracting ? 'animate-spin' : ''} />
              <span>{extracting ? 'Re-extracting...' : 'Re-analyze with AI'}</span>
            </button>

            {job.originalSourceUrl && (
              <a
                href={job.originalSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ gap: '0.4rem' }}
                id="link-view-source"
              >
                <span>View Original Posting</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Role Summary Callout */}
      {job.roleSummary && (
        <div
          className="card"
          style={{
            background: 'var(--accent-subtle)',
            borderColor: 'var(--accent-primary)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            <Sparkles size={14} />
            <span>Extracted Role Summary</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {job.roleSummary}
          </p>
        </div>
      )}

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
          }}
        >
          {error}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid-3" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column (Span 2): Structured Requirements & Original Source */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Required Skills Matrix */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 className="card-title" style={{ color: 'var(--status-demonstrated)' }}>
                  <CheckCircle2 size={18} />
                  <span>Required Skills ({requiredReqs.length})</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Mandatory qualifications explicitly expected for this position.
                </p>
              </div>
            </div>

            {requiredReqs.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No explicit required skills categorized.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {requiredReqs.map((req) => (
                  <div
                    key={req.name}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {req.name}
                        </span>
                        <span className="badge badge-accent" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          {req.category || 'General'}
                        </span>
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        Confidence: {req.confidence || 'high'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      {req.description}
                    </p>

                    {req.source_excerpt && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontFamily: 'monospace',
                          color: '#475569',
                          background: '#FFFFFF',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '4px',
                          borderLeft: '3px solid var(--status-demonstrated)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--status-demonstrated)' }}>Excerpt: </span>
                        "{req.source_excerpt}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preferred / Nice-to-Have Skills */}
          {preferredReqs.length > 0 && (
            <div className="card">
              <div style={{ marginBottom: '1rem' }}>
                <h3 className="card-title" style={{ color: 'var(--status-partial)' }}>
                  <Sparkles size={18} />
                  <span>Preferred Skills ({preferredReqs.length})</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Bonus points or nice-to-have technologies not strictly required to apply.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {preferredReqs.map((req) => (
                  <div
                    key={req.name}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {req.name}
                        </span>
                        <span className="badge badge-partial" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          {req.category || 'General'}
                        </span>
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        Confidence: {req.confidence || 'high'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      {req.description}
                    </p>

                    {req.source_excerpt && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontFamily: 'monospace',
                          color: '#475569',
                          background: '#FFFFFF',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '4px',
                          borderLeft: '3px solid var(--status-partial)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--status-partial)' }}>Excerpt: </span>
                        "{req.source_excerpt}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Responsibilities & Qualifications if available */}
          {(job.responsibilities?.length > 0 || job.qualifications?.length > 0) && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '1rem' }}>
                <Layers size={18} color="var(--accent-primary)" />
                <span>Responsibilities & Criteria</span>
              </h3>

              {job.responsibilities?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Core Responsibilities
                  </div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {job.responsibilities.map((resp, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>{resp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.qualifications?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Stated Qualifications
                  </div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {job.qualifications.map((qual, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>{qual}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Original Job Description Content */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 className="card-title">
                  <FileText size={18} color="var(--text-secondary)" />
                  <span>Original Job Description</span>
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Unmodified source text retrieved from {job.sourceType === 'manual_url' ? 'URL' : job.sourceType}.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyDescription}
                className="btn btn-sm btn-secondary"
                title="Copy raw description"
              >
                {copySuccess ? <Check size={13} color="var(--status-demonstrated)" /> : <Copy size={13} />}
                <span>{copySuccess ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>

            <div
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-subtle)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'inherit',
                maxHeight: expandedDesc ? 'none' : '260px',
                overflowY: expandedDesc ? 'visible' : 'hidden',
                position: 'relative',
              }}
            >
              {job.description || 'No raw text provided for this posting.'}

              {!expandedDesc && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'linear-gradient(to bottom, transparent, var(--bg-subtle))',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setExpandedDesc(!expandedDesc)}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
            >
              {expandedDesc ? (
                <>
                  <ChevronUp size={14} />
                  <span>Collapse Description</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>Expand Full Description</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Assessment Action & Extraction Transparency */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Action Box: Compare with My Portfolio */}
          <div className="card" style={{ border: '2px solid var(--accent-primary)', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              EVIDENCE VERIFICATION
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.35rem 0 0.65rem' }}>
              Compare with Repository
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Inspect your actual GitHub codebase against these exact {requiredReqs.length} required skills.
            </p>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Connected Repository</label>
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
              style={{ width: '100%', gap: '0.5rem', height: '42px' }}
              id="btn-job-compare"
            >
              {assessing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              <span>{assessing ? 'Analyzing Evidence...' : 'Run Portfolio Assessment'}</span>
            </button>
          </div>

          {/* Extraction Transparency Box */}
          <div className="card">
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              Ingestion & AI Audit
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                <span>Ingestion Source:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{job.sourceType}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                <span>Extraction Engine:</span>
                <strong style={{ color: job.extractionMode === 'ai_llm' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                  {job.extractionMode === 'ai_llm' ? 'Gemini 1.5 Flash' : 'Rule-Based Engine'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                <span>Extraction Status:</span>
                <strong style={{ color: 'var(--status-demonstrated)' }}>{job.extractionStatus || 'completed'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Retrieved:</span>
                <span>{new Date(job.retrievalTimestamp || job.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {job.extractionLimitations && (
              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.6rem 0.75rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Extraction Notes:</div>
                {job.extractionLimitations}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Requirements Modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Job Requirements</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Correct detected role metadata or manually adjust required vs preferred skills.
                </p>
              </div>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Role Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employer *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editEmployer}
                  onChange={(e) => setEditEmployer(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employment Type</label>
                <input
                  type="text"
                  className="form-input"
                  value={editEmploymentType}
                  onChange={(e) => setEditEmploymentType(e.target.value)}
                />
              </div>
            </div>

            {/* Editable Skills List */}
            <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Skills ({editRequirements.length})
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                {editRequirements.map((r) => (
                  <span
                    key={r.name}
                    className={`badge ${r.importance === 'required' || r.isRequired ? 'badge-demonstrated' : 'badge-partial'}`}
                    style={{ cursor: 'pointer', padding: '0.35rem 0.6rem' }}
                    onClick={() => {
                      setEditRequirements((prev) =>
                        prev.map((item) =>
                          item.name === r.name
                            ? { ...item, importance: item.importance === 'required' ? 'preferred' : 'required', isRequired: item.importance !== 'required' }
                            : item
                        )
                      );
                    }}
                    title="Click to toggle Required ⇄ Preferred"
                  >
                    <strong>{r.name}</strong> ({r.importance || (r.isRequired ? 'required' : 'preferred')})
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditRequirements((prev) => prev.filter((item) => item.name !== r.name));
                      }}
                      style={{ marginLeft: '6px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Custom Skill */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  style={{ flex: 1, padding: '0.35rem 0.6rem' }}
                />
                <select
                  className="form-input"
                  value={newSkillImportance}
                  onChange={(e) => setNewSkillImportance(e.target.value)}
                  style={{ width: '120px', padding: '0.35rem 0.6rem' }}
                >
                  <option value="required">Required</option>
                  <option value="preferred">Preferred</option>
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!newSkill.trim()) return;
                    setEditRequirements((prev) => [
                      ...prev,
                      {
                        name: newSkill.trim(),
                        category: 'General',
                        importance: newSkillImportance,
                        isRequired: newSkillImportance === 'required',
                        description: `Experience with ${newSkill.trim()}`,
                        source_excerpt: 'User-specified requirement',
                        confidence: 'high',
                      },
                    ]);
                    setNewSkill('');
                  }}
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setEditModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="btn btn-primary"
              >
                {savingEdit ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
