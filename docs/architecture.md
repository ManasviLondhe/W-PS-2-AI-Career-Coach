# SkillProof AI — System Architecture & Design Specification
**Sponsored by Worcflow (W-PS-2 AI Career Coach)**

---

## 1. High-Level System Architecture

SkillProof AI is designed as an evidence-first developer career intelligence platform that verifies skill claims through actual repository artifacts rather than static resume assertions.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Vite + React Frontend ("Proofspace")                 │
│  - Editorial Typography & Warm Off-White Theme (#F8F8F5)               │
│  - 3-Panel Interactive Proof Engine (Requirements → Code → Proof)      │
│  - Assessment Matrix, Skill Detail Drawer & Gap Blueprints             │
│  - Server-Sent Events (SSE) Live Sync Pill & Event Stream              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         HTTP REST & SSE Events
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Express.js REST & Real-Time Server                  │
│  - Helmet & Rate-Limiting Protection                                  │
│  - SSRF-Hardened URL Fetching & Parsing Engine                         │
│  - Rule-Based / LLM Career Coach Engine                               │
│  - Deterministic 3-Tier Scoring Engine (Coverage %)                   │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
┌───────────────▼───────────────┐ ┌─────────────▼────────────────────────┐
│   Background Polling Worker   │ │     Data Persistence Layer           │
│  - 15s Git Poll Cycles        │ │  - MongoDB Atlas (Cloud)             │
│  - Change Detection (SHAs)    │ │  - Auto-Fallback to In-Memory DB     │
│  - File-to-Skill Mapping      │ │  - Immutable Revision History        │
│  - Triggered Reassessments    │ │    (Rev 1, Rev 2, Rev 3...)          │
└───────────────┬───────────────┘ └──────────────────────────────────────┘
                │
┌───────────────▼───────────────┐
│       GitHub REST API v3      │
│  - Tree, Commits, & Blobs     │
│  - Rate-Limit Guard & Metrics │
└───────────────────────────────┘
```

---

## 2. Visual Identity & Design System ("Proofspace")

The user interface follows the **Proofspace** design language crafted specifically for developer tools:

| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#F8F8F5` | Warm off-white background |
| `--color-surface` | `#FFFFFF` | Elevated cards, tables, panels |
| `--color-ink-primary` | `#171923` | Deep editorial ink text |
| `--color-ink-secondary` | `#626779` | Slate body, subtitles, metadata |
| `--color-accent` | `#5146E5` | Vivid indigo brand accent |
| `--color-accent-subtle` | `#EFEDFF` | Lavender active state indicator |
| `--color-status-demonstrated` | `#18794E` | Forest green verified proof badge |
| `--color-status-partial` | `#B66B08` | Warm amber partial evidence badge |
| `--color-status-not-demonstrated` | `#4B5563` | Neutral slate (honest analyzed scope) |
| `--color-code-bg` | `#151821` | Dark syntax-highlighted code panels |
| `--color-border-subtle` | `#E6E7ED` | 1px border dividers |

---

## 3. Strict Assessment Status Semantics

SkillProof AI strictly prohibits judgmental phrasing like *"You lack skill"* or *"Unqualified"*. All assessments map to three precise statuses:

1. **Demonstrated (`demonstrated`)**:
   - Backed by genuine code evidence (e.g. Spring Boot annotations, parameterized SQL queries, functional React components).
   - Linked to a commit SHA, file path, line numbers, and GitHub permalink.
2. **Partially demonstrated (`partially_demonstrated`)**:
   - Code exhibits surface usage (e.g. imports or stubs) without robust error handling, testing, or comprehensive data logic.
3. **Not demonstrated in analyzed scope (`not_demonstrated`)**:
   - Honest uncertainty stating that no qualifying code artifacts were located in the analyzed branch/commit scope.
   - Distinct from personal incompetence—allows students to demonstrate the skill by pushing targeted code.

---

## 4. Reassessment Engine & Change Detection

1. **Continuous Worker**: Runs in the background (default 15,000ms polling interval) with rate-limit monitoring.
2. **Commit Comparison**: When `previousSha !== newSha`, the worker identifies changed files.
3. **Skill Impact Mapping**: Modified files are analyzed against known skill patterns:
   - `database/*.sql` → Affects **SQL**
   - `src/**/*.java` → Affects **Java**
   - `src/**/*.tsx`, `components/` → Affects **React**
   - `tests/**`, `*.test.js` → Affects **Testing**
4. **Immutable Revision Model**: A new revision document is persisted (`revisionNumber: previous + 1`). Prior revisions remain preserved with timestamp and triggering commit SHA.
5. **Real-Time Push**: `ChangeEvent` and `Assessment` updates are broadcast via Server-Sent Events (`/api/activity/stream`) to immediately update active client dashboards without page refreshes.

---

## 5. Scoring Model

Coverage calculation is completely deterministic and reproducible:

$$\text{Coverage Score} = \left\lfloor \frac{\sum (\text{Skill Weight} \times \text{Evidence Score})}{\sum \text{Skill Weight}} \times 100 \right\rfloor$$

- **Weights**:
  - Required job requirement: $2.0$
  - Preferred job requirement: $1.0$
- **Evidence Multipliers**:
  - Demonstrated: $1.0$
  - Partially Demonstrated: $0.5$
  - Not Demonstrated: $0.0$
