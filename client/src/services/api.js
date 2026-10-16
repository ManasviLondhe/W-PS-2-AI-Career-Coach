import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

// Response interceptor for clear errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

export const jobApi = {
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  import: (data) => api.post('/jobs/import', data),
  extractSkills: (id) => api.post(`/jobs/${id}/extract-skills`),
  delete: (id) => api.delete(`/jobs/${id}`),
};

export const repoApi = {
  list: () => api.get('/repositories'),
  get: (id) => api.get(`/repositories/${id}`),
  track: (data) => api.post('/repositories/track', data),
  pause: (id) => api.post(`/repositories/${id}/untrack`),
  resume: (id) => api.post(`/repositories/${id}/track`),
  analyze: (id, jobId) => api.post(`/repositories/${id}/analyze`, { jobId }),
  evidence: (id) => api.get(`/repositories/${id}/evidence`),
  changes: (id) => api.get(`/repositories/${id}/changes`),
  delete: (id) => api.delete(`/repositories/${id}`),
  pollNow: (id) => api.post(`/repositories/${id}/poll-now`),
  inspect: (owner, repo) => api.get(`/github/${owner}/${repo}`),
  getFiles: (owner, repo, ref) => api.get(`/github/${owner}/${repo}/files`, { params: { ref } }),
  getCommits: (owner, repo, limit) => api.get(`/github/${owner}/${repo}/commits`, { params: { limit } }),
  getFileContent: (owner, repo, path, ref) => api.get(`/github/${owner}/${repo}/content`, { params: { path, ref } }),
};

export const assessmentApi = {
  list: (params) => api.get('/assessments', { params }),
  create: (data) => api.post('/assessments', data),
  get: (id) => api.get(`/assessments/${id}`),
  history: (id) => api.get(`/assessments/${id}/history`),
  compare: (id, compareWith) => api.get(`/assessments/${id}/compare`, { params: { compareWith } }),
  latestByRepo: (repoId) => api.get(`/assessments/latest/${repoId}`),
  getEvidence: (evidenceId) => api.get(`/assessments/evidence/${evidenceId}`),
  listEvidence: (params) => api.get('/assessments/evidence/list', { params }),
};

export const githubApi = {
  getUser: (username) => api.get(`/github/users/${username}`),
  getUserRepos: (username, params) => api.get(`/github/users/${username}/repos`, { params }),
  getRepoDetails: (owner, repo) => api.get(`/github/repos/${owner}/${repo}`),
  getRepoBranches: (owner, repo) => api.get(`/github/repos/${owner}/${repo}/branches`),
  getRepoTree: (owner, repo, params) => api.get(`/github/repos/${owner}/${repo}/tree`, { params }),
  startScan: (payload) => api.post('/github/scan', payload),
  getScanStatus: (scanId) => api.get(`/github/scan/${scanId}`),
  getScanEvidence: (scanId) => api.get(`/github/scan/${scanId}/evidence`),
  getRepoHistory: (owner, repo) => api.get(`/github/repos/${owner}/${repo}/history`),
  listScans: (params) => api.get('/github/scans', { params }),
  getScanById: (id) => api.get(`/github/scans/${id}`),
};

export const activityApi = {
  getActivity: (params) => api.get('/activity', { params }),
  getByAssessment: (assessmentId) => api.get(`/activity/${assessmentId}`),
  getHealth: () => api.get('/health'),
};

