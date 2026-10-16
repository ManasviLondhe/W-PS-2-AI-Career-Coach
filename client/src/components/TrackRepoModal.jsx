import React, { useState } from 'react';
import { X, GitFork, Loader2, Star, GitBranch, GitCommit, Check } from 'lucide-react';
import { repoApi } from '../services/api.js';

export function TrackRepoModal({ onClose, onSuccess }) {
  const [repoInput, setRepoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle preview inspection
  const handleInspect = async () => {
    if (!repoInput.trim()) return;
    setError('');
    setPreviewLoading(true);

    try {
      let clean = repoInput.trim().replace(/\.git$/, '').replace(/\/+$/, '');
      const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/i) || clean.match(/^([^/]+)\/([^/]+)$/);
      if (!match) {
        throw new Error('Enter a valid GitHub URL or "owner/repository".');
      }

      const res = await repoApi.inspect(match[1], match[2]);
      setPreview(res.data);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await repoApi.track({ repoUrl: repoInput.trim() });
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="track-repo-modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Track GitHub Repository
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Add a public or authorized repository for continuous skill verification.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
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
          <div className="form-group">
            <label className="form-label">GitHub Repository URL or Name *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/owner/repository or owner/repository"
                value={repoInput}
                onChange={(e) => {
                  setRepoInput(e.target.value);
                  setPreview(null);
                }}
                required
                id="input-repo-url"
              />
              <button
                type="button"
                onClick={handleInspect}
                disabled={previewLoading || !repoInput.trim()}
                className="btn btn-secondary"
                style={{ flexShrink: 0 }}
                id="btn-inspect-repo"
              >
                {previewLoading ? <Loader2 size={15} className="animate-spin" /> : <GitFork size={15} />}
                <span>Verify</span>
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Public repositories require no authentication. Background worker will poll for new commits.
            </p>
          </div>

          {/* Repository Preview Card */}
          {preview && (
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {preview.fullName}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Star size={13} fill="#f59e0b" color="#f59e0b" />
                  {preview.stars}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                {preview.description || 'No description provided.'}
              </p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <GitBranch size={12} />
                  {preview.defaultBranch}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <GitCommit size={12} />
                  {preview.latestCommit?.sha?.slice(0, 7)}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" id="btn-submit-track-repo">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{loading ? 'Adding...' : 'Start Tracking Repository'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
