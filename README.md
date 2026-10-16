# SkillProof AI — Your Skills Deserve Proof
**W-PS-2 AI Career Coach | Sponsored by Worcflow**

> **"Compare real job requirements with the code you have actually built. Discover what your portfolio demonstrates, identify evidence gaps, and watch your assessment evolve as you ship."**

[![Tests](https://img.shields.io/badge/tests-22%2F22%20passing-success.svg)](file:///d:/Projects/skillproof-ai/server/tests)
[![Client](https://img.shields.io/badge/client-React%20%2B%20Vite%20%2B%20TailwindCSS-indigo.svg)](file:///d:/Projects/skillproof-ai/client)
[![Backend](https://img.shields.io/badge/backend-Express%20%2B%20MongoDB%20%2B%20SSE-green.svg)](file:///d:/Projects/skillproof-ai/server)

---

## The Central Product Experience

SkillProof AI answers three critical questions for developers and students:
1. **What the job requires** — Real job postings and internship requirements with verifiable source links.
2. **What the portfolio proves** — Code evidence retrieved from actual GitHub repositories with file paths, commit SHAs, and permalinks.
3. **What needs attention** — Requirements that are partially supported or not demonstrated in the analyzed scope.

When the developer pushes a new commit to GitHub, the background worker automatically detects the change, reassesses affected skills, and updates the interface in real-time via Server-Sent Events (SSE).

---

## Key Features & Visual Identity ("Proofspace")

- **Proof Engine Hero**: 3-panel responsive visual preview mapping Requirements $\rightarrow$ Repository Code $\rightarrow$ Skill Proof.
- **Strict Evidence Semantics**: Enforces 3 non-judgmental statuses:
  - `Demonstrated` (Forest green badge with commit-pinned evidence).
  - `Partially demonstrated` (Warm amber badge with limitation context).
  - `Not demonstrated in analyzed scope` (Neutral slate badge; never claims a developer "lacks skill").
- **Immutable Assessment History**: Every reassessment produces a versioned audit trail (Revision 1, Revision 2, ...) with side-by-side delta comparisons.
- **Contextual AI Coach**: Grounded coaching recommendations that explicitly differentiate advice from current evidence.
- **Automatic Fallback Persistence**: Connects to MongoDB Atlas, with instantaneous auto-fallback to an in-memory database if network IP whitelisting is needed.
- **Developer Keyboard Navigation**: Full `Ctrl+K` command palette with search and quick actions.

---

## Project Structure

```
skillproof-ai/
├── client/                      # React + Vite + TailwindCSS Frontend ("Proofspace")
│   ├── src/
│   │   ├── components/          # Reusable UI components (AppShell, Badges, Drawers, ProofEngine)
│   │   ├── pages/               # All 13 mandatory routes (Dashboard, Jobs, Repos, History, etc.)
│   │   ├── services/            # Centralized API client & SSE event subscriber
│   │   └── index.css            # Proofspace design tokens, dark code panels, typography
│   └── package.json
├── server/                      # Node.js + Express + Worker Backend
│   ├── src/
│   │   ├── config/              # Database connection, seed data, environment validation
│   │   ├── controllers/         # REST endpoints for jobs, repositories, assessments, and activity
│   │   ├── models/              # Mongoose schemas (Job, Repository, Assessment, Evidence, ChangeEvent)
│   │   ├── services/            # EvidenceExtractor, ScoringService, GitHubService, AiCoachService
│   │   └── workers/             # Background PollingWorker & SSE broadcaster
│   ├── tests/                   # 22/22 unit and integration tests
│   └── package.json
├── docs/                        # Complete architecture, API, and demo guides
│   ├── architecture.md          # System design & Proofspace UX tokens
│   ├── api.md                   # REST API documentation
│   └── demo-script.md           # 3-minute hackathon judging walkthrough
├── package.json                 # Unified monorepo run scripts
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Run the Verification Tests (22/22 Passing)
```bash
npm test
```

### 3. Start the Full Application

In Terminal 1 (Backend Server on `http://localhost:5000`):
```bash
npm run server
# or: cd server && npm start
```

In Terminal 2 (Frontend Client on `http://localhost:5173`):
```bash
npm run client
# or: cd client && npm run dev
```

Open your browser to: **[http://localhost:5173](http://localhost:5173)**

---

## End-to-End Change-Detection Verification

Run the integration test suite to observe the complete commit-to-reassessment flow:

```bash
npm test
```

**Scenario Output:**
1. Initial baseline assessment evaluated for `student/payment-microservice`:
   - `Java`: **Demonstrated** (Spring Boot service found in `src/main/java/PaymentService.java`).
   - `SQL`: **Not demonstrated in analyzed scope** (No database queries in commit #1).
2. Background worker detects new commit `2222222`:
   - Added file: `database/queries.sql`.
   - Affected skill detected: `SQL`.
3. Background worker automatically reassesses the repository:
   - Revision #2 generated and saved.
   - `SQL`: Transitioned to **Demonstrated** with commit permalink!
   - Revision #1 remains intact and accessible in revision history.

---

## Documentation Links

- **[System Architecture](docs/architecture.md)**: Proofspace design tokens, continuous polling worker, SSE sync, and scoring formula.
- **[REST API Reference](docs/api.md)**: All endpoints, query parameters, and payload schemas.
- **[Live Demo Script](docs/demo-script.md)**: Step-by-step presentation walkthrough for judges.
