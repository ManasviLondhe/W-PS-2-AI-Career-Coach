import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assessmentApi, repoApi } from '../services/api.js';
import { EvidenceModal } from '../components/EvidenceModal.jsx';
import { Badge } from '../components/Badge.jsx';
import {
  FileCode2,
  ExternalLink,
  Code2,
  Search,
  Filter,
  CheckCircle2,
  GitCommit,
  GitFork,
  ArrowLeft,
  Loader2,
  Layers,
  HelpCircle,
} from 'lucide-react';

export function EvidenceExplorerPage() {
  const { id } = useParams();
  const [evidenceList, setEvidenceList] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [viewMode, setViewMode] = useState('by_skill'); // 'by_skill' or 'by_file'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeModalEvidence, setActiveModalEvidence] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [reposRes, evRes] = await Promise.all([
          repoApi.list(),
          assessmentApi.listEvidence(),
        ]);
        setRepos(reposRes.data || []);
        setEvidenceList(evRes.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  // Unique skills in evidence
  const uniqueSkills = Array.from(new Set(evidenceList.map((e) => e.skill)));

  const filteredEvidence = evidenceList.filter((ev) => {
    if (selectedRepoId && ev.repository?._id !== selectedRepoId && ev.repository !== selectedRepoId) return false;
    if (selectedSkill && ev.skill !== selectedSkill) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inPath = ev.filePath.toLowerCase().includes(q);
      const inSkill = ev.skill.toLowerCase().includes(q);
      const inCode = (ev.codeExcerpt || '').toLowerCase().includes(q);
      if (!inPath && !inSkill && !inCode) return false;
    }
    return true;
  });

  // Group by skill
  const groupedBySkill = {};
  for (const ev of filteredEvidence) {
    if (!groupedBySkill[ev.skill]) groupedBySkill[ev.skill] = [];
    groupedBySkill[ev.skill].push(ev);
  }

  // Group by file
  const groupedByFile = {};
  for (const ev of filteredEvidence) {
    if (!groupedByFile[ev.filePath]) groupedByFile[ev.filePath] = [];
    groupedByFile[ev.filePath].push(ev);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Every claim has a source.</h1>
          <p className="page-subtitle">
            Inspect the concrete code implementations, queries, tests, and syntax behind each assessment finding.
          </p>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-subtle)', padding: '0.3rem', borderRadius: 'var(--radius-md)' }}>
          <button
            onClick={() => setViewMode('by_skill')}
            className={`btn btn-sm ${viewMode === 'by_skill' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            Group by Skill
          </button>
          <button
            onClick={() => setViewMode('by_file')}
            className={`btn btn-sm ${viewMode === 'by_file' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            Group by File
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

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', flex: 1, minWidth: '220px' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by file path, keyword, or snippet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              style={{ width: 'auto', minWidth: '160px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
            >
              <option value="">All Skills ({uniqueSkills.length})</option>
              {uniqueSkills.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="form-select"
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              style={{ width: 'auto', minWidth: '180px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
            >
              <option value="">All Repositories ({repos.length})</option>
              {repos.map((r) => (
                <option key={r._id} value={r._id}>{r.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--primary)" />
        </div>
      ) : filteredEvidence.length === 0 ? (
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
          <HelpCircle size={36} color="var(--text-muted)" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No Evidence Matches Filter</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
            No verified code evidence was recorded for this filter scope. Run an assessment on your repository to populate the explorer.
          </p>
        </div>
      ) : viewMode === 'by_skill' ? (
        /* Grouped By Skill View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(groupedBySkill).map(([skill, items]) => (
            <div key={skill} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {skill}
                  </h2>
                  <span className="badge badge-demonstrated">
                    {items.length} verified citation(s)
                  </span>
                </div>
              </div>

              <div className="grid-2">
                {items.map((ev) => (
                  <div
                    key={ev.evidenceId}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: '#FFFFFF',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Code2 size={13} color="var(--primary)" />
                        <span style={{ fontWeight: 600 }}>{ev.filePath}:{ev.lineRange?.start}-{ev.lineRange?.end}</span>
                      </div>

                      <a
                        href={ev.sourcePermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        <span>GitHub</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <pre className="code-panel" style={{ maxHeight: '140px', fontSize: '0.75rem' }}>
                        <code>{ev.codeExcerpt}</code>
                      </pre>

                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        <strong>Why it supports: </strong>{ev.explanation}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>Commit: {ev.commitSha?.slice(0, 7)}</span>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>Current Valid</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grouped By File View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(groupedByFile).map(([filePath, items]) => (
            <div key={filePath} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  <FileCode2 size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{filePath}</span>
                </div>
                <span className="badge badge-demonstrated">{items.length} evidence anchor(s)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((ev) => (
                  <div
                    key={ev.evidenceId}
                    style={{
                      background: 'var(--bg-subtle)',
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{ev.skill}</span>
                      <a
                        href={ev.sourcePermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      >
                        <span>Lines {ev.lineRange?.start}-{ev.lineRange?.end} on GitHub</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <pre className="code-panel" style={{ maxHeight: '120px', fontSize: '0.74rem' }}>
                      <code>{ev.codeExcerpt}</code>
                    </pre>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {ev.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail */}
      {activeModalEvidence && (
        <EvidenceModal
          evidence={activeModalEvidence}
          onClose={() => setActiveModalEvidence(null)}
        />
      )}
    </div>
  );
}
