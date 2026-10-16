import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assessmentApi, repoApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  History,
  GitCommit,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  ExternalLink,
  Loader2,
  Sparkles,
  FileCode,
  Layers,
} from 'lucide-react';

export function AssessmentHistoryPage() {
  const { id } = useParams();
  const [history, setHistory] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(id || '');
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');

  // Fetch revisions list
  useEffect(() => {
    async function fetchRevisions() {
      try {
        setLoading(true);
        let targetId = selectedAssessmentId;

        // If no ID provided, find latest assessment
        if (!targetId) {
          const listRes = await assessmentApi.list({ limit: 1 });
          const first = listRes.data?.assessments?.[0];
          if (first) {
            targetId = first._id;
            setSelectedAssessmentId(first._id);
          }
        }

        if (targetId) {
          const histRes = await assessmentApi.history(targetId);
          setHistory(histRes.data || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRevisions();
  }, [selectedAssessmentId]);

  // Load comparison data whenever assessment ID changes
  useEffect(() => {
    if (!selectedAssessmentId) return;

    async function loadComparison() {
      try {
        setComparing(true);
        const res = await assessmentApi.compare(selectedAssessmentId);
        setCompareData(res.data);
      } catch (err) {
        console.warn('Compare failed:', err.message);
      } finally {
        setComparing(false);
      }
    }
    loadComparison();
  }, [selectedAssessmentId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  const current = compareData?.current;
  const previous = compareData?.previous;
  const comparison = compareData?.comparison || [];
  const changeEvent = compareData?.changeEvent;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Your progress, with receipts.</h1>
          <p className="page-subtitle">
            Auditable before-and-after comparisons across git commits. Watch assessments evolve as you push code.
          </p>
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

      {/* Revision Selection Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <label className="form-label" style={{ margin: 0, marginBottom: '0.35rem' }}>
              Select Assessment Revision
            </label>
            <select
              className="form-select"
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              style={{ minWidth: '320px' }}
              id="select-history-revision"
            >
              {history.map((rev) => (
                <option key={rev._id} value={rev._id}>
                  Revision #{rev.revisionNumber} ({new Date(rev.createdAt).toLocaleTimeString()}) • {rev.coverageScore}% coverage ({rev.triggeringEvent?.type || 'manual'})
                </option>
              ))}
            </select>
          </div>

          {current && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Role: </span>
                <strong>{current.job?.title}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Repo: </span>
                <strong>{current.repository?.fullName}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {comparing ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={24} className="animate-spin" color="var(--primary)" />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Comparing revision snapshots...</p>
        </div>
      ) : current ? (
        <>
          {/* Comparison Overview Metrics */}
          <div className="grid-3" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                CURRENT SNAPSHOT
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                Revision #{current.revisionNumber}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Coverage Score: <strong>{current.coverageScore}%</strong>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Commit: {current.commitSha?.slice(0, 7)}
              </div>
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                PREVIOUS BASELINE
              </span>
              {previous ? (
                <>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Revision #{previous.revisionNumber}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Coverage Score: <strong>{previous.coverageScore}%</strong>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Commit: {previous.commitSha?.slice(0, 7)}
                  </div>
                </>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  This is the initial baseline assessment (Rev #1). No prior revision exists.
                </div>
              )}
            </div>

            <div className="card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                COVERAGE DELTA
              </span>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: (compareData?.coverageDiff || 0) >= 0 ? 'var(--success)' : 'var(--danger)',
                  marginTop: '0.25rem',
                }}
              >
                {(compareData?.coverageDiff || 0) >= 0 ? `+${compareData?.coverageDiff || 0}%` : `${compareData?.coverageDiff}%`}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {comparison.filter((c) => c.statusChanged).length} skill status change(s)
              </div>
            </div>
          </div>

          {/* Triggering Commit Details */}
          {current.triggeringEvent && (
            <div
              className="card"
              style={{
                marginBottom: '2rem',
                background: 'var(--bg-subtle)',
                borderLeft: '4px solid var(--primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GitCommit size={17} color="var(--primary)" />
                  <strong style={{ fontSize: '0.95rem' }}>
                    Triggering Event: {current.triggeringEvent.type === 'commit_detected' ? 'Automatic Git Push Detection' : 'Initial Assessment'}
                  </strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  SHA: {current.commitSha?.slice(0, 7)}
                </span>
              </div>

              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                &quot;{current.triggeringEvent.message || 'Commit pushed to default branch'}&quot;
              </p>

              {changeEvent?.changedFiles?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Changed Files Identified by Worker ({changeEvent.changedFiles.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {changeEvent.changedFiles.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid var(--border-light)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {f.filename} ({f.status})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Before & After Revision Comparison Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                Competency Status Comparison (Rev #{previous?.revisionNumber || 0} → Rev #{current.revisionNumber})
              </h3>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Classification</th>
                  <th>Previous Status</th>
                  <th>Current Status</th>
                  <th>Status Transition</th>
                  <th>New Evidence</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((item) => (
                  <tr key={item.skill}>
                    <td>
                      <span style={{ fontWeight: 800 }}>{item.skill}</span>
                    </td>
                    <td>
                      <Badge status={item.classification} type="classification" />
                    </td>
                    <td>
                      {previous ? (
                        <Badge status={item.previousStatus} />
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Initial Rev</span>
                      )}
                    </td>
                    <td>
                      <Badge status={item.currentStatus} />
                    </td>
                    <td>
                      {item.statusChanged ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: item.currentStatus === 'demonstrated' ? 'var(--success)' : 'var(--warning)',
                            background: item.currentStatus === 'demonstrated' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          Status Updated
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Unchanged
                        </span>
                      )}
                    </td>
                    <td>
                      {item.newEvidenceIds?.length > 0 ? (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)' }}>
                          +{item.newEvidenceIds.length} new anchor(s)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          No revision selected.
        </div>
      )}
    </div>
  );
}
