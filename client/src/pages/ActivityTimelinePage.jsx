import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { activityApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  Activity,
  GitCommit,
  ShieldCheck,
  RefreshCw,
  GitFork,
  ExternalLink,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function ActivityTimelinePage({ latestEvent }) {
  const [events, setEvents] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [workerStatus, setWorkerStatus] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'commit', 'assessment'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadActivity = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await activityApi.getActivity({ limit: 40 });
      setEvents(res.data?.changeEvents || []);
      setRecentAssessments(res.data?.recentAssessments || []);
      setWorkerStatus(res.data?.workerStatus || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  // Live update when SSE fires
  useEffect(() => {
    if (latestEvent) {
      loadActivity(true);
    }
  }, [latestEvent]);

  // Combine and sort events
  const combinedEvents = [
    ...events.map((e) => ({
      id: e._id,
      type: 'commit',
      title: e.commitMessage || `Commit ${e.newSha?.slice(0, 7)}`,
      time: new Date(e.createdAt),
      repo: e.repository?.fullName,
      sha: e.newSha,
      previousSha: e.previousSha,
      changedFiles: e.changedFiles || [],
      affectedSkills: e.affectedSkills || [],
      assessmentId: e.resultingAssessment,
      revisionNumber: e.resultingAssessmentRevision,
    })),
    ...recentAssessments.map((a) => ({
      id: a._id,
      type: 'assessment',
      title: `Assessment Revision #${a.revisionNumber} Generated`,
      time: new Date(a.createdAt),
      repo: a.repository?.fullName,
      job: a.job?.title,
      employer: a.job?.employer,
      sha: a.commitSha,
      coverageScore: a.coverageScore,
      assessmentId: a._id,
      triggerType: a.triggeringEvent?.type || 'manual',
    })),
  ];

  combinedEvents.sort((a, b) => b.time - a.time);

  const filteredEvents = combinedEvents.filter((ev) => {
    if (filterType === 'all') return true;
    return ev.type === filterType;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">The proof is always evolving.</h1>
          <p className="page-subtitle">
            Chronological audit trail of repository changes, automated commit detections, and skill assessments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => loadActivity(true)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh Stream</span>
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

      {/* Worker Status Ribbon */}
      {workerStatus && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="live-pulse" />
            <strong style={{ color: 'var(--text-primary)' }}>Background Polling Worker:</strong>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              {workerStatus.isRunning ? 'Active & Healthy' : 'Idle'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span>Total Poll Cycles: <strong>{workerStatus.pollCount}</strong></span>
            <span>Active Repo Polls: <strong>{workerStatus.activeRepoPolls?.length || 0}</strong></span>
            <span>Live Clients: <strong>{workerStatus.connectedClients || 1}</strong></span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setFilterType('all')}
          className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Activity ({combinedEvents.length})
        </button>
        <button
          onClick={() => setFilterType('commit')}
          className={`btn btn-sm ${filterType === 'commit' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Commits Detected ({events.length})
        </button>
        <button
          onClick={() => setFilterType('assessment')}
          className={`btn btn-sm ${filterType === 'assessment' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Assessments Run ({recentAssessments.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--primary)" />
        </div>
      ) : filteredEvents.length === 0 ? (
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
          <Activity size={36} color="var(--text-muted)" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No Activity Recorded Yet</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
            When commits are pushed or assessments are run, events will appear here in real-time.
          </p>
        </div>
      ) : (
        /* Timeline Feed */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '1.15rem 1.35rem',
                flexWrap: 'wrap',
                gap: '1rem',
                borderLeft: `4px solid ${evt.type === 'commit' ? 'var(--primary)' : 'var(--success)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div
                  style={{
                    background: evt.type === 'commit' ? 'var(--primary-subtle)' : 'var(--success-subtle)',
                    color: evt.type === 'commit' ? 'var(--primary)' : 'var(--success)',
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '0.1rem',
                  }}
                >
                  {evt.type === 'commit' ? <GitCommit size={18} /> : <ShieldCheck size={18} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {evt.title}
                    </h3>
                    <span className={`badge ${evt.type === 'commit' ? 'badge-preferred' : 'badge-demonstrated'}`}>
                      {evt.type === 'commit' ? 'Commit Detected' : `Rev #${evt.revisionNumber || 'N/A'}`}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    {evt.type === 'commit' ? (
                      <>
                        Repository: <strong>{evt.repo}</strong> • Diff: {evt.changedFiles?.length || 0} file(s) changed
                        {evt.affectedSkills?.length > 0 && (
                          <span> • Affected skills: <em>{evt.affectedSkills.join(', ')}</em></span>
                        )}
                      </>
                    ) : (
                      <>
                        Target Role: <strong>{evt.job} ({evt.employer})</strong> • Evidence Coverage: <strong>{evt.coverageScore}%</strong>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span>{evt.time.toLocaleTimeString()} ({evt.time.toLocaleDateString()})</span>
                    {evt.sha && <span>SHA: {evt.sha.slice(0, 7)}</span>}
                  </div>
                </div>
              </div>

              {evt.assessmentId && (
                <Link
                  to={`/assessments/${evt.assessmentId}`}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem', alignSelf: 'center' }}
                >
                  <span>Open Assessment</span>
                  <ArrowRight size={13} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
