import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repoApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { TrackRepoModal } from '../components/TrackRepoModal.jsx';
import {
  GitFork,
  Plus,
  RefreshCw,
  ExternalLink,
  Trash2,
  GitBranch,
  GitCommit,
  Star,
  Play,
  Pause,
  Loader2,
  FileCode2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export function RepositoriesPage() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pollingRepoId, setPollingRepoId] = useState(null);
  const [error, setError] = useState('');

  const loadRepos = async () => {
    try {
      setLoading(true);
      const res = await repoApi.list();
      setRepos(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handlePollNow = async (repoId) => {
    setPollingRepoId(repoId);
    setError('');
    try {
      const res = await repoApi.pollNow(repoId);
      setRepos(repos.map((r) => (r._id === repoId ? res.data : r)));
    } catch (err) {
      setError(`Poll failed: ${err.message}`);
    } finally {
      setPollingRepoId(null);
    }
  };

  const handleToggleTracking = async (repo) => {
    try {
      if (repo.trackingState === 'active') {
        const res = await repoApi.pause(repo._id);
        setRepos(repos.map((r) => (r._id === repo._id ? res.data : r)));
      } else {
        const res = await repoApi.resume(repo._id);
        setRepos(repos.map((r) => (r._id === repo._id ? res.data : r)));
      }
    } catch (err) {
      setError(`Failed to update tracking: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to untrack ${name}?`)) return;
    try {
      await repoApi.delete(id);
      setRepos(repos.filter((r) => r._id !== id));
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Connected Repositories</h1>
          <p className="page-subtitle">
            Public and authorized GitHub repositories continuously monitored for code changes and skill evidence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/repositories/connect" className="btn btn-secondary" id="btn-goto-connect-page">
            <GitFork size={15} />
            <span>Connect Guide</span>
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-primary"
            id="btn-open-track-repo-modal"
          >
            <Plus size={15} />
            <span>Track Repository</span>
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--primary)" />
        </div>
      ) : repos.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <GitFork size={36} color="var(--primary)" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No Tracked Repositories Yet</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '440px' }}>
            Add your public GitHub repository to start inspecting code and automatically detecting skill proof.
          </p>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary">
            <Plus size={15} />
            <span>Add Repository</span>
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {repos.map((repo) => (
            <div
              key={repo._id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GitFork size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {repo.fullName}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${repo.trackingState === 'active' ? 'badge-demonstrated' : 'badge-not_demonstrated'}`}>
                      {repo.trackingState === 'active' ? 'Active Polling' : 'Paused'}
                    </span>
                    <button
                      onClick={() => handleDelete(repo._id, repo.fullName)}
                      style={{ color: 'var(--text-muted)', padding: '0.2rem' }}
                      title="Untrack repository"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                  {repo.description || 'Public GitHub repository'}
                </p>

                {/* Git metadata badges */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <GitBranch size={13} />
                    {repo.defaultBranch}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <GitCommit size={13} />
                    {repo.lastSuccessfullyAnalyzedSha ? repo.lastSuccessfullyAnalyzedSha.slice(0, 7) : 'Unanalyzed'}
                  </span>
                  {repo.stars > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" />
                      {repo.stars}
                    </span>
                  )}
                  {repo.language && (
                    <span style={{ background: 'var(--bg-subtle)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-sm)' }}>
                      {repo.language}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div
                style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handlePollNow(repo._id)}
                    disabled={pollingRepoId === repo._id}
                    className="btn btn-secondary btn-sm"
                    title="Poll repository now for new commits"
                  >
                    {pollingRepoId === repo._id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    <span>Check Commits</span>
                  </button>

                  <button
                    onClick={() => handleToggleTracking(repo)}
                    className="btn btn-secondary btn-sm"
                    title={repo.trackingState === 'active' ? 'Pause polling' : 'Resume polling'}
                  >
                    {repo.trackingState === 'active' ? <Pause size={13} /> : <Play size={13} />}
                    <span>{repo.trackingState === 'active' ? 'Pause' : 'Resume'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    to={`/repositories/${repo._id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '0.35rem' }}
                  >
                    <FileCode2 size={13} />
                    <span>Explore Code</span>
                  </Link>

                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem' }}
                    title="View on GitHub"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TrackRepoModal
          onClose={() => setModalOpen(false)}
          onSuccess={(newRepo) => {
            setRepos([newRepo, ...repos]);
          }}
        />
      )}
    </div>
  );
}
