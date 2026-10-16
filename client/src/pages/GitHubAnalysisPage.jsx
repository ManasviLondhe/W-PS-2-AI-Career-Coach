import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { githubApi } from '../services/api.js';
import { GithubIcon } from '../components/GithubIcon.jsx';
import {
  Search,
  GitBranch,
  GitCommit,
  Star,
  GitFork,
  ExternalLink,
  ShieldCheck,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Sliders,
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  Lock,
  Eye,
  Info,
  Terminal,
} from 'lucide-react';

export function GitHubAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Target State
  const [identifierInput, setIdentifierInput] = useState(searchParams.get('target') || 'sayali8106');
  const [validatingUser, setValidatingUser] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userRepos, setUserRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('ALL');

  // Selection & Configuration State
  const [selectedRepos, setSelectedRepos] = useState(new Map()); // repoFullName -> { owner, repo, branch, defaultBranch, ... }
  const [repoBranches, setRepoBranches] = useState(new Map()); // repoFullName -> [ { name, commitSha } ]
  const [loadingBranches, setLoadingBranches] = useState(new Set()); // set of repoFullNames loading branches

  // Scan Execution & Progress State
  const [scanning, setScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState(searchParams.get('scanId') || null);
  const [scanResult, setScanResult] = useState(null);
  const [scanProgress, setScanProgress] = useState(null);

  // Results View & Filtering State
  const [activeTab, setActiveTab] = useState('skills'); // 'skills' | 'evidence' | 'files' | 'history'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [fileFilterTab, setFileFilterTab] = useState('inspected'); // 'inspected' | 'skipped'

  // History State
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Global Error & Info States
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 1. Initial Load: Check if scanId in URL
  useEffect(() => {
    const scanId = searchParams.get('scanId');
    if (scanId) {
      loadScanSnapshot(scanId);
    }
  }, [searchParams]);

  // Load Scan Snapshot by ID
  const loadScanSnapshot = async (scanId) => {
    try {
      setError('');
      const res = await githubApi.getScanStatus(scanId);
      setScanResult(res.data);
      setActiveScanId(scanId);
      if (res.data.githubUser) {
        setUserProfile(res.data.githubUser);
      }
    } catch (err) {
      setError(`Failed to load scan snapshot: ${err.message}`);
    }
  };

  // 2. Validate Profile / Search Input
  const handleValidateIdentifier = async (e) => {
    e?.preventDefault();
    if (!identifierInput.trim()) return;

    setError('');
    setNotice('');
    setValidatingUser(true);
    setLoadingRepos(true);

    try {
      let clean = identifierInput.trim().replace(/\.git$/, '').replace(/\/+$/, '');
      const isUrl = clean.includes('github.com');
      let targetUser = clean;

      if (isUrl) {
        const parts = clean.split('github.com/')[1]?.split('/');
        if (parts && parts.length >= 1) {
          targetUser = parts[0];
          // If a direct repo url was entered
          if (parts.length >= 2 && parts[1]) {
            const owner = parts[0];
            const repo = parts[1];
            // Inspect specific repo directly
            const repoMetaRes = await githubApi.getRepoDetails(owner, repo);
            const r = repoMetaRes.data;
            setUserRepos([r]);
            handleToggleSelectRepo(r, true);
            // Also try to get user profile
            try {
              const u = await githubApi.getUser(owner);
              setUserProfile(u.data);
            } catch {
              setUserProfile({ login: owner, name: owner, htmlUrl: `https://github.com/${owner}` });
            }
            setValidatingUser(false);
            setLoadingRepos(false);
            return;
          }
        }
      }

      // Fetch user profile
      const userRes = await githubApi.getUser(targetUser);
      setUserProfile(userRes.data);

      // Fetch user's public repositories
      const reposRes = await githubApi.getUserRepos(targetUser, { per_page: 50 });
      setUserRepos(reposRes.data.repos || []);

      // If repositories returned, auto-select the first non-fork or primary repo
      if (reposRes.data.repos?.length > 0) {
        const primary = reposRes.data.repos.find((r) => !r.isFork) || reposRes.data.repos[0];
        handleToggleSelectRepo(primary, true);
      }

      loadHistoryForUser(targetUser);
    } catch (err) {
      setError(err.message || 'Could not find GitHub user or repository.');
      setUserProfile(null);
      setUserRepos([]);
    } finally {
      setValidatingUser(false);
      setLoadingRepos(false);
    }
  };

  // 3. Load Branch List on Demand for Selected Repo
  const loadBranchesForRepo = async (owner, repoName, fullName) => {
    if (repoBranches.has(fullName) || loadingBranches.has(fullName)) return;

    setLoadingBranches((prev) => new Set(prev).add(fullName));
    try {
      const res = await githubApi.getRepoBranches(owner, repoName);
      setRepoBranches((prev) => new Map(prev).set(fullName, res.data || []));
    } catch (err) {
      console.warn(`Could not load branches for ${fullName}:`, err.message);
    } finally {
      setLoadingBranches((prev) => {
        const next = new Set(prev);
        next.delete(fullName);
        return next;
      });
    }
  };

  // Toggle Repository Selection
  const handleToggleSelectRepo = (repo, forceSelect) => {
    const key = repo.fullName || `${repo.owner}/${repo.name}`;
    setSelectedRepos((prev) => {
      const next = new Map(prev);
      if (next.has(key) && forceSelect !== true) {
        next.delete(key);
      } else {
        if (next.size >= 5) {
          setError('Maximum of 5 repositories can be scanned simultaneously.');
          return next;
        }
        next.set(key, {
          owner: repo.owner,
          repo: repo.name,
          fullName: key,
          defaultBranch: repo.defaultBranch || 'main',
          selectedBranch: repo.defaultBranch || 'main',
          stars: repo.stars,
          language: repo.language,
          description: repo.description,
          url: repo.url,
        });
        loadBranchesForRepo(repo.owner, repo.name, key);
      }
      return next;
    });
  };

  const handleSelectBranch = (fullName, branch) => {
    setSelectedRepos((prev) => {
      const next = new Map(prev);
      const item = next.get(fullName);
      if (item) {
        next.set(fullName, { ...item, selectedBranch: branch });
      }
      return next;
    });
  };

  // 4. Start Portfolio Scan
  const handleStartScan = async () => {
    if (selectedRepos.size === 0) {
      setError('Please select at least one repository to scan.');
      return;
    }

    setError('');
    setNotice('');
    setScanning(true);
    setScanResult(null);

    const targets = Array.from(selectedRepos.values()).map((r) => ({
      owner: r.owner,
      repo: r.repo,
      branch: r.selectedBranch || r.defaultBranch || 'main',
    }));

    try {
      // Initiate background scan
      const res = await githubApi.startScan({
        username: userProfile?.login || identifierInput.trim(),
        repositories: targets,
        runAsync: true,
      });

      const scanId = res.data.scanId;
      setActiveScanId(scanId);
      setSearchParams({ scanId });
      setScanProgress(res.data.progress);

      // Poll scan status until completion
      pollScanUntilDone(scanId);
    } catch (err) {
      setError(`Failed to initiate scan: ${err.message}`);
      setScanning(false);
    }
  };

  // Polling loop for background scan progress
  const pollScanUntilDone = (scanId) => {
    const interval = setInterval(async () => {
      try {
        const res = await githubApi.getScanStatus(scanId);
        const data = res.data;
        setScanProgress(data.progress);

        if (data.status === 'completed') {
          clearInterval(interval);
          setScanResult(data);
          setScanning(false);
          setActiveTab('skills');
          loadHistoryForUser(userProfile?.login);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setScanning(false);
          setError(data.error?.message || 'Portfolio scan encountered an unrecoverable error.');
        }
      } catch (err) {
        clearInterval(interval);
        setScanning(false);
        setError(`Lost connection while polling scan progress: ${err.message}`);
      }
    }, 1200);
  };

  // Load history list
  const loadHistoryForUser = async (username) => {
    if (!username) return;
    setLoadingHistory(true);
    try {
      const res = await githubApi.listScans({ username, limit: 10 });
      setHistoryList(res.data.scans || []);
    } catch (err) {
      console.warn('Failed to load scan history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Copy Permalink Helper
  const handleCopyPermalink = (permalink, id) => {
    navigator.clipboard.writeText(permalink);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Filtered Repos in Explorer
  const filteredRepos = userRepos.filter((r) => {
    const matchesSearch =
      !repoSearch.trim() ||
      r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      r.description?.toLowerCase().includes(repoSearch.toLowerCase()) ||
      r.language?.toLowerCase().includes(repoSearch.toLowerCase());

    const matchesLang = languageFilter === 'ALL' || r.language === languageFilter;
    return matchesSearch && matchesLang;
  });

  const availableLanguages = Array.from(
    new Set(userRepos.map((r) => r.language).filter(Boolean))
  );

  // Filtered findings in Results
  const filteredFindings = (scanResult?.findings || []).filter((f) => {
    if (selectedCategory === 'ALL') return true;
    return f.category === selectedCategory;
  });

  const allCategories = [
    'ALL',
    'Languages',
    'Frontend',
    'Backend',
    'Databases',
    'Testing',
    'DevOps',
    'Security',
    'APIs',
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
          <GithubIcon size={26} color="var(--primary)" />
          <h1 className="page-title" style={{ margin: 0 }}>
            GitHub Portfolio Analysis
          </h1>
          <span className="badge badge-demonstrated" style={{ fontSize: '0.72rem' }}>
            FEATURE 2 ACTIVE
          </span>
        </div>
        <p className="page-subtitle" style={{ margin: 0 }}>
          Connect real GitHub repositories, inspect authentic source files at verifiable commit SHAs, and extract evidence-backed skill proof.
        </p>
      </div>

      {/* Global Error Notice */}
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
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
          id="github-analysis-error-banner"
        >
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>{error}</div>
          <button onClick={() => setError('')} style={{ opacity: 0.7, fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* STEP 1: GitHub Username or Repo Identifier Input Card */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <form onSubmit={handleValidateIdentifier}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.88rem' }}>
              GitHub Username, Profile Link, or Repository URL
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. sayali8106, octocat, or https://github.com/facebook/react"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  required
                  id="input-github-identifier"
                  style={{ paddingLeft: '2.4rem' }}
                />
                <GithubIcon
                  size={17}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
              </div>

              <button
                type="submit"
                disabled={validatingUser || !identifierInput.trim()}
                className="btn btn-primary"
                id="btn-validate-github"
              >
                {validatingUser ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                <span>{validatingUser ? 'Validating Profile...' : 'Connect & Discover Repos'}</span>
              </button>
            </div>

            {/* Quick Suggestions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick test profiles:</span>
              {['sayali8106', 'octocat', 'facebook/react', 'expressjs/express'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setIdentifierInput(sample);
                    setTimeout(() => handleValidateIdentifier(), 50);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Profile Card Summary */}
        {userProfile && (
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
            id="github-profile-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {userProfile.avatarUrl && (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.login}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border-light)' }}
                />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {userProfile.name || userProfile.login}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{userProfile.login}</span>
                </div>
                {userProfile.bio && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem', maxWidth: '600px' }}>
                    {userProfile.bio}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {userProfile.company && <span>🏢 {userProfile.company}</span>}
                  {userProfile.location && <span>📍 {userProfile.location}</span>}
                  <span>📦 <strong>{userProfile.publicRepos}</strong> public repos</span>
                  {userProfile.followers !== undefined && (
                    <span>👥 <strong>{userProfile.followers}</strong> followers</span>
                  )}
                </div>
              </div>
            </div>

            <a
              href={userProfile.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>View GitHub Profile</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>

      {/* STEP 2: Repository Explorer & Multi-Select Cards */}
      {userRepos.length > 0 && (
        <div className="card" style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Select Repositories to Analyze
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Choose up to 5 repositories. For each repo, you can inspect the default branch or choose a specific branch.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge badge-primary" style={{ padding: '0.35rem 0.75rem', fontWeight: 700 }}>
                {selectedRepos.size} / 5 Selected
              </span>
              {selectedRepos.size > 0 && (
                <button
                  onClick={() => setSelectedRepos(new Map())}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem' }}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Filter repositories by name or description..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.84rem' }}
              />
              <Search
                size={15}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
            </div>

            {availableLanguages.length > 0 && (
              <select
                className="form-input"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '150px', fontSize: '0.84rem' }}
              >
                <option value="ALL">All Languages</option>
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            )}
          </div>

          {/* Repositories Table / Grid */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {filteredRepos.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No repositories match your filter query.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem 0.85rem', width: '40px' }}></th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Repository</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Branch</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Language</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '80px' }}>Stars</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.map((repo) => {
                    const fullName = repo.fullName || `${repo.owner}/${repo.name}`;
                    const isSelected = selectedRepos.has(fullName);
                    const selectedData = selectedRepos.get(fullName);
                    const branches = repoBranches.get(fullName) || [];
                    const isLoadingBranches = loadingBranches.has(fullName);

                    return (
                      <tr
                        key={repo.id || fullName}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: isSelected ? 'var(--primary-subtle)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRepo(repo)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                            id={`check-repo-${repo.name}`}
                          />
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {repo.name}
                          </div>
                          {repo.description && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {repo.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          {isSelected ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <GitBranch size={13} color="var(--primary)" />
                              {isLoadingBranches ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</span>
                              ) : branches.length > 0 ? (
                                <select
                                  value={selectedData?.selectedBranch || repo.defaultBranch}
                                  onChange={(e) => handleSelectBranch(fullName, e.target.value)}
                                  className="form-input"
                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.78rem', width: 'auto' }}
                                  id={`select-branch-${repo.name}`}
                                >
                                  {branches.map((b) => (
                                    <option key={b.name} value={b.name}>
                                      {b.name} {b.name === repo.defaultBranch ? '(default)' : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                  {repo.defaultBranch || 'main'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {repo.defaultBranch || 'main'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          {repo.language ? (
                            <span style={{ fontSize: '0.76rem', background: 'var(--bg-subtle)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)' }}>
                              {repo.language}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Star size={12} fill="#f59e0b" color="#f59e0b" />
                            {repo.stars || 0}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)' }}
                            title="View on GitHub"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Footer for Scanning */}
          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={16} color="var(--success)" />
              <span>Safety policy: Secrets, node_modules, binaries, and lockfiles are strictly skipped. Bounded to 100 files / repo.</span>
            </div>

            <button
              onClick={handleStartScan}
              disabled={scanning || selectedRepos.size === 0}
              className="btn btn-primary"
              id="btn-start-portfolio-scan"
              style={{ padding: '0.65rem 1.4rem' }}
            >
              {scanning ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Scanning Source Files...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Start Portfolio Scan ({selectedRepos.size} Repos)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Live Scan Progress Stepper */}
      {scanning && scanProgress && (
        <div
          className="card"
          style={{
            marginBottom: '1.75rem',
            background: '#FFFFFF',
            border: '2px solid var(--primary-border)',
          }}
          id="scan-progress-panel"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <RefreshCw size={20} className="animate-spin" color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Authentic Source Code Scan in Progress
              </h3>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
              {scanProgress.percent || 0}%
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                width: `${scanProgress.percent || 0}%`,
                height: '100%',
                background: 'var(--primary)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Status Message & Active File */}
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
            {scanProgress.message}
          </div>

          {scanProgress.currentFile && (
            <div
              style={{
                background: 'var(--bg-subtle)',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Terminal size={14} color="var(--primary)" />
              <span>Inspecting: {scanProgress.currentRepo ? `${scanProgress.currentRepo} / ` : ''}{scanProgress.currentFile}</span>
            </div>
          )}

          {/* Stepper Steps */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.5rem',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-light)',
            }}
          >
            {[
              { id: 'validating', label: '1. Validate Targets' },
              { id: 'tree_discovery', label: '2. Tree Discovery' },
              { id: 'filtering', label: '3. Filter Files' },
              { id: 'source_retrieval', label: '4. Retrieve Source' },
              { id: 'skill_analysis', label: '5. Analyze Skills' },
              { id: 'saving', label: '6. Persist Audit' },
            ].map((st) => {
              const isCurrent = scanProgress.step === st.id;
              const isPast = scanProgress.percent >= 90;
              return (
                <div
                  key={st.id}
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isCurrent ? 'var(--primary)' : 'var(--border-subtle)',
                    }}
                  />
                  <span>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4: Portfolio Scan Results Dashboard */}
      {scanResult && (
        <div id="portfolio-results-dashboard">
          {/* Top Metric Cards */}
          <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
            <div className="metric-card">
              <span className="metric-label">Repositories Scanned</span>
              <span className="metric-value" style={{ color: 'var(--primary)' }}>
                {scanResult.stats?.totalRepositories || scanResult.repositories?.length || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {scanResult.repositories?.map((r) => r.name).join(', ')}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Verified Skills Found</span>
              <span className="metric-value" style={{ color: 'var(--success)' }}>
                {scanResult.skillsSummary?.length || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Evidence-backed proficiencies
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Files Inspected</span>
              <span className="metric-value">
                {scanResult.stats?.totalFilesInspected || scanResult.inspectedFiles?.length || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {((scanResult.stats?.totalBytesInspected || 0) / 1024).toFixed(0)} KB total code read
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Files Skipped</span>
              <span className="metric-value" style={{ color: 'var(--text-muted)' }}>
                {scanResult.stats?.totalFilesSkipped || scanResult.skippedFiles?.length || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Secrets, binaries & lockfiles excluded
              </span>
            </div>
          </div>

          {/* Scope Statement Banner */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <Info size={18} color="var(--primary)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                Verified Assessment Scope & Audit Integrity
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {scanResult.scopeStatement}
              </p>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>Scan ID: <strong>{scanResult.scanId}</strong></span>
                <span>Mode: <strong>{scanResult.analysisMode === 'llm' ? 'LLM-Assisted' : 'Deterministic (Static AST & Pattern Verification)'}</strong></span>
                {scanResult.repositories?.map((r) => (
                  <span key={r.fullName}>
                    {r.fullName}@{r.selectedBranch} (SHA: <strong>{r.commitSha?.slice(0, 7)}</strong>)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-light)',
              marginBottom: '1.5rem',
              gap: '0.5rem',
            }}
          >
            {[
              { id: 'skills', label: `Demonstrated Skills (${scanResult.skillsSummary?.length || 0})` },
              { id: 'evidence', label: `Code Citations (${scanResult.findings?.length || 0})` },
              { id: 'files', label: `Inspected & Skipped Files (${(scanResult.inspectedFiles?.length || 0) + (scanResult.skippedFiles?.length || 0)})` },
              { id: 'history', label: `Scan History` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.75rem 1.25rem',
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  fontSize: '0.88rem',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Demonstrated Skills View */}
          {activeTab === 'skills' && (
            <div>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                      color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                      border: `1px solid ${selectedCategory === cat ? 'var(--primary)' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Skills Grid */}
              <div className="grid-2">
                {scanResult.skillsSummary
                  ?.filter((s) => selectedCategory === 'ALL' || s.category === selectedCategory)
                  .map((skillItem) => {
                    const findingsForSkill = (scanResult.findings || []).filter((f) => f.skill === skillItem.skill);
                    const isExpanded = expandedSkill === skillItem.skill;

                    return (
                      <div
                        key={skillItem.skill}
                        className="card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={18} color="var(--success)" />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {skillItem.skill}
                                </h3>
                              </div>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {skillItem.category}
                              </span>
                            </div>

                            <span
                              className={`badge ${skillItem.highestConfidence === 'high' ? 'badge-demonstrated' : 'badge-partially_demonstrated'}`}
                            >
                              {skillItem.highestConfidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                            {findingsForSkill[0]?.explanation || `Implementation verified across ${findingsForSkill.length} inspected file(s).`}
                          </div>

                          {/* Evidence Types Badges */}
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {skillItem.evidenceTypes?.map((et) => (
                              <span
                                key={et}
                                style={{
                                  fontSize: '0.72rem',
                                  background: 'var(--bg-subtle)',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: 'var(--radius-sm)',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {et}
                              </span>
                            ))}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                              ({findingsForSkill.length} citation{findingsForSkill.length > 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>

                        {/* Collapsible Evidence Citations */}
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                          <button
                            onClick={() => setExpandedSkill(isExpanded ? null : skillItem.skill)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            <span>{isExpanded ? 'Hide Evidence Excerpts' : `View ${findingsForSkill.length} Evidence Excerpt(s)`}</span>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>

                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                              {findingsForSkill.map((ev, idx) => (
                                <div
                                  key={ev.findingId || idx}
                                  style={{
                                    background: 'var(--bg-dark)',
                                    color: '#E2E8F0',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '0.75rem',
                                    fontSize: '0.78rem',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid #334155', paddingBottom: '0.35rem' }}>
                                    <span style={{ color: '#94A3B8' }}>
                                      {ev.filePath} (Lines {ev.lineRange.start}-{ev.lineRange.end})
                                    </span>
                                    <a
                                      href={ev.sourcePermalink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: '#818CF8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                      <span>GitHub Permalink</span>
                                      <ExternalLink size={12} />
                                    </a>
                                  </div>
                                  <pre style={{ overflowX: 'auto', margin: 0, lineHeight: 1.4, color: '#F8FAFC' }}>
                                    {ev.codeExcerpt}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 2: All Code Citations List */}
          {activeTab === 'evidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredFindings.map((finding) => (
                <div key={finding.findingId} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="badge badge-demonstrated">{finding.skill}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{finding.category}</span>
                      <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                        Type: {finding.evidenceType}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleCopyPermalink(finding.sourcePermalink, finding.findingId)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', gap: '0.35rem' }}
                      >
                        {copiedLink === finding.findingId ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                        <span>{copiedLink === finding.findingId ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <a
                        href={finding.sourcePermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.76rem', gap: '0.35rem' }}
                      >
                        <span>Open on GitHub</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {finding.explanation}
                  </p>

                  {/* Dark Code Excerpt Panel */}
                  <div
                    style={{
                      background: 'var(--bg-dark)',
                      color: '#E2E8F0',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', marginBottom: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.4rem', fontSize: '0.75rem' }}>
                      <span>{finding.repoFullName} / {finding.filePath}</span>
                      <span>Lines {finding.lineRange.start}–{finding.lineRange.end}</span>
                    </div>
                    <pre style={{ margin: 0, lineHeight: 1.5, color: '#F8FAFC' }}>{finding.codeExcerpt}</pre>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {finding.limitations}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Inspected & Skipped Files Explorer */}
          {activeTab === 'files' && (
            <div className="card">
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setFileFilterTab('inspected')}
                  style={{
                    fontWeight: fileFilterTab === 'inspected' ? 800 : 600,
                    color: fileFilterTab === 'inspected' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.88rem',
                  }}
                >
                  Inspected Files ({scanResult.inspectedFiles?.length || 0})
                </button>
                <button
                  onClick={() => setFileFilterTab('skipped')}
                  style={{
                    fontWeight: fileFilterTab === 'skipped' ? 800 : 600,
                    color: fileFilterTab === 'skipped' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.88rem',
                  }}
                >
                  Filtered / Skipped Files ({scanResult.skippedFiles?.length || 0})
                </button>
              </div>

              {fileFilterTab === 'inspected' ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Repository & File Path</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Language</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Type</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.inspectedFiles?.map((file, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.55rem 0.75rem', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{file.repoFullName} / </span>
                            <strong>{file.path}</strong>
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>{file.language}</td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>{file.type}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-muted)' }}>
                            {(file.size / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Skipped File Path</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Reason Excluded</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.skippedFiles?.map((file, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.55rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {file.path}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 600,
                                background:
                                  file.reason === 'secret_file'
                                    ? 'var(--danger-subtle)'
                                    : file.reason === 'lockfile'
                                    ? 'var(--warning-subtle)'
                                    : 'var(--bg-subtle)',
                                color:
                                  file.reason === 'secret_file'
                                    ? 'var(--danger)'
                                    : file.reason === 'lockfile'
                                    ? 'var(--warning)'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {file.reason}
                            </span>
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-muted)' }}>
                            {(file.size / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Scan History Snapshots */}
          {activeTab === 'history' && (
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Previous Scan Snapshots
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Immutable historical records preserved for longitudinal comparison across repository commits.
              </p>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={24} className="animate-spin" color="var(--primary)" />
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No prior scan snapshots recorded yet for this profile.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {historyList.map((hist) => (
                    <div
                      key={hist.scanId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        background: hist.scanId === scanResult?.scanId ? 'var(--primary-subtle)' : 'var(--bg-card)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{new Date(hist.scanTimestamp || hist.createdAt).toLocaleString()}</strong>
                          <span className={`badge ${hist.status === 'completed' ? 'badge-demonstrated' : 'badge-not_demonstrated'}`}>
                            {hist.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                          ID: {hist.scanId} | Repos: {hist.repositories?.map((r) => r.name).join(', ')} | Findings: {hist.stats?.totalFindings || 0}
                        </div>
                      </div>

                      <button
                        onClick={() => loadScanSnapshot(hist.scanId)}
                        className="btn btn-secondary btn-sm"
                        id={`btn-load-history-${hist.scanId}`}
                      >
                        <Eye size={13} />
                        <span>Load Snapshot</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
