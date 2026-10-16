# Feature 4 — Personalized Skill-Gap Analysis

**Branch:** `feature-4/skill-gap`  
**Project:** W-PS-2 AI Career Coach (SkillProof AI)  
**Author:** Feature implementation — AI Career Coach  

---

## 1. Original Problem & Product Requirements

Students using SkillProof AI receive skill assessment results (demonstrated, partially_demonstrated, not_demonstrated) against real job requirements. The MVP showed the gap but gave only brief, generic bullet-point recommendations stored directly in the `Assessment.skillResults[].recommendations` array with no persistence, no tracking, and no structured detail.

**Feature 4 objective:** Turn each skill gap into a specific, actionable, evidence-backed improvement plan that:
- Explains what the job requires and whether it is required or preferred.
- Shows what the assessment actually found in the analyzed repository scope.
- Identifies what is missing or insufficient.
- Recommends a practical portfolio task with step-by-step actions.
- Provides measurable acceptance criteria and verification steps.
- Links to relevant learning resources.
- Persists task progress across page reloads.
- Preserves the fundamental integrity rule: **task completion never changes the skill assessment.**

---

## 2. Existing Architecture Discovered During Inspection

| Layer | Technology | Key Files |
|---|---|---|
| Frontend | Vite + React, Vanilla CSS (Proofspace design system) | `client/src/` |
| Routing | React Router v6 | `client/src/App.jsx` |
| HTTP Client | Axios (with interceptor for error normalization) | `client/src/services/api.js` |
| Backend | Express.js (ESM modules) | `server/src/app.js` |
| Validation | Zod | `server/src/middleware/validate.js` |
| Database | MongoDB via Mongoose (auto-fallback to MongoMemoryServer) | `server/src/config/database.js` |
| LLM | `AiCoachService` — Gemini 1.5 Flash → OpenAI GPT-4o-mini → deterministic | `server/src/services/aiCoachService.js` |
| Assessment | `AssessmentService` — full pipeline from GitHub → Evidence → Scoring → AI | `server/src/services/assessmentService.js` |
| Models | Job, Repository, Evidence, Assessment, ChangeEvent | `server/src/models/` |
| Tests | Node.js built-in test runner (`node:test`) | `server/tests/unit/` |

**Pre-existing SkillGapPage state:** A basic stub that read `assessment.skillResults` and rendered `recommendations[]` (simple strings from `AiCoachService`). No persistence, no task tracking, no structured detail.

---

## 3. Design & Implementation Plan

The feature was implemented in 8 phases:

1. **Recommendation model** — new MongoDB collection with task progress, priority, evidence snapshot, and staleness tracking.
2. **SkillGapAnalysisService** — core engine: reads Assessment → filters gaps → calls LLM (or deterministic fallback) → upserts Recommendation documents.
3. **RecommendationController** — Express controller with Zod-validated endpoints.
4. **recommendationRoutes** — router registered in `app.js`.
5. **assessmentService.js hook** — marks recommendations stale when a new assessment revision is saved.
6. **Client api.js** — `recommendationsApi` namespace.
7. **SkillGapPage.jsx rebuild** — full UX with task tracking, evidence context, expandable steps/criteria/resources, skeleton loaders, error handling.
8. **Tests** — 39 unit tests covering priority, gap filtering, task validation, data integrity, scope-honest language, and classification preservation.

---

## 4. Files Created & Modified

### Created (New)

| File | Purpose |
|---|---|
| `server/src/models/Recommendation.js` | MongoDB schema for persistent recommendations and task progress |
| `server/src/services/skillGapAnalysisService.js` | Gap analysis engine: LLM prompts, deterministic fallback, priority, staleness |
| `server/src/controllers/recommendationController.js` | HTTP handler for all recommendation endpoints |
| `server/src/routes/recommendationRoutes.js` | Express router for `/api/recommendations` |
| `server/tests/unit/skillGapAnalysis.test.js` | 39 unit tests for Feature 4 |
| `docs/FEATURE_4_SKILL_GAP_ANALYSIS.md` | This document |
| `docs/FEATURE_4_IMPLEMENTATION_LOG.md` | Step-by-step implementation log |

### Modified (Existing)

| File | Change |
|---|---|
| `server/src/models/index.js` | Added `Recommendation` export |
| `server/src/services/assessmentService.js` | Added `SkillGapAnalysisService.markRecommendationsStale()` call after a new revision is saved |
| `server/src/app.js` | Registered `/api/recommendations` routes |
| `client/src/services/api.js` | Added `recommendationsApi` namespace |
| `client/src/pages/SkillGapPage.jsx` | Full rebuild: persistent recommendations, task tracking, evidence context, learning resources |
| `client/src/index.css` | Added `@keyframes pulse` and `.animate-spin` utilities |

