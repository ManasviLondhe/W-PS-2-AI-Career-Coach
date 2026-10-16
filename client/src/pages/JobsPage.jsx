import React, { useState, useEffect } from 'react';
import { jobApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { JobImportModal } from '../components/JobImportModal.jsx';
import {
  Briefcase,
  Plus,
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await jobApi.list();
      setJobs(res.data?.jobs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDeleteJob = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this job requirement?')) return;
    try {
      await jobApi.delete(id);
      setJobs(jobs.filter((j) => j._id !== id));
      if (selectedJob?._id === id) setSelectedJob(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Target Job Postings</h1>
          <p className="page-subtitle">
            Legitimate job and internship requirements with verified source URLs and normalized skills.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-primary"
          id="btn-open-job-import"
        >
          <Plus size={16} />
          <span>Import Job Requirement</span>
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
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={28} className="animate-spin" color="var(--primary)" />
        </div>
      ) : (
        <div className="grid-2">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="card"
              onClick={() => setSelectedJob(job)}
              style={{
                cursor: 'pointer',
                borderColor: selectedJob?._id === job._id ? 'var(--primary)' : 'var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {job.employer}
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {job.title}
                    </h3>
                  </div>

                  <button
                    onClick={(e) => handleDeleteJob(job._id, e)}
                    style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                    title="Delete Job"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <Badge status={job.sourceVerificationState} type="verification" />
                  {job.originalSourceUrl && (
                    <a
                      href={job.originalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.78rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      <span>Original Link</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Required Skills tags */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Required Skills ({job.requiredSkills?.length || 0})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {job.requiredSkills?.map((s) => (
                      <span key={s} className="badge badge-required">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Preferred Skills tags */}
                {job.preferredSkills?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Preferred Skills ({job.preferredSkills?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {job.preferredSkills?.map((s) => (
                        <span key={s} className="badge badge-preferred">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} />
                  Retrieved: {new Date(job.retrievalTimestamp || job.createdAt).toLocaleDateString()}
                </span>
                <span style={{ textTransform: 'capitalize' }}>Source: {job.sourceType}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {modalOpen && (
        <JobImportModal
          onClose={() => setModalOpen(false)}
          onSuccess={(newJob) => {
            setJobs([newJob, ...jobs]);
            setSelectedJob(newJob);
          }}
        />
      )}
    </div>
  );
}
