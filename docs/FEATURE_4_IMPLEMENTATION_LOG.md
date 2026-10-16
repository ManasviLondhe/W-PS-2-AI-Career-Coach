# Feature 4 — Implementation Log

**Branch:** `feature-4/skill-gap`  
**Date:** 2026-10-16

---

## Phase 1: Codebase Inspection

**Git state:** Confirmed on branch `feature-4/skill-gap`. `node_modules` deletions visible in git status (expected — node_modules not committed).

**Existing state of SkillGapPage.jsx:** Basic stub reading `assessment.skillResults` and rendering `recommendations[]` (simple strings). No persistence, no task tracking, no LLM interaction beyond what `AiCoachService` already produces during the assessment run.

**Key findings:**
- `AiCoachService` already supports Gemini / OpenAI / deterministic. Uses `env.LLM_PROVIDER` and `env.GEMINI_API_KEY`.
- `AssessmentService` stores immutable assessment revisions with `revisionNumber`.
- No `Recommendation` model existed.
- No `/api/recommendations` routes existed.
- The client had a `SkillGapPage` route at `/assessments/:id/gaps` and `/gaps`.
- CSS design system uses CSS variables (`--primary`, `--warning`, `--success`, etc.) — all reused.
- Test runner: `node --test` (Node.js built-in, ESM compatible).

---

## Phase 2: Recommendation Model

**File created:** `server/src/models/Recommendation.js`

Key design decisions:
- `snapshotStatus` field stores the historical assessment status at generation time. It is READ-ONLY from the task progress update path — enforced by only updating `taskStatus`/`taskNotes`/`taskCompletedAt` in the progress endpoint.
- `isStale` + `stalenessReason` fields support the "freshness" requirement without deleting historical records.
- Compound index `{ assessment: 1, skill: 1 }` is the upsert key to prevent duplicate recommendations on retry.
- `priority` is a computed 1-100 integer (required+not_demonstrated = 100) for frontend sorting.

**File modified:** `server/src/models/index.js` — added `Recommendation` export.

---

## Phase 3: SkillGapAnalysisService

**File created:** `server/src/services/skillGapAnalysisService.js`

Key implementation decisions:
- Reuses the exact same Gemini/OpenAI call pattern as `AiCoachService` — same fetch, same Zod validation, same fallback strategy.
- LLM receives: job title, company, skill name, classification, assessed status, explanation, evidence excerpts (max 300 chars each to avoid token bloat).
- Deterministic fallback contains skill-specific step blueprints for: SQL, Java, React, Node.js, Testing, CI/CD, Docker, MongoDB, REST APIs, Python, TypeScript. Unknown skills get a generic blueprint.
- Learning resources in deterministic fallback use only well-known stable URLs (official docs only).
- `findOneAndUpdate` with `upsert: true` is idempotent — calling generate twice is safe.
- `markRecommendationsStale()` is a static method called by `AssessmentService` after saving a new revision. Wrapped in try/catch so staleness tagging failure does not fail the assessment.

**File modified:** `server/src/services/assessmentService.js` — added import and `markRecommendationsStale()` call after `assessment.save()`.

---

## Phase 4: Controller & Routes

**File created:** `server/src/controllers/recommendationController.js`

Endpoints implemented:
- `POST /generate` — generate with upsert
- `GET /` — list with filters
- `GET /by-assessment/:assessmentId` — convenience endpoint used by SkillGapPage
- `GET /:id` — single recommendation
- `PATCH /:id/progress` — task progress (never touches Assessment)

**File created:** `server/src/routes/recommendationRoutes.js`

**File modified:** `server/src/app.js` — registered `recommendationRoutes` at `/api/recommendations`.

---

## Phase 5: Client API

**File modified:** `client/src/services/api.js` — added `recommendationsApi` namespace with all 5 methods.

---

## Phase 6: SkillGapPage Rebuild

**File modified:** `client/src/pages/SkillGapPage.jsx` — complete rewrite.

Components implemented within the page file:
- `TaskStatusButton` — inline progress button with active state styling.
- `LearningResourceLink` — styled anchor with type icon and hover animation.
- `RecommendationCard` — full card: stale banner, header, classification/status badges, why-it-matters, evidence context, implementation plan, expandable steps/criteria/resources, task progress controls, integrity disclaimer.
- `RecommendationSkeleton` — animated loading placeholder.

Key UX decisions:
- "Generate Recommendations" button only shown when gaps exist and no recommendations yet.
- "Regenerate" button shown when recommendations exist (allows refresh after new assessment).
- Stale recommendations sort to the bottom; still visible with a warning banner.
- Expanding/collapsing steps uses local `useState` per card (no global state needed).
- Integrity disclaimer on every card — cannot be missed.
- All data comes from backend — no hardcoded mock recommendations.

**File modified:** `client/src/index.css` — added `@keyframes pulse` (skeleton loader) and `.animate-spin` (spinner).

---

## Phase 7: Tests

**File created:** `server/tests/unit/skillGapAnalysis.test.js`

39 tests added covering:
- Priority calculation (6 tests)
- Gap filtering logic (4 tests)
- Task status validation including rejection of "demonstrated" as a task status (7 tests)
- Data integrity: task completion ≠ skill assessment change (2 tests)
- Scope-honest language (4 tests)
- Classification preservation (2 tests)

Existing tests also run: ScoringService (5), EvidenceExtractor (5), JobSkillExtraction (4).

**Test command run:**
```
node --test tests/unit/scoringService.test.js tests/unit/skillGapAnalysis.test.js tests/unit/evidenceExtractor.test.js tests/unit/jobSkillExtraction.test.js
```

**Result: 39/39 pass, 0 fail.**

---

## Phase 8: Documentation

**File created:** `docs/FEATURE_4_SKILL_GAP_ANALYSIS.md`
**File created:** `docs/FEATURE_4_IMPLEMENTATION_LOG.md` (this file)

---

## Problems Encountered & Solutions

| Problem | Solution |
|---|---|
| `node_modules` deletions polluting `git status` | Confirmed expected; `node_modules` is in `.gitignore` and never committed |
| PowerShell uses `;` not `&&` for command chaining | Used separate command calls |
| `animate-spin` class referenced in JSX but missing from CSS | Added to `index.css` |
| `forceRegenerate` in upsert: should it reset taskStatus? | Only resets on `forceRegenerate: true` to preserve progress on normal regeneration |

---

## Git Safety Confirmation

- Branch: `feature-4/skill-gap` — confirmed before any edits.
- No `git add`, `git commit`, `git push`, or `git merge` was performed.
- No destructive git commands were used.
- No `.env` file was created or modified.
- No API keys appear in any created file.
- Changes are strictly limited to Feature 4 files and closely related tests/documentation.