---

## 5. Data Flow: Assessment → LLM → Frontend

```
User Action: "Generate Recommendations" button
        │
        ▼
POST /api/recommendations/generate { assessmentId }
        │
        ▼
RecommendationController.generateRecommendations()
        │
        ▼
Assessment.findById(assessmentId).populate('job').populate('repository')
        │
        ▼
Filter skillResults → gaps (not_demonstrated | partially_demonstrated)
        │
        ▼
Evidence.find({ evidenceId: { $in: allEvIds } })  — load actual code evidence
        │
        ▼
SkillGapAnalysisService:
  IF env.LLM_PROVIDER === 'gemini' && GEMINI_API_KEY
    → buildLlmPrompt({ job, repo, gaps, evidenceMap })
    → POST generativelanguage.googleapis.com (Gemini 1.5 Flash, JSON mode)
    → Zod validate LlmBatchResponseSchema
  ELSE IF 'openai' && OPENAI_API_KEY
    → POST api.openai.com (gpt-4o-mini, JSON mode)
    → Zod validate
  ELSE
    → buildDeterministicRecommendation() per skill
        │
        ▼
Recommendation.findOneAndUpdate(
  { assessment: id, skill: gap.skill },
  { $set: { content, priority, snapshotStatus, ... } },
  { upsert: true, new: true }
)  ← IDEMPOTENT: no duplicate records on retry
        │
        ▼
Mark older recommendations (same job+repo, different assessment) as isStale=true
        │
        ▼
Return { recommendations[], source, cached, count }
        │
        ▼
Client: setRecommendations(data.recommendations)
        → Renders RecommendationCard components sorted by priority desc
        → Task progress buttons call PATCH /api/recommendations/:id/progress
        → Task progress updates saved to MongoDB, survive page refresh
```

---

## 6. API Endpoints

### POST /api/recommendations/generate

Generate (or refresh) recommendations for an assessment. Idempotent — uses upsert.

**Request:**
```json
{
  "assessmentId": "6789abc...",
  "forceRegenerate": false
}
```

**Response 201 (new recommendations):**
```json
{
  "success": true,
  "data": {
    "recommendations": [ /* array of Recommendation objects */ ],
    "source": "gemini",
    "cached": false,
    "count": 3
  }
}
```

**Response 200 (cached — no changes needed):**
```json
{
  "success": true,
  "data": {
    "recommendations": [ /* existing recommendations */ ],
    "source": "cached",
    "cached": true,
    "count": 3
  }
}
```

---

### GET /api/recommendations/by-assessment/:assessmentId

