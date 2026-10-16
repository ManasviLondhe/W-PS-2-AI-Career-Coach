import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assessmentApi, repoApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode2,
  Terminal,
  Database,
  Layers,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

export function SkillGapPage() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssessment() {
      try {
        setLoading(true);
        let currentAssessment = null;

        if (id) {
          const res = await assessmentApi.get(id);
          currentAssessment = res.data;
        } else {
          // Find latest assessment across repos
          const reposRes = await repoApi.list();
          const repoList = reposRes.data || [];
          if (repoList.length > 0) {
            const res = await assessmentApi.latestByRepo(repoList[0]._id).catch(() => ({ data: null }));
            currentAssessment = res.data;
          }
        }
        setAssessment(currentAssessment);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAssessment();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  const skillResults = assessment?.skillResults || [];
  const gaps = skillResults.filter((s) => s.status !== 'demonstrated');

  // Sort gaps: required skills first
  gaps.sort((a, b) => {
    if (a.classification === 'required' && b.classification !== 'required') return -1;
    if (a.classification !== 'required' && b.classification === 'required') return 1;
    return 0;
  });

  const partiallyDemonstratedGaps = gaps.filter((g) => g.status === 'partially_demonstrated');
  const notDemonstratedGaps = gaps.filter((g) => g.status === 'not_demonstrated');

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">The gap is the roadmap.</h1>
          <p className="page-subtitle">
            Understand which job requirements need stronger evidence, and what concrete implementations you can ship next.
          </p>
        </div>

        {assessment && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to={`/assessments/${assessment._id}`} className="btn btn-secondary btn-sm">
              <span>View Full Assessment</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
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

      {/* Target Job & Coverage Context */}
      {assessment ? (
        <>
          <div
            className="card"
            style={{
              marginBottom: '2rem',
              background: 'linear-gradient(to right, #FFFFFF, var(--bg-subtle))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                TARGET EVALUATION SCOPE
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                {assessment.job?.title} @ {assessment.job?.employer}
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Repository: <strong>{assessment.repository?.fullName}</strong> ({assessment.commitSha?.slice(0, 7)})
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {assessment.coverageScore}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Evidence Coverage</div>
              </div>
              <div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--warning)' }}>
                  {gaps.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Skill Gaps</div>
              </div>
              <div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {notDemonstratedGaps.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not in Scope</div>
              </div>
            </div>
          </div>

          {/* Actionable Gap Cards */}
          {gaps.length === 0 ? (
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
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>100% Evidence Coverage Achieved!</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '440px' }}>
                All required and preferred competencies for this role have verified code implementations in your repository.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
              {gaps.map((gap, index) => (
                <div
                  key={gap.skill}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${gap.classification === 'required' ? 'var(--primary)' : 'var(--warning)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        #{index + 1}
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{gap.skill}</h3>
                      <Badge status={gap.classification} type="classification" />
                    </div>

                    <Badge status={gap.status} />
                  </div>

                  {/* Why it was marked */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Observation in Analyzed Scope
                    </h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {gap.explanation}
                    </p>
                  </div>

                  {/* Concrete Suggested Implementation */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Sparkles size={16} color="var(--primary)" />
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        Concrete Portfolio Implementation Blueprint
                      </strong>
                    </div>

                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {gap.recommendations?.[0] ||
                        `Add a meaningful ${gap.skill} feature directly into your repository. For example, write functional code, queries, or tests demonstrating genuine production usage.`}
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <span>Expected Artifacts: <strong>Schema, Queries, Service Layer, or Unit Tests</strong></span>
                      <span>Next Action: <strong>Commit & Push to GitHub</strong></span>
                    </div>
                  </div>

                  {/* Separation Disclaimer */}
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem' }}>
                    <strong>Evidence Integrity Rule: </strong>
                    The suggested roadmap above is not considered evidence. {gap.skill} will only transition to Demonstrated after our background worker detects actual code pushed to your repository.
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3>No Assessment Data Found</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Run an initial assessment from the Dashboard to generate your skill gap analysis.
          </p>
          <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
