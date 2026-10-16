import React, { useState } from 'react';
import { X, Link2, FileText, Loader2, Sparkles } from 'lucide-react';
import { jobApi } from '../services/api.js';

export function JobImportModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('url'); // 'url' or 'pasted'
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [employer, setEmployer] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [preferredSkills, setPreferredSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let payload;
      if (tab === 'url') {
        if (!url.trim()) throw new Error('Please enter a job URL.');
        payload = {
          type: 'url',
          url: url.trim(),
          title: title.trim() || undefined,
          employer: employer.trim() || undefined,
        };
      } else {
        if (!title.trim() || !employer.trim()) {
          throw new Error('Title and Employer are required.');
        }
        payload = {
          type: 'pasted',
          title: title.trim(),
          employer: employer.trim(),
          description: description.trim(),
          requiredSkills: requiredSkills
            ? requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          preferredSkills: preferredSkills
            ? preferredSkills.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        };
      }

      const res = await jobApi.import(payload);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="job-import-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Import Job Requirement
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Add a real job posting to verify portfolio skill coverage against.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--bg-subtle)',
            padding: '0.3rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
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
            <span>Public URL / API Board</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pasted')}
            className={`btn btn-sm ${tab === 'pasted' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, border: 'none' }}
            id="tab-import-pasted"
          >
            <FileText size={14} />
            <span>Paste Job Description</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {tab === 'url' ? (
            <>
              <div className="form-group">
                <label className="form-label">Job Posting URL *</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://boards.greenhouse.io/company/jobs/1234 or https://jobs.lever.co/company/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  id="input-job-url"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Greenhouse and Lever boards are automatically queried via official public APIs.
                </p>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Employer (Optional override)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Stripe"
                    value={employer}
                    onChange={(e) => setEmployer(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Title (Optional override)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Software Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Job Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Backend Software Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    id="input-pasted-title"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Employer *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acme Corp"
                    value={employer}
                    onChange={(e) => setEmployer(e.target.value)}
                    required
                    id="input-pasted-employer"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Job Description / Requirements Text</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="Paste the full job description or requirements section here..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  id="input-pasted-description"
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Required Skills (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Java, SQL, REST APIs"
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Skills (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Docker, CI/CD, MongoDB"
                    value={preferredSkills}
                    onChange={(e) => setPreferredSkills(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" id="btn-submit-import-job">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{loading ? 'Importing...' : 'Import & Extract Skills'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