Get all recommendations for a specific assessment, with assessment context and counts.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "assessment": {
      "_id": "6789...",
      "revisionNumber": 2,
      "commitSha": "a1b2c3d",
      "coverageScore": 45,
      "job": { "title": "Software Engineer", "employer": "Acme Corp" },
      "repository": { "fullName": "alice/my-project" }
    },
    "skillSummary": [
      { "skill": "SQL", "classification": "required", "status": "not_demonstrated" }
    ],
    "recommendations": [ /* sorted by priority desc */ ],
    "counts": { "total": 3, "pending": 2, "inProgress": 1, "completed": 0, "stale": 0 }
  }
}
```

---

### GET /api/recommendations

List recommendations with optional filters.

**Query params:** `assessmentId`, `jobId`, `repositoryId`, `skill`, `taskStatus`, `isStale`, `page`, `limit`

---

### GET /api/recommendations/:id

Get a single recommendation with full populated context.

---

### PATCH /api/recommendations/:id/progress

Update task progress. **Never modifies the Assessment or any skill status.**

**Request:**
```json
{
  "taskStatus": "completed",
  "taskNotes": "Added schema.sql with joins and a Jest integration test."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* updated Recommendation */ },
  "message": "Task marked as \"completed\". Note: this does not change the skill assessment. The repository must be rescanned for the assessment status to update."
}
```

---

## 7. Recommendation & Task Database Schema

See [Recommendation.js](../server/src/models/Recommendation.js) for the full schema.

Key fields:

| Field | Type | Purpose |
|---|---|---|
| `assessment` | ObjectId → Assessment | Links to the specific assessment revision |
| `assessmentRevision` | Number | Revision number snapshot for display |
| `job` | ObjectId → Job | Job context link |
| `repository` | ObjectId → Repository | Repository context link |
| `skill` | String | Skill name (e.g., "SQL") |
| `requirementClassification` | enum: required/preferred | Preserved from job |
| `snapshotStatus` | enum: demonstrated/partially.../not.../unable | Historical snapshot — READ ONLY via task progress |
| `snapshotExplanation` | String | What the assessment found |
| `snapshotEvidenceIds` | [String] | Evidence IDs at generation time |
| `title` | String | Concise recommendation title |
| `whyItMatters` | String | Job-specific context |
| `whatCurrentEvidenceShows` | String | Scope-honest assessment summary |
| `whatRemainsMissing` | String | What evidence gap exists |
| `implementationPlan` | String | One-paragraph overview |
| `implementationSteps` | [String] | Ordered step-by-step actions |
| `acceptanceCriteria` | [String] | Measurable done conditions |
| `suggestedTests` | [String] | Verification steps |
| `difficultyLevel` | enum: beginner/intermediate/advanced | Effort indicator |
| `estimatedEffort` | String | e.g., "2-4 hours" |
| `priority` | Number 1-100 | Sort order (required+not_demo = 100) |
| `learningResources` | [{title, url, type, description}] | Curated links |
| `generationSource` | enum: gemini/openai/deterministic | Audit trail |
| `taskStatus` | enum: pending/in_progress/completed | Student's self-reported progress |
| `taskNotes` | String | Optional student notes |
| `taskCompletedAt` | Date | Timestamp when marked completed |
| `isStale` | Boolean | True when a newer assessment supersedes this |
| `stalenessReason` | String | Human-readable reason for staleness |

**Indexes:**
- `{ assessment: 1, skill: 1 }` — upsert key (prevents duplicates)
- `{ job: 1, repository: 1 }` — staleness updates
- `{ taskStatus: 1 }` — filter by progress
- `{ isStale: 1 }` — filter stale recommendations

---

## 8. LLM Provider Selection & Configuration

The service follows the exact same provider-selection pattern as `AiCoachService`:

```javascript
if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
  // Use Gemini 1.5 Flash with JSON mode
} else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
  // Use GPT-4o-mini with JSON response_format
} else {
  // Use deterministic rule-based fallback
}
```

This respects the existing `LLM_PROVIDER` environment variable. No API keys are hardcoded.

---

## 9. Prompt Design & Structured Output Validation

**Prompt strategy:**
- Sends only the minimal context needed: job title/company, skill name, assessment status, explanation, evidence excerpts (truncated to 300 chars each).
- Explicitly instructs the model not to invent file paths, line numbers, or URLs.
- Uses scope-honest language constraints: must say "not found in analyzed repository scope", never "student does not know".
- Requests a specific JSON schema (`LlmBatchResponseSchema`).

**Validation:**
```javascript
const LlmBatchResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      skill: z.string(),
      title: z.string().min(1),
      whyItMatters: z.string().default(''),
      implementationSteps: z.array(z.string()).default([]),
      acceptanceCriteria: z.array(z.string()).default([]),
      learningResources: z.array(z.object({
        title: z.string(), url: z.string().url(), ...
      })).default([]),
      // ... other fields with defaults
    })
  ),
});
```

If Zod validation fails → falls back to deterministic recommendations (not a silent failure; logged with `console.warn`).

---

## 10. Error Handling, Retries, Fallback & Rate Limits

| Scenario | Behaviour |
|---|---|
| Gemini times out (20s) | Falls back to deterministic; logs warning |
| Gemini returns malformed JSON | Zod catches it; falls back to deterministic |
| Gemini API key missing | Skips to next provider or deterministic |
| Assessment not found | 404 with clear error message |
| Invalid task status | 400 with validation details |
| MongoDB write fails | Standard error handler → 500 |
| `generate` called twice | Upsert prevents duplicates; returns `cached: true` if nothing changed |
| Rate limiting | Inherited from `apiRateLimiter` middleware on `/api` routes (300 req/15min) |

API keys are never logged. Provider errors are not exposed to the client (only a generic "Failed to generate recommendations" message reaches the frontend).

---

## 11. Task Progress Persistence

Task progress is stored in `Recommendation.taskStatus` in MongoDB. 

- Survives page reload: the `SkillGapPage` fetches fresh recommendations on mount.
- Survives application restart: data is in MongoDB (Atlas or MongoMemoryServer).
- The `PATCH /api/recommendations/:id/progress` endpoint uses `findByIdAndUpdate` — never a full document replace.
- Only `taskStatus`, `taskNotes`, and `taskCompletedAt` are modified. All other fields (including `snapshotStatus`) remain untouched.

---

## 12. Recommendation Freshness & Assessment History

When `AssessmentService.runAssessment()` saves a new `Assessment` document:

```javascript
await SkillGapAnalysisService.markRecommendationsStale(
  job._id, repo._id, assessment._id, nextRevision
);
```

This sets `isStale: true` on all prior recommendations for the same (job, repo) pair that are NOT the newly-created assessment. The `stalenessReason` field is set with a human-readable message.

The frontend displays a warning banner on stale recommendations. The student can click "Regenerate" to get fresh recommendations from the latest assessment.

**Historical data is preserved**: stale recommendations are never deleted. They remain in MongoDB as a record of the student's past progress.

---

## 13. How to Run the Feature Locally

```bash
# Terminal 1: Start the backend
cd server
npm install       # if first time
npm run dev       # starts on http://localhost:5000

