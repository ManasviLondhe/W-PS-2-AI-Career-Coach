import React, { useState, useEffect } from 'react';
import { activityApi } from '../services/api.js';
import {
  Settings,
  Database,
  Cpu,
  Server,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Info,
  GitFork,
} from 'lucide-react';

export function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchHealth = async () => {
    try {
      setRefreshing(true);
      const res = await activityApi.getHealth();
      setHealth(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  const dbConnected = health?.database?.connected;
  const dbStatus = health?.database?.status || 'unknown';
  const ghRate = health?.githubRateLimit || { remaining: 60, limit: 60, hasToken: false };
  const worker = health?.worker || { isRunning: true, pollCount: 0 };
  const llm = health?.llm || { provider: 'deterministic', configured: true };

  return (
    <div style={{ maxWidth: '860px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & System Health</h1>
          <p className="page-subtitle">
            Inspect live backend infrastructure status, database connectivity, and GitHub API quotas.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
          id="btn-refresh-health"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Probing...' : 'Re-check Health'}</span>
        </button>
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

      {/* Infrastructure Health Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {/* Backend Node Server */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'var(--primary-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <Server size={18} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Node.js / Express Backend</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Environment: {health?.environment || 'development'} • Uptime: {Math.floor(health?.uptime || 0)}s
                </span>
              </div>
            </div>

            <span className="badge badge-demonstrated">
              <CheckCircle2 size={12} /> Service Online
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Serving REST endpoints, rate limiting, and Server-Sent Event (SSE) streams for live change detection.
          </p>
        </div>

        {/* MongoDB Database */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: dbConnected ? 'var(--success-subtle)' : 'var(--warning-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <Database size={18} color={dbConnected ? 'var(--success)' : 'var(--warning)'} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>MongoDB Database</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  State: <strong>{dbStatus}</strong> (Atlas or in-memory fallback)
                </span>
              </div>
            </div>

            <span className={`badge ${dbConnected ? 'badge-demonstrated' : 'badge-partially_demonstrated'}`}>
              {dbConnected ? 'Connected' : 'Connecting'}
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Houses jobs, repositories, immutable assessment revisions, change events, and code evidence anchors.
          </p>
        </div>

        {/* GitHub REST API */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <GitFork size={18} color="var(--text-primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>GitHub Integration (Octokit)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Quota: <strong>{ghRate.remaining} / {ghRate.limit}</strong> remaining
                </span>
              </div>
            </div>

            <span className="badge badge-demonstrated">
              {ghRate.hasToken ? 'Authenticated Token' : 'Public API Mode'}
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Retrieves tree metadata, AST files, and diff comparisons. Public repositories require no user tokens.
          </p>
        </div>

        {/* AI & Assessment Engine */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'var(--primary-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <Cpu size={18} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Skill Evaluation Engine</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Provider: <strong>{llm.provider.toUpperCase()}</strong> (Deterministic Rule Engine)
                </span>
              </div>
            </div>

            <span className="badge badge-demonstrated">
              Deterministic Ready
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Inspects syntax patterns for SQL, Java, React, Node.js, and tests with 100% explainable, unhallucinated reasoning.
          </p>
        </div>
      </div>

      {/* Architecture Disclaimer */}
      <div
        className="card"
        style={{
          background: 'var(--bg-subtle)',
          borderLeft: '4px solid var(--primary)',
          fontSize: '0.84rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Info size={16} color="var(--primary)" />
          <strong style={{ color: 'var(--text-primary)' }}>Single-User Hackathon Prototype Architecture</strong>
        </div>
        <p>
          SkillProof AI is deployed in single-user demonstration mode. All MongoDB credentials, GitHub access tokens, and LLM API keys are isolated exclusively in server environment variables and are never transmitted to or accessible from browser clients.
        </p>
      </div>
    </div>
  );
}
