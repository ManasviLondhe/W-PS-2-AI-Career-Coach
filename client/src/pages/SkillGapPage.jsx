/**
 * SkillGapPage — Feature 4: Personalized Skill-Gap Analysis
 *
 * This page:
 *  1. Loads the assessment and its skill results.
 *  2. Fetches or generates persistent recommendations from the backend.
 *  3. Displays each gap with evidence context, recommended tasks, steps, and criteria.
 *  4. Lets the student track task progress (pending → in_progress → completed).
 *  5. Clearly communicates that task completion does NOT change the skill assessment.
 *  6. Shows whether recommendations are stale after a new assessment revision.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assessmentApi, repoApi, recommendationsApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ExternalLink,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Target,
  CircleDot,
  Clock,
  AlertTriangle,
  ListChecks,
  Zap,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Task status config
// ---------------------------------------------------------------------------

const TASK_STATUS_CONFIG = {
  pending: {
    label: 'Not Started',
    color: 'var(--text-muted)',
    bg: 'var(--bg-subtle)',
    border: 'var(--border-light)',
    icon: CircleDot,
  },
  in_progress: {
    label: 'In Progress',
    color: 'var(--warning)',
    bg: 'var(--warning-subtle)',
    border: 'var(--warning-border)',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    color: 'var(--success)',
    bg: 'var(--success-subtle)',
    border: 'var(--success-border)',
    icon: CheckCircle2,
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskStatusButton({ current, value, onChange, loading }) {
  const cfg = TASK_STATUS_CONFIG[value];
  const Icon = cfg.icon;
  const isActive = current === value;

  return (
    <button
      id={`task-status-${value}`}
      onClick={() => !isActive && onChange(value)}
      disabled={loading || isActive}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.35rem 0.75rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.76rem',
        fontWeight: 700,
        border: `1px solid ${isActive ? cfg.border : 'var(--border-light)'}`,
        background: isActive ? cfg.bg : 'transparent',
        color: isActive ? cfg.color : 'var(--text-muted)',
        cursor: isActive ? 'default' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: loading ? 0.6 : 1,
      }}
      title={isActive ? `Current status: ${cfg.label}` : `Mark as ${cfg.label}`}
    >
      <Icon size={12} />
      {cfg.label}
    </button>
  );
}

function LearningResourceLink({ resource }) {
  const typeIcons = {
    documentation: '📖',
    tutorial: '🎓',
    course: '🏫',
    article: '📄',
    video: '🎬',
    tool: '🔧',
  };

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.6rem 0.8rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        textDecoration: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary-border)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(81,70,229,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>
        {typeIcons[resource.type] || '🔗'}
      </span>
      <div>
        <div
          style={{
            fontSize: '0.84rem',
            fontWeight: 600,
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          {resource.title}
          <ExternalLink size={11} />
        </div>
        {resource.description && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            {resource.description}
          </div>
        )}
      </div>
    </a>
  );
}

function RecommendationCard({ rec, onProgressUpdate, updatingId }) {
  const [expanded, setExpanded] = useState(false);
  const taskCfg = TASK_STATUS_CONFIG[rec.taskStatus] || TASK_STATUS_CONFIG.pending;
  const TaskIcon = taskCfg.icon;
  const isUpdating = updatingId === rec._id;

  const priorityColor =
    rec.requirementClassification === 'required' ? 'var(--primary)' : 'var(--warning)';

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${priorityColor}`,
        opacity: rec.isStale ? 0.85 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Stale warning */}
      {rec.isStale && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.76rem',
            color: 'var(--warning)',
            background: 'var(--warning-subtle)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.85rem',
          }}
        >
          <AlertTriangle size={13} />
          <span>
            <strong>Stale:</strong> A newer assessment was run.{' '}
            {rec.stalenessReason || 'Regenerate recommendations to reflect the latest evidence.'}
          </span>
        </div>
      )}

      {/* Card header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.85rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap',
              marginBottom: '0.3rem',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{rec.skill}</h3>
            <Badge status={rec.requirementClassification} type="classification" />
            <Badge status={rec.snapshotStatus} />
          </div>
          <p
            style={{
              fontSize: '0.94rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {rec.title}
          </p>
        </div>

        {/* Task status display */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.76rem',
            fontWeight: 700,
            border: `1px solid ${taskCfg.border}`,
            background: taskCfg.bg,
            color: taskCfg.color,
            flexShrink: 0,
          }}
        >
          <TaskIcon size={12} />
          {taskCfg.label}
        </div>
      </div>

      {/* Priority + effort metadata */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong>Priority:</strong>{' '}
          <span style={{ color: rec.priority >= 80 ? 'var(--danger)' : rec.priority >= 50 ? 'var(--warning)' : 'var(--text-secondary)' }}>
            {rec.priority >= 80 ? 'High' : rec.priority >= 50 ? 'Medium' : 'Low'}
          </span>{' '}
          ({rec.priority}/100)
        </span>
        {rec.difficultyLevel && (
          <span>
            <strong>Difficulty:</strong> {rec.difficultyLevel}
          </span>
        )}
        {rec.estimatedEffort && (
          <span>
            <strong>Effort:</strong> {rec.estimatedEffort}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
          Source:{' '}
          <span style={{ color: rec.generationSource === 'gemini' ? 'var(--primary)' : 'var(--text-secondary)' }}>
            {rec.generationSource}
          </span>
        </span>
      </div>

      {/* Why it matters */}
      {rec.whyItMatters && (
        <div style={{ marginBottom: '0.85rem' }}>
          <h4
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.25rem',
            }}
          >
            Why it matters for this role
          </h4>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {rec.whyItMatters}
          </p>
        </div>
      )}

      {/* What the assessment found */}
      <div
        style={{
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          marginBottom: '0.85rem',
        }}
      >
        <h4
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '0.35rem',
          }}
        >
          Current evidence in analyzed scope
        </h4>
        <p style={{ fontSize: '0.87rem', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '0.4rem' }}>
          {rec.whatCurrentEvidenceShows}
        </p>
        {rec.whatRemainsMissing && (
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--warning)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.35rem',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>Missing: {rec.whatRemainsMissing}</span>
          </p>
        )}
      </div>

      {/* Implementation plan summary */}
      {rec.implementationPlan && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '0.35rem',
            }}
          >
            <Sparkles size={15} color="var(--primary)" />
            <h4
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Recommended implementation plan
            </h4>
          </div>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {rec.implementationPlan}
          </p>
        </div>
      )}

      {/* Expand / collapse for steps, criteria, resources */}
      <button
        id={`expand-btn-${rec._id}`}
        onClick={() => setExpanded((p) => !p)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.81rem',
          fontWeight: 600,
          color: 'var(--primary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.35rem 0',
          marginBottom: expanded ? '1rem' : 0,
        }}
      >
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {expanded ? 'Hide' : 'Show'} implementation steps, acceptance criteria & learning resources
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Implementation steps */}
          {rec.implementationSteps?.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ListChecks size={13} />
                Step-by-step implementation
              </h4>
              <ol
                style={{
                  paddingLeft: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                {rec.implementationSteps.map((step, i) => (
                  <li
                    key={i}
                    style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.55 }}
                  >
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Acceptance criteria */}
          {rec.acceptanceCriteria?.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Target size={13} />
                Acceptance criteria
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                {rec.acceptanceCriteria.map((criterion, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      fontSize: '0.86rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.55,
                    }}
                  >
                    <CheckCircle2
                      size={14}
                      color="var(--success)"
                      style={{ flexShrink: 0, marginTop: '0.2rem' }}
                    />
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested tests */}
          {rec.suggestedTests?.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Zap size={13} />
                Suggested verification steps
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {rec.suggestedTests.map((t, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: '0.83rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      paddingLeft: '1rem',
                      borderLeft: '2px solid var(--border-light)',
                    }}
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Learning resources */}
          {rec.learningResources?.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <BookOpen size={13} />
                Learning resources
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {rec.learningResources.map((res, i) => (
                  <LearningResourceLink key={i} resource={res} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task progress controls */}
      <div
        style={{
          marginTop: '1.1rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.4rem',
            }}
          >
            Track your progress
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['pending', 'in_progress', 'completed'].map((status) => (
              <TaskStatusButton
                key={status}
                current={rec.taskStatus}
                value={status}
                onChange={(s) => onProgressUpdate(rec._id, s)}
                loading={isUpdating}
              />
            ))}
            {isUpdating && <Loader2 size={15} className="animate-spin" color="var(--primary)" />}
          </div>
        </div>

        {rec.taskCompletedAt && (
          <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
            ✓ Completed {new Date(rec.taskCompletedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Data integrity disclaimer */}
      <div
        style={{
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          marginTop: '0.65rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.35rem',
        }}
      >
        <Info size={12} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
        <span>
          <strong>Evidence Integrity:</strong> Marking a task completed records your self-reported
          progress only. The skill will be re-assessed to{' '}
          <strong>Demonstrated</strong> only when the background worker detects qualifying code in
          your repository.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function RecommendationSkeleton() {
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: 0.6 }}
    >
      {[120, 60, 90, 60, 80].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? '1.4rem' : '0.85rem',
            width: `${w}%`,
            maxWidth: `${w * 6}px`,
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function SkillGapPage() {
  const { id } = useParams(); // assessment id (optional)

  const [assessment, setAssessment] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0, stale: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  // Load assessment and its recommendations
  const loadData = useCallback(
    async (assessmentId) => {
      try {
        setLoading(true);
        setError('');

        // 1. Load the assessment
        const assessRes = await assessmentApi.get(assessmentId);
        setAssessment(assessRes.data);

        // 2. Load existing recommendations
        const recRes = await recommendationsApi.byAssessment(assessmentId);
        setRecommendations(recRes.data?.recommendations || []);
        setCounts(recRes.data?.counts || {});
      } catch (err) {
        setError(err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Auto-discover assessment if not in URL
  const autoDiscoverAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const reposRes = await repoApi.list();
      const repoList = reposRes.data || [];
      if (repoList.length === 0) {
        setLoading(false);
        return;
      }

      const res = await assessmentApi
        .latestByRepo(repoList[0]._id)
        .catch(() => ({ data: null }));

      if (res?.data?._id) {
        const assessRes = await assessmentApi.get(res.data._id);
        setAssessment(assessRes.data);
        const recRes = await recommendationsApi.byAssessment(res.data._id);
        setRecommendations(recRes.data?.recommendations || []);
        setCounts(recRes.data?.counts || {});
      }
    } catch (err) {
      setError(err.message || 'Failed to discover assessment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadData(id);
    } else {
      autoDiscoverAndLoad();
    }
  }, [id, loadData, autoDiscoverAndLoad]);

  // Generate or regenerate recommendations
  const handleGenerate = async (forceRegenerate = false) => {
    if (!assessment?._id) return;
    setGenerating(true);
    setError('');
    try {
      await recommendationsApi.generate(assessment._id, forceRegenerate);
      // Reload
      const recRes = await recommendationsApi.byAssessment(assessment._id);
      setRecommendations(recRes.data?.recommendations || []);
      setCounts(recRes.data?.counts || {});
    } catch (err) {
      setError(err.message || 'Failed to generate recommendations.');
    } finally {
      setGenerating(false);
    }
  };

  // Update task progress
  const handleProgressUpdate = async (recId, newStatus) => {
    setUpdatingId(recId);
    setError('');
    try {
      const res = await recommendationsApi.updateProgress(recId, newStatus);
      const updated = res.data;
      setRecommendations((prev) => prev.map((r) => (r._id === recId ? { ...r, ...updated } : r)));
      // Recompute counts
      setRecommendations((prev) => {
        setCounts({
          total: prev.length,
          pending: prev.filter((r) => r.taskStatus === 'pending').length,
          inProgress: prev.filter((r) => r.taskStatus === 'in_progress').length,
          completed: prev.filter((r) => r.taskStatus === 'completed').length,
          stale: prev.filter((r) => r.isStale).length,
        });
        return prev;
      });
    } catch (err) {
      setError(err.message || 'Failed to update task status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Sort: stale at bottom, then by priority desc
  const sortedRecs = [...recommendations].sort((a, b) => {
    if (a.isStale !== b.isStale) return a.isStale ? 1 : -1;
    return (b.priority || 0) - (a.priority || 0);
  });

  const gaps = (assessment?.skillResults || []).filter(
    (s) => s.status !== 'demonstrated'
  );
  const hasGaps = gaps.length > 0;
  const hasRecommendations = recommendations.length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="page-header">
          <div>
            <div
              style={{
                height: '2rem',
                width: '280px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '0.5rem',
              }}
            />
            <div
              style={{
                height: '1rem',
                width: '420px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <RecommendationSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Personalized Skill-Gap Roadmap</h1>
          <p className="page-subtitle">
            Evidence-backed, actionable recommendations to close the gap between your current portfolio
            and the requirements of your target role.
          </p>
        </div>

        {assessment && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              to={`/assessments/${assessment._id}`}
              className="btn btn-secondary btn-sm"
              id="view-assessment-link"
            >
              <span>View Assessment</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>

      {/* Error banner */}
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

      {assessment ? (
        <>
          {/* Assessment context card */}
          <div
            className="card"
            style={{
              marginBottom: '1.75rem',
              background: 'linear-gradient(to right, #FFFFFF, var(--bg-subtle))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Target Role
              </span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.15rem' }}>
                {assessment.job?.title} @ {assessment.job?.employer}
              </h2>
              <div
                style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}
              >
                Repository:{' '}
                <strong>{assessment.repository?.fullName}</strong> · Commit:{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {assessment.commitSha?.slice(0, 7)}
                </span>{' '}
                · Rev {assessment.revisionNumber}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--primary)' }}
                >
                  {assessment.coverageScore}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Evidence Coverage
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--warning)' }}
                >
                  {gaps.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Skill Gaps
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--success)' }}
                >
                  {counts.completed || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Tasks Done
                </div>
              </div>
            </div>
          </div>

          {/* Generate / regenerate button area */}
          {hasGaps && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.75rem',
              }}
            >
              <div>
                <h2
                  style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.15rem' }}
                >
                  {hasRecommendations
                    ? `${recommendations.length} Actionable Recommendation${recommendations.length !== 1 ? 's' : ''}`
                    : 'No recommendations generated yet'}
                </h2>
                {hasRecommendations && (
                  <div
                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
                  >
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--text-muted)',
                          marginRight: 4,
                        }}
                      />
                      {counts.pending || 0} Not Started
                    </span>
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--warning)',
                          marginRight: 4,
                        }}
                      />
                      {counts.inProgress || 0} In Progress
                    </span>
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--success)',
                          marginRight: 4,
                        }}
                      />
                      {counts.completed || 0} Completed
                    </span>
                    {counts.stale > 0 && (
                      <span style={{ color: 'var(--warning)' }}>
                        <AlertTriangle size={11} style={{ marginRight: 3 }} />
                        {counts.stale} Stale
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                {!hasRecommendations && (
                  <button
                    id="generate-recommendations-btn"
                    className="btn btn-primary"
                    onClick={() => handleGenerate(false)}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        Generate Recommendations
                      </>
                    )}
                  </button>
                )}
                {hasRecommendations && (
                  <button
                    id="regenerate-recommendations-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    title="Regenerate all recommendations from the latest assessment data"
                  >
                    {generating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    {generating ? 'Regenerating…' : 'Regenerate'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Generating skeleton */}
          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {[1, 2].map((i) => (
                <RecommendationSkeleton key={i} />
              ))}
            </div>
          )}

          {/* No gaps — all demonstrated */}
          {!hasGaps && (
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
              <CheckCircle2 size={40} color="var(--success)" />
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>100% Evidence Coverage!</h3>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '440px',
                }}
              >
                All required and preferred competencies for this role have verified code
                implementations in the analyzed repository scope. No skill gaps to address.
              </p>
              <Link
                to={`/assessments/${assessment._id}`}
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem' }}
              >
                View Full Assessment
              </Link>
            </div>
          )}

          {/* Has gaps but no recommendations generated */}
          {hasGaps && !hasRecommendations && !generating && (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '2.5rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <Sparkles size={32} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                Ready to generate your personalized roadmap
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '480px' }}>
                Click <strong>Generate Recommendations</strong> above to create specific,
                evidence-backed improvement tasks for each of the {gaps.length} skill gap
                {gaps.length !== 1 ? 's' : ''} found in this assessment.
              </p>
            </div>
          )}

          {/* Recommendation cards */}
          {!generating && hasRecommendations && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {sortedRecs.map((rec) => (
                <RecommendationCard
                  key={rec._id}
                  rec={rec}
                  onProgressUpdate={handleProgressUpdate}
                  updatingId={updatingId}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* No assessment found */
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3>No Assessment Found</h3>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              marginTop: '0.35rem',
            }}
          >
            Run an initial assessment from the Dashboard to generate your personalized skill-gap
            analysis and roadmap.
          </p>
          <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
