# SkillProof AI — REST API Reference

Base URL: `http://localhost:5000/api` (proxied in development via Vite at `http://localhost:5173/api`)

---

## 1. System & Health

### `GET /api/health`
Checks backend service readiness, MongoDB connectivity, background worker status, and GitHub rate limits without leaking secrets.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-16T12:59:23.363Z",
  "uptime": 14.04,
  "environment": "development",
  "database": {
    "status": "connected",
    "connected": true
  },
  "worker": {
    "isRunning": true,
    "pollCount": 1,
    "lastPollTime": "2026-10-16T12:59:15.645Z",
    "activeRepoPolls": [],
    "lastError": null,
    "connectedClients": 1
  },
  "githubRateLimit": {
    "remaining": 55,
    "limit": 60,
    "reset": 1792158610,
    "hasToken": false
  },
  "llm": {
    "provider": "deterministic",
    "configured": true
  }
}
```

---

## 2. Jobs API

### `GET /api/jobs`
List stored jobs with pagination and optional keyword search.

**Query Parameters:**
- `page` (optional, default: `1`)
- `limit` (optional, default: `20`)
- `search` (optional)
- `skill` (optional)

### `POST /api/jobs/import`
Import a job via URL or pasted description. Uses SSRF protection to block private IP addresses and loopback URLs.

**Request Body (Pasted Description):**
```json
{
  "title": "Backend Engineer",
  "employer": "Stripe",
  "description": "Looking for engineers with Java, SQL, and REST APIs experience...",
  "sourceUrl": "https://stripe.com/jobs/123"
}
```

### `GET /api/jobs/:id`
Retrieve detailed job information including required and preferred skills.

---

## 3. Repositories API

### `GET /api/repositories`
List all tracked repositories.

### `POST /api/repositories/track`
Register a public GitHub repository for tracking.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/octocat/Hello-World"
}
```

### `POST /api/repositories/:id/poll-now`
Trigger immediate check for new commits on the repository default branch.

---

## 4. Assessments API

### `GET /api/assessments`
List generated assessments with optional filtering by `jobId` or `repositoryId`.

### `POST /api/assessments`
Execute an assessment of a repository against a job.

**Request Body:**
```json
{
  "jobId": "6ad21fa38ff1cd23761d1da3",
  "repositoryId": "6ad21fa38ff1cd23761d1dbf"
}
```

### `GET /api/assessments/:id`
Retrieve assessment summary, coverage score, and individual skill verification results.

### `GET /api/assessments/:id/history`
Retrieve all revisions (Rev 1, Rev 2, ...) for the job-repository pair.

### `GET /api/assessments/:id/compare?compareWith=:otherId`
Perform side-by-side delta comparison between two revisions.

---

## 5. Real-Time Activity & SSE

### `GET /api/activity`
Retrieve combined recent commit detections, change events, and assessments.

### `GET /api/activity/stream`
Server-Sent Events (SSE) connection endpoint. Pushes real-time notifications:
- `commit_detected`: Fired when background worker detects a new commit SHA.
- `assessment_updated`: Fired when automated reassessment completes with a new revision.
