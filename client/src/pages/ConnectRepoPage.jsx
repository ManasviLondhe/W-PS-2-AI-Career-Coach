import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { repoApi } from '../services/api.js';
import {
  GitFork,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Star,
  GitBranch,
  GitCommit,
  ShieldAlert,
  Info,
} from 'lucide-react';

export function ConnectRepoPage() {
  const [repoInput, setRepoInput] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState(1); // 1: input, 2: preview/verify, 3: connected
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setError('');
    setInspecting(true);

    try {
      let clean = repoInput.trim().replace(/\.git$/, '').replace(/\/+$/, '');
      const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/i) || clean.match(/^([^/]+)\/([^/]+)$/);
      if (!match) {
        throw new Error('Please enter a valid GitHub repository URL or "owner/repository".');
      }

      const res = await repoApi.inspect(match[1], match[2]);
      setPreview(res.data);
      setStep(2);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleConfirmConnect = async () => {
    if (!repoInput.trim()) return;
    setConnecting(true);
    setError('');

    try {
      const res = await repoApi.track({ repoUrl: repoInput.trim() });
      navigate(`/repositories/${res.data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <Link
        to="/repositories"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.86rem',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={15} />
        <span>Back to Repositories</span>
      </Link>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Bring your code into the picture.</h1>
        <p className="page-subtitle">
          Connect a repository so SkillProof AI can inspect the work behind your skills with automatic change detection.
        </p>
      </div>

      {/* Feature 2 Banner */}
      <div
        style={{
          background: 'var(--primary-subtle)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
          <div>
            <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Feature 2: Multi-Repository Portfolio Analysis</strong>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Scan entire profiles, choose specific branches, filter files, and extract traceable skill proof across multiple repositories.
            </p>
          </div>
        </div>
        <Link to="/portfolio-analysis" className="btn btn-primary btn-sm" id="btn-goto-portfolio-analysis">
          <span>Open Portfolio Analysis</span>
          <ArrowRight size={13} />
        </Link>
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

      {/* Progress Stepper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step >= 1 ? 'var(--primary)' : 'var(--text-muted)' }}>
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>1</span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Validate GitHub URL</span>
        </div>
        <div style={{ width: '40px', height: '1px', background: 'var(--border-light)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step >= 2 ? 'var(--primary)' : 'var(--text-muted)' }}>
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>2</span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Inspect Metadata</span>
        </div>
        <div style={{ width: '40px', height: '1px', background: 'var(--border-light)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: step >= 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>3</span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Continuous Polling</span>
        </div>
      </div>

      {/* Connection Input Card */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleInspect}>
          <div className="form-group">
            <label className="form-label">GitHub Repository URL or Identifier</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://github.com/facebook/react or octocat/Hello-World"
                  value={repoInput}
                  onChange={(e) => {
                    setRepoInput(e.target.value);
                    setPreview(null);
                    setStep(1);
                  }}
                  required
                  id="connect-repo-input"
                />
              </div>
              <button
                type="submit"
                disabled={inspecting || !repoInput.trim()}
                className="btn btn-primary"
                id="btn-inspect-connect"
              >
                {inspecting ? <Loader2 size={16} className="animate-spin" /> : <GitFork size={16} />}
                <span>{inspecting ? 'Verifying...' : 'Verify Repository'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Repository Preview Card */}
        {preview && (
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginTop: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitFork size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {preview.fullName}
                </h3>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Star size={14} fill="#f59e0b" color="#f59e0b" />
                {preview.stars} stars
              </span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              {preview.description || 'Public repository available for skill verification.'}
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitBranch size={13} />
                Branch: <strong>{preview.defaultBranch}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitCommit size={13} />
                Latest SHA: <strong>{preview.latestCommit?.sha?.slice(0, 7)}</strong>
              </span>
              {preview.language && (
                <span>Language: <strong>{preview.language}</strong></span>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleConfirmConnect}
                disabled={connecting}
                className="btn btn-primary"
                id="btn-confirm-connect-repo"
              >
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>{connecting ? 'Enrolling in Polling...' : 'Start Tracking Repository'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Permissions & Security Explanation */}
      <div
        className="card"
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-light)',
          fontSize: '0.84rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Info size={16} color="var(--primary)" />
          <strong style={{ color: 'var(--text-primary)' }}>Authorization & Privacy Guarantee</strong>
        </div>
        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <li>Public repositories require no authentication or token entry from users.</li>
          <li>Our backend service retrieves read-only AST content and commit history via the official GitHub REST API.</li>
          <li>Code is never permanently duplicated or used to train external public foundation models.</li>
          <li>New commits are detected automatically through our persistent background polling worker.</li>
        </ul>
      </div>
    </div>
  );
}
