import React, { useState } from 'react';
import {
  X,
  Link2,
  FileText,
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';
import { jobApi } from '../services/api.js';

export function JobImportModal({ onClose, onSuccess, initialUrl = '' }) {
  const [tab, setTab] = useState('url'); // 'url' or 'pasted'
  const [stage, setStage] = useState('input'); // 'input', 'analyzing', 'review'

  // Input fields
  const [url, setUrl] = useState(initialUrl);
  const [manualTitle, setManualTitle] = useState('');
  const [manualEmployer, setManualEmployer] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Analysis / Review state
  const [analyzedData, setAnalyzedData] = useState(null);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewEmployer, setReviewEmployer] = useState('');
  const [reviewLocation, setReviewLocation] = useState('');
  const [reviewEmploymentType, setReviewEmploymentType] = useState('');
  const [reviewSummary, setReviewSummary] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillImportance, setNewSkillImportance] = useState('required');

  // Async states
  const [analysisStep, setAnalysisStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Handle URL Analysis Preview
  const handleAnalyzeUrl = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid public job posting URL.');
      return;
    }

    setError('');
    setStage('analyzing');
    setAnalysisStep(1);

    try {
      const stepTimer1 = setTimeout(() => setAnalysisStep(2), 600);
      const stepTimer2 = setTimeout(() => setAnalysisStep(3), 1400);

      const res = await jobApi.analyzeUrl(url.trim());
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const data = res.data;
      setAnalyzedData(data);
      setReviewTitle(data.title || manualTitle || 'Software Engineer');
      setReviewEmployer(data.employer || manualEmployer || 'Organization');
      setReviewLocation(data.location || '');
      setReviewEmploymentType(data.employmentType || '');
      setReviewSummary(data.roleSummary || '');
      setRequirements(data.normalizedRequirements || []);
      setStage('review');
    } catch (err) {
      setError(err.message || 'Unable to retrieve job posting.');
      setStage('input');
    }
  };

  // Handle Pasted Text Analysis Preview
  const handleAnalyzeText = async (e) => {
    if (e) e.preventDefault();
    if (!description.trim()) {
      setError('Please paste the job description text.');
      return;
    }

    setError('');
    setStage('analyzing');
    setAnalysisStep(2);

    try {
      const res = await jobApi.analyzeText({
        text: description.trim(),
        title: manualTitle.trim() || undefined,
        employer: manualEmployer.trim() || undefined,
      });

      const data = res.data;
      setAnalyzedData(data);
      setReviewTitle(data.title || manualTitle || 'Software Engineer');
      setReviewEmployer(data.employer || manualEmployer || 'Organization');
      setReviewLocation(data.location || '');
      setReviewEmploymentType(data.employmentType || '');
      setReviewSummary(data.roleSummary || '');
      setRequirements(data.normalizedRequirements || []);
      setStage('review');
    } catch (err) {
      setError(err.message || 'Analysis failed on pasted text.');
      setStage('input');
    }
  };

  // Toggle skill between required and preferred
  const handleToggleImportance = (skillName) => {
    setRequirements((prev) =>
      prev.map((r) => {
        if (r.name.toLowerCase() === skillName.toLowerCase()) {
          const nextImportance = r.importance === 'required' ? 'preferred' : 'required';
          return {
            ...r,
            importance: nextImportance,
            isRequired: nextImportance === 'required',
          };
        }
        return r;
      })
    );
  };

  // Remove a skill requirement
  const handleRemoveSkill = (skillName) => {
    setRequirements((prev) => prev.filter((r) => r.name.toLowerCase() !== skillName.toLowerCase()));
  };

  // Add a custom skill
  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    const name = newSkillName.trim();
    if (requirements.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      alert(`Skill "${name}" is already in the list.`);
      return;
    }

    setRequirements((prev) => [
      ...prev,
      {
        name,
        category: 'General',
        importance: newSkillImportance,
        isRequired: newSkillImportance === 'required',
        description: `Experience with ${name}`,
        source_excerpt: 'User-specified requirement',
        confidence: 'high',
      },
    ]);
    setNewSkillName('');
  };

  // Confirm and persist to database
  const handleConfirmSave = async () => {
    if (!reviewTitle.trim() || !reviewEmployer.trim()) {
      setError('Title and Employer are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isUrl = Boolean(analyzedData?.resolvedUrl || analyzedData?.originalUrl || (tab === 'url' && url));
      const payload = {
        type: isUrl ? 'url' : 'pasted',
        url: analyzedData?.resolvedUrl || analyzedData?.originalUrl || url.trim(),
        sourceUrl: sourceUrl.trim() || (isUrl ? url.trim() : ''),
        title: reviewTitle.trim(),
        employer: reviewEmployer.trim(),
        location: reviewLocation.trim(),
        employmentType: reviewEmploymentType.trim(),
        roleSummary: reviewSummary.trim(),
        description: analyzedData?.description || description.trim(),
        requiredSkills: requirements.filter((r) => r.importance === 'required').map((r) => r.name),
        preferredSkills: requirements.filter((r) => r.importance === 'preferred').map((r) => r.name),
        normalizedRequirements: requirements,
        responsibilities: analyzedData?.responsibilities || [],
        qualifications: analyzedData?.qualifications || [],
      };

      const res = await jobApi.import(payload);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save job requirement.');
      setSaving(false);
    }
  };

  // Fallback to paste when URL fails
  const handleFallbackToPaste = () => {
    setSourceUrl(url);
    setTab('pasted');
    setError('');
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="job-import-modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: stage === 'review' ? '780px' : '600px' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-accent" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                Feature 1: Job Ingestion
              </span>
              {analyzedData?.extractionMode === 'ai_llm' ? (
                <span className="badge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontSize: '0.68rem' }}>
                  <Sparkles size={11} style={{ marginRight: '3px' }} />
                  Gemini LLM
                </span>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                  Rule-Based Engine
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              {stage === 'review' ? 'Review & Confirm Requirements' : 'Analyze Job or Internship'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {stage === 'review'
                ? 'Review detected role metadata, required skills, and grounded source excerpts before saving.'
                : 'Import real job expectations from a public URL or paste posting text to verify your portfolio.'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Error Callout */}
        {error && (
          <div
            style={{
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Analysis Request Error</div>
              <div>{error}</div>
              {tab === 'url' && stage === 'input' && (
                <button
                  type="button"
                  onClick={handleFallbackToPaste}
                  className="btn btn-sm btn-secondary"
                  style={{ marginTop: '0.6rem', fontSize: '0.78rem' }}
                >
                  <FileText size={13} style={{ marginRight: '4px' }} />
                  Paste Description Manually Instead
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE 1: INPUT FORM */}
        {stage === 'input' && (
          <>
            {/* Tab Selector */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'var(--bg-subtle)',
                padding: '0.3rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setTab('url')}
                className={`btn btn-sm ${tab === 'url' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                id="tab-import-url"
              >
                <Link2 size={14} />
                <span>Public Job URL</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('pasted')}
                className={`btn btn-sm ${tab === 'pasted' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                id="tab-import-pasted"
              >
                <FileText size={14} />
                <span>Paste Description</span>
              </button>
            </div>

            {tab === 'url' ? (
              <form onSubmit={handleAnalyzeUrl}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-job-url">
                    Public Job Posting URL *
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://boards.greenhouse.io/stripe/jobs/1234 or https://jobs.lever.co/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    id="input-job-url"
                    autoFocus
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Info size={13} />
                    <span>Supports Greenhouse, Lever, Workable, and public company career web pages with SSRF protection.</span>
                  </div>
                </div>

                <div className="grid-2" style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Employer Name (Optional Hint)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Stripe, Figma"
                      value={manualEmployer}
                      onChange={(e) => setManualEmployer(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role Title (Optional Hint)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Backend Software Engineer"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" onClick={onClose} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" id="btn-submit-analyze-url">
                    <Sparkles size={16} />
                    <span>Analyze Job Posting</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAnalyzeText}>
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                  }}
                >
                  <strong>User-Provided Posting:</strong> Text pasted here will be analyzed and labeled as
                  user-provided. It is not independently verified against an external web server.
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Job Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Full Stack Intern"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company / Organization *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Figma"
                      value={manualEmployer}
                      onChange={(e) => setManualEmployer(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Original Source URL (Optional)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://company.com/careers/role"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Job Description Text *</label>
                  <textarea
                    className="form-textarea"
                    rows={7}
                    placeholder="Paste the full job description, qualifications, and requirements here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" onClick={onClose} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" id="btn-submit-analyze-text">
                    <Sparkles size={16} />
                    <span>Extract Requirements</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* STAGE 2: LIVE EXTRACTION PROGRESS */}
        {stage === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 1.25rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Analyzing Job Posting
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Evaluating requirements with SSRF security and natural language skill extraction.
            </p>

            <div style={{ maxWidth: '380px', margin: '0 auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.84rem' }}>
                <CheckCircle2 size={18} color="var(--status-demonstrated)" />
                <span>Validating endpoint security & safe protocol</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.84rem' }}>
                {analysisStep >= 2 ? (
                  <CheckCircle2 size={18} color="var(--status-demonstrated)" />
                ) : (
                  <Loader2 size={18} className="animate-spin" color="var(--accent-primary)" />
                )}
                <span>Retrieving public posting & stripping noise</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.84rem' }}>
                {analysisStep >= 3 ? (
                  <CheckCircle2 size={18} color="var(--status-demonstrated)" />
                ) : (
                  <Loader2 size={18} className="animate-spin" color="var(--accent-primary)" />
                )}
                <span>Categorizing required vs preferred skills</span>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: REVIEW & CONFIRM */}
        {stage === 'review' && (
          <div>
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Detected Role Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Employer / Organization</label>
                  <input
                    type="text"
                    className="form-input"
                    value={reviewEmployer}
                    onChange={(e) => setReviewEmployer(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginTop: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Location (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Remote, San Francisco, CA"
                    value={reviewLocation}
                    onChange={(e) => setReviewLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Employment Type</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Full-time, Internship"
                    value={reviewEmploymentType}
                    onChange={(e) => setReviewEmploymentType(e.target.value)}
                  />
                </div>
              </div>

              {analyzedData?.resolvedUrl && (
                <div style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Verified Source: </span>
                  <a
                    href={analyzedData.resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    {analyzedData.resolvedUrl.slice(0, 60)}...
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>

            {/* Extracted Role Summary */}
            {reviewSummary && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Role Summary
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', background: 'var(--card-bg)', border: '1px solid var(--border-light)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                  {reviewSummary}
                </p>
              </div>
            )}

            {/* Requirements Matrix */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  Extracted Skills & Requirements ({requirements.length})
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click badge to toggle Required ⇄ Preferred
                </span>
              </div>

              {/* Required Skills */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--status-demonstrated)', marginBottom: '0.35rem' }}>
                  Required Skills ({requirements.filter((r) => r.importance === 'required').length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {requirements
                    .filter((r) => r.importance === 'required')
                    .map((req) => (
                      <span
                        key={req.name}
                        className="badge badge-demonstrated"
                        style={{ cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                        title="Click to switch to Preferred"
                        onClick={() => handleToggleImportance(req.name)}
                      >
                        <strong>{req.name}</strong>
                        <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: '4px' }}>
                          ({req.category})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSkill(req.name);
                          }}
                          style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  {requirements.filter((r) => r.importance === 'required').length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No explicit required skills found.</span>
                  )}
                </div>
              </div>

              {/* Preferred Skills */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--status-partial)', marginBottom: '0.35rem' }}>
                  Preferred / Nice-to-Have Skills ({requirements.filter((r) => r.importance === 'preferred').length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {requirements
                    .filter((r) => r.importance === 'preferred')
                    .map((req) => (
                      <span
                        key={req.name}
                        className="badge badge-partial"
                        style={{ cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                        title="Click to switch to Required"
                        onClick={() => handleToggleImportance(req.name)}
                      >
                        <strong>{req.name}</strong>
                        <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: '4px' }}>
                          ({req.category})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSkill(req.name);
                          }}
                          style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  {requirements.filter((r) => r.importance === 'preferred').length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No preferred skills categorized.</span>
                  )}
                </div>
              </div>

              {/* Add Custom Skill Form */}
              <form onSubmit={handleAddCustomSkill} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="Add missing skill (e.g. GraphQL, Kubernetes)..."
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                />
                <select
                  className="form-input"
                  style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                  value={newSkillImportance}
                  onChange={(e) => setNewSkillImportance(e.target.value)}
                >
                  <option value="required">Required</option>
                  <option value="preferred">Preferred</option>
                </select>
                <button type="submit" className="btn btn-secondary btn-sm">
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Grounded Excerpts Preview */}
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'var(--code-panel-bg)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: 700 }}>
                Grounded Excerpts from Posting Text:
              </div>
              {requirements.slice(0, 5).map((r) => (
                <div key={r.name} style={{ fontSize: '0.76rem', color: '#CBD5E1', marginBottom: '0.35rem', fontFamily: 'monospace' }}>
                  <span style={{ color: '#38BDF8', fontWeight: 600 }}>{r.name}:</span>{' '}
                  <span style={{ color: '#94A3B8' }}>"{r.source_excerpt || r.description}"</span>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setStage('input')}
                className="btn btn-secondary btn-sm"
              >
                Back to Edit
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="btn btn-primary"
                  disabled={saving}
                  id="btn-confirm-save-job"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving to Workspace...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Save Requirement</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