# Terminal 2: Start the frontend
cd client
npm install       # if first time
npm run dev       # starts on http://localhost:5173
```

Navigate to any assessment and click "Skill Gaps" in the sidebar, or go to `/assessments/:id/gaps`.

---

## 14. Required Environment Variables

```env
# server/.env
LLM_PROVIDER=gemini          # gemini | openai | deterministic
GEMINI_API_KEY=              # Required if LLM_PROVIDER=gemini
OPENAI_API_KEY=              # Required if LLM_PROVIDER=openai
MONGODB_URI=                 # Optional; auto-falls back to MongoMemoryServer
GITHUB_TOKEN=                # Optional for public repos
```

All variables are listed in `server/.env.example`. Never commit actual secret values.

---

## 15. Tests Executed & Results

```
Command: node --test tests/unit/scoringService.test.js tests/unit/skillGapAnalysis.test.js \
               tests/unit/evidenceExtractor.test.js tests/unit/jobSkillExtraction.test.js

# tests: 39
# suites: 9
# pass:   39 ✅
# fail:   0
# duration_ms: 4933

New Feature 4 test suites (33 tests):
  ✅ Feature 4 — Priority Calculation (6 tests)
  ✅ Feature 4 — Gap Filtering Logic (4 tests)
  ✅ Feature 4 — Task Status Validation (7 tests)
  ✅ Feature 4 — Data Integrity: Task Completion ≠ Skill Assessment Change (2 tests)
  ✅ Feature 4 — Scope-Honest Language (4 tests)
  ✅ Feature 4 — Classification Preservation (2 tests)

Existing test suites (preserved):
  ✅ EvidenceExtractor — Code Syntax & Implementation Verification (5 tests)
  ✅ Job Skill Extraction & Normalization (4 tests)
  ✅ ScoringService — Evidence Coverage Calculations (5 tests)
