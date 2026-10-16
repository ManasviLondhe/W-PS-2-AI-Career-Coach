import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { repoApi, assessmentApi } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import {
  GitFork,
  ArrowLeft,
  FileCode,
  Folder,
  RefreshCw,
  ExternalLink,
  GitBranch,
  GitCommit,
  Search,
  CheckCircle2,
  Code2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export function RepoExplorerPage() {
  const { id } = useParams();
  const [repo, setRepo] = useState(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileEvidence, setFileEvidence] = useState([]);
  const [allEvidence, setAllEvidence] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRepoAndTree() {
      try {
        setLoading(true);
        const repoRes = await repoApi.get(id);
        const repoData = repoRes.data;
        setRepo(repoData);

        // Fetch file tree and repository evidence
        const [filesRes, evRes] = await Promise.all([
          repoApi.getFiles(repoData.owner, repoData.name, repoData.defaultBranch).catch(() => ({ data: { tree: [] } })),
          repoApi.evidence(repoData._id).catch(() => ({ data: [] })),
        ]);

        const fileTree = filesRes.data?.tree || [];
        setTree(fileTree);
        const evidences = evRes.data || [];
        setAllEvidence(evidences);

        // Auto-select first code file or file with evidence
        if (evidences.length > 0) {
          const firstEvFile = fileTree.find((f) => f.path === evidences[0].filePath);
          if (firstEvFile) {
            handleSelectFile(firstEvFile, evidences);
          } else if (fileTree.length > 0) {
            handleSelectFile(fileTree[0], evidences);
          }
        } else if (fileTree.length > 0) {
          handleSelectFile(fileTree[0], evidences);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRepoAndTree();
  }, [id]);

  const handleSelectFile = async (file, evidences = allEvidence) => {
    setSelectedFile(file);
    setContentLoading(true);
    setCopied(false);

    // Filter evidence associated with this file path
    const matchingEv = evidences.filter((e) => e.filePath === file.path);
    setFileEvidence(matchingEv);

    try {
      const res = await repoApi.getFileContent(repo.owner, repo.name, file.path, repo.defaultBranch);
      setFileContent(res.data?.content || '// Content unavailable or empty');
    } catch (err) {
      setFileContent(`// Unable to fetch file content directly: ${err.message}`);
    } finally {
      setContentLoading(false);
    }
  };

  const handlePollNow = async () => {
    if (!repo) return;
    setPolling(true);
    try {
      const res = await repoApi.pollNow(repo._id);
      setRepo(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPolling(false);
    }
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTree = tree.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
        <h2>Repository Not Found</h2>
        <Link to="/repositories" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Repositories
        </Link>
      </div>
    );
  }

  const lines = (fileContent || '').split('\n');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/repositories"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Repositories</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <GitFork size={20} color="var(--primary)" />
              <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
                {repo.fullName}
              </h1>
              <span className={`badge ${repo.trackingState === 'active' ? 'badge-demonstrated' : 'badge-not_demonstrated'}`}>
                {repo.trackingState === 'active' ? 'Active Tracking' : 'Paused'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>Branch: <strong>{repo.defaultBranch}</strong></span>
              <span>Analyzed SHA: <strong>{repo.lastSuccessfullyAnalyzedSha ? repo.lastSuccessfullyAnalyzedSha.slice(0, 7) : 'None'}</strong></span>
              <span>Files: <strong>{tree.length}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handlePollNow}
              disabled={polling}
              className="btn btn-secondary btn-sm"
              id="btn-poll-explorer"
            >
              <RefreshCw size={14} className={polling ? 'animate-spin' : ''} />
              <span>{polling ? 'Checking Commits...' : 'Check Changes'}</span>
            </button>

            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem' }}
            >
              <span>GitHub</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.86rem',
          }}
        >
          {error}
        </div>
      )}

      {/* 3-Column Desktop Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 300px',
          gap: '1rem',
          minHeight: '620px',
        }}
      >
        {/* Column 1: File Tree Navigator */}
        <div
          className="card"
          style={{
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxHeight: '680px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.8rem',
                width: '100%',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {filteredTree.map((f) => {
              const hasEvidence = allEvidence.some((e) => e.filePath === f.path);
              const isSelected = selectedFile?.path === f.path;

              return (
                <div
                  key={f.path}
                  onClick={() => handleSelectFile(f)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-subtle)' : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <FileCode size={13} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.path.split('/').pop()}
                    </span>
                  </div>

                  {hasEvidence && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--success)',
                      }}
                      title="Verified skill evidence detected in this file"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Code Viewer */}
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '680px',
            background: 'var(--bg-dark)',
            color: '#E2E8F0',
          }}
        >
          {/* Code Viewer Toolbar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#0F1117',
              borderBottom: '1px solid #232733',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94A3B8' }}>
              <Code2 size={15} color="var(--primary)" />
              <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{selectedFile?.path || 'No file selected'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={handleCopy}
                style={{
                  color: '#94A3B8',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: '#1A1E29',
                }}
                title="Copy code"
              >
                {copied ? <Check size={12} color="#4ADE80" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {selectedFile && (
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${selectedFile.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#94A3B8',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: '#1A1E29',
                  }}
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Code Lines Display */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6 }}>
            {contentLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                <span>Fetching file from GitHub...</span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          width: '45px',
                          color: '#4B5563',
                          textAlign: 'right',
                          paddingRight: '1rem',
                          userSelect: 'none',
                          verticalAlign: 'top',
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ whiteSpace: 'pre', color: '#E2E8F0', verticalAlign: 'top' }}>
                        {l || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Column 3: Evidence Found in File */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxHeight: '680px',
            overflowY: 'auto',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
              VERIFIED EVIDENCE
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
              File Evidence ({fileEvidence.length})
            </h3>
          </div>

          {fileEvidence.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              No specific skill evidence anchors registered for this file. Explore files marked with a green indicator to inspect concrete proof.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {fileEvidence.map((ev) => (
                <div
                  key={ev.evidenceId}
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--success)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{ev.skill}</span>
                    <Badge status="demonstrated">Lines {ev.lineRange?.start}-{ev.lineRange?.end}</Badge>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.45 }}>
                    {ev.explanation}
                  </p>

                  <a
                    href={ev.sourcePermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', width: '100%', justifyContent: 'center' }}
                  >
                    <span>Inspect Line Range on GitHub</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