```

---

## 16. Manual End-to-End Test Checklist

1. **Start both servers** (`npm run dev` in `server/` and `client/`).
2. **Import a real job** — navigate to /jobs, click "Add Job", paste a real job description (e.g., Software Engineer requiring SQL, React, Node.js).
3. **Connect a GitHub repository** — navigate to /repositories → Connect Repo, enter `owner/repo`.
4. **Run an assessment** — go to Dashboard, select job + repo, click "Run Analysis". Wait for completion.
5. **Navigate to Skill Gaps** — click "Skill Gaps" in the sidebar or the "View Gaps" link on the Assessment workspace.
6. **Verify gap context card** — confirms job title, employer, repository, commit SHA, coverage score, and gap count.
7. **Click "Generate Recommendations"** — button triggers the LLM/deterministic engine.
8. **Verify each recommendation card shows:**
   - Skill name and correct classification badge (required/preferred)
   - Assessment status badge (not_demonstrated/partially_demonstrated)
   - "Why it matters" section with job context
   - "Current evidence" section with scope-honest language
   - "Missing" section explaining the gap
   - Implementation plan paragraph
   - Source attribution (gemini/openai/deterministic)
9. **Click "Show implementation steps"** — verify ordered steps, acceptance criteria, verification steps, and learning resource links appear.
10. **Mark a task "In Progress"** — click the "In Progress" button. Verify the status indicator changes immediately.
11. **Refresh the page** — verify "In Progress" status persists (fetched from MongoDB).
12. **Mark a task "Completed"** — verify completion timestamp appears.
13. **Verify the skill assessment is unchanged** — navigate to `/assessments/:id`. The skill status should still show `not_demonstrated`. Task completion must NOT have changed it.
14. **Run a second assessment** — go to Dashboard and click "Run Analysis" again.
15. **Verify stale warning** — navigate back to Skill Gaps. The old recommendations should show the "Stale" warning banner.
16. **Click "Regenerate"** — new recommendations are generated from the latest assessment. Stale warnings disappear.
17. **Verify the original completed task note survived** — if `forceRegenerate: false` was used, task progress is preserved during upsert.

---

## 17. Known Limitations & Future Improvements

| Limitation | Notes |
|---|---|
| LLM learning resource URLs may be hallucinated | Deterministic fallback uses only well-known stable URLs; LLM is instructed to omit uncertain ones but cannot guarantee accuracy |
| No email/notification when assessment changes | Could be added using the existing SSE stream |
| No per-user access control | The MVP does not have authentication; all data is shared |
| `forceRegenerate: true` resets taskStatus | Deliberate tradeoff — on forced regeneration, progress is reset to `pending` |
| MongoMemoryServer data does not survive process restart | Use `MONGODB_URI` pointing to persistent MongoDB for production |
| Integration tests not yet written | Unit tests cover pure logic; integration tests would require a running MongoDB instance |

---

## 18. Beginner-Friendly Code Flow Walkthrough

### How does "Generate Recommendations" work?

**Step 1: The user clicks the button.**
In `SkillGapPage.jsx`, `handleGenerate()` is called. It calls `recommendationsApi.generate(assessmentId)`, which sends a POST request to the backend.

**Step 2: The backend receives the request.**
`recommendationRoutes.js` routes it to `RecommendationController.generateRecommendations()`. Zod validates the request body — if `assessmentId` is missing, a 400 error is returned immediately.

**Step 3: The service reads the existing assessment.**
`SkillGapAnalysisService.generateRecommendations()` calls `Assessment.findById()` with `.populate('job')` and `.populate('repository')` to get all the related data in one query.

**Step 4: Filter to gaps.**
The service filters `assessment.skillResults` to only include skills where `status` is `'not_demonstrated'` or `'partially_demonstrated'`. Demonstrated skills need no recommendation.

**Step 5: Load evidence.**
All `evidenceIds` from the gap skills are collected and fetched from the `Evidence` collection. These give the LLM real code excerpts to reference.

**Step 6: Call the LLM (or fallback).**
If `GEMINI_API_KEY` is set and `LLM_PROVIDER=gemini`, `generateWithGemini()` is called. It builds a prompt containing the job title, company, skill gaps, and evidence excerpts. It sends this to the Gemini API and gets back a JSON response. `LlmBatchResponseSchema` (a Zod schema) validates the response. If validation fails or the API errors, the service falls back to `buildDeterministicRecommendation()` which uses hard-coded, skill-specific blueprints.

**Step 7: Upsert to MongoDB.**
For each gap, `Recommendation.findOneAndUpdate({ assessment: id, skill: gap.skill }, { $set: content }, { upsert: true })` saves the recommendation. Using `upsert: true` means if you click "Generate" twice, you don't get duplicate records.

**Step 8: Mark older recommendations stale.**
Any recommendations for the same job+repository that belong to older assessment revisions are flagged `isStale: true`.

**Step 9: Return to the frontend.**
The recommendations array is returned. The React component stores them in state and renders a `RecommendationCard` for each one.

### How does task progress work?

When the student clicks "In Progress" or "Completed":
1. `handleProgressUpdate(recId, newStatus)` is called.
2. It calls `recommendationsApi.updateProgress(recId, newStatus)`.
3. The backend validates `newStatus` against `['pending', 'in_progress', 'completed']` using Zod.
4. `SkillGapAnalysisService.updateTaskProgress()` calls `Recommendation.findByIdAndUpdate()` — **only** updating `taskStatus`, `taskNotes`, and `taskCompletedAt`.
5. The `Assessment` document is **never touched** in this code path.
6. The response includes a clear message reminding the user that the skill assessment won't change until new code is scanned.
7. The React component updates its local state so the UI reflects the change immediately.

### Why does the skill status stay the same after completing a task?

This is by design and enforced at multiple levels:
- The `PATCH /progress` endpoint only writes to the `Recommendation` model.
- The `Recommendation.snapshotStatus` field is set once at generation time and never updated by progress tracking.
- The actual `Assessment.skillResults[].status` is only ever written by `AssessmentService.runAssessment()`, which requires actual GitHub repository scanning.
- A test (`task status transition to "completed" does not return a skill status`) verifies this separation.
