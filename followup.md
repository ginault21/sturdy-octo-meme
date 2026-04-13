# Follow-up Items - Post Audit

This document tracks assumptions, dependencies, and deferred work identified during the Phase A implementation. Items here require clarification or additional setup before proceeding.

---

## Strategic Decision: Work Sequence

**Decision Date:** After Phase 2 completion

### Agreement: Complete roadmap.md BEFORE finishing audit.md phases

**Rationale:**

The audit phases (3-6 in audit.md) are designed to assess and verify a **completed foundation**. However, the codebase is still in active development via roadmap.md phases. Auditing security, CI/CD, and governance of incomplete features would generate findings on code that's still changing.

**Revised Order:**

1. ✅ **Phase 0-2 (Audit)** - Architecture, Code Quality, Testing (DONE)
2. 🔄 **roadmap.md execution** - Complete all implementation phases to reach "feature-ready" state
3. ⏳ **Phase 3-6 (Audit)** - Security, CI/CD, Governance, Gap Analysis (RESUMED after roadmap.md)
4. ⏳ **First commit/push** - With clean, audited, complete codebase

**Why this is better:**

- Audit findings will be on **stable, complete code** (not moving targets)
- Security audit (Phase 3) will assess actual feature implementations, not scaffolding
- CI/CD audit (Phase 4) will validate working pipeline against real test coverage
- Gap analysis (Phase 6) will be meaningful for production readiness

**Current Status of Audit.md:**

| Phase                 | Status      | When to Resume   |
| --------------------- | ----------- | ---------------- |
| Phase 0: Architecture | ✅ Complete | -                |
| Phase 1: Code Quality | ✅ Complete | -                |
| Phase 2: Testing      | ✅ Complete | -                |
| Phase 3: Security     | ⏸️ PAUSED   | After roadmap.md |
| Phase 4: CI/CD        | ⏸️ PAUSED   | After roadmap.md |
| Phase 5: Governance   | ⏸️ PAUSED   | After roadmap.md |
| Phase 6: Gap Analysis | ⏸️ PAUSED   | After roadmap.md |

---

## Decisions Made (User Answers)

### Remote Repository

- **GitHub repository?** Not yet
- **When to push?** After finishing roadmap.md
- **Remove .github/workflows/?** Yes (DONE - directory removed)

### Local Tooling

- **Pre-commit hooks?** Absolutely (DONE - husky + lint-staged installed and configured)

---

## Assumptions Made During Phase A (Now Documented)

### 1. Remote Repository Existence ✓ RESOLVED

**Status:** `.github/` directory removed as requested. Will recreate after roadmap.md is complete.

### 2. Branch Structure ✓ RESOLVED

**Decision:** Defer until remote setup

### 3. CI/CD Platform ✓ RESOLVED

**Decision:** Defer CI decision until after roadmap.md

### 4. Commit and Push Workflow ✓ RESOLVED

**Decision:** First commit will happen after roadmap.md completion

---

## Completed Actions

### ✅ Pre-commit Hooks (DONE)

- Installed: `husky` and `lint-staged`
- Configured: `.husky/pre-commit` runs lint-staged
- Package.json: Added `lint-staged` configuration
- Behavior: On every commit, runs `eslint --fix` and `npm run typecheck`

### ✅ GitHub Workflows (REMOVED)

- Removed `.github/workflows/ci.yml`
- Removed entire `.github/` directory
- Will recreate after roadmap.md + remote setup

---

## Phase 2 - Testing Infrastructure CI/CD Assumptions

**Status:** CI workflow created but deferred until after roadmap.md  
**File:** `.github/workflows/ci.yml` (currently in repo, will activate on remote setup)

### Assumptions Made

When the CI workflow was created during Phase 2, the following assumptions were made:

#### 1. Platform: GitHub Actions

- **Assumed:** Repository will be hosted on GitHub
- **Impact:** Workflow uses GitHub Actions syntax (`actions/checkout@v4`, etc.)
- **Alternative needed if:** Using GitLab, Bitbucket, or other platform

#### 2. Branch Names

- **Assumed:** Default branch is `main` or `master`
- **Configuration:**
  ```yaml
  on:
    push:
      branches: [main, master]
    pull_request:
      branches: [main, master]
  ```
- **Change needed if:** Using different branch names (e.g., `develop`)

#### 3. Node.js Version

- **Assumed:** Node.js 20
- **Configuration:**
  ```yaml
  node-version: '20'
  ```
- **Validation:** Matches `package.json` engines requirement

#### 4. External Services

**Codecov (Coverage Reporting)**

- **Used:** `codecov/codecov-action@v4`
- **Behavior:** Fails silently if not configured (`fail_ci_if_error: false`)
- **Setup required:** Sign up at codecov.io (free for public repos)
- **Optional:** Can remove this step if not wanted

**Playwright Browsers**

- **Installed on-demand:** `npx playwright install --with-deps chromium`
- **Assumed:** E2E tests can run in headless CI environment

#### 5. Environment Variables

**E2E Testing**

```yaml
env:
  E2E_BASE_URL: http://localhost:3000
```

- **Assumed:** App listens on port 3000
- **May need adjustment** based on actual deployment setup

#### 6. Job Dependencies

**Sequential Jobs:**

1. `test` job runs first (lint, typecheck, unit tests, coverage)
2. `e2e` job depends on `test` (`needs: test`)

- **Rationale:** Don't run expensive E2E tests if unit tests fail

### What to Revisit When Setting Up Remote

**Before pushing to GitHub:**

1. Verify branch names match workflow triggers
2. Decide: Keep or remove Codecov integration
3. Verify E2E tests work locally: `npm run test:e2e`
4. Confirm Node 20 is appropriate (check hosting platform)

**After pushing:**

1. Check Actions tab for workflow runs
2. Verify all jobs pass
3. Optionally enable branch protection requiring CI pass

### Alternative CI Platforms

If **not** using GitHub, the workflow will need to be rewritten:

| Platform  | File Location             | Notes                              |
| --------- | ------------------------- | ---------------------------------- |
| GitLab    | `.gitlab-ci.yml`          | Different syntax, similar concepts |
| Bitbucket | `bitbucket-pipelines.yml` | Different syntax                   |
| CircleCI  | `.circleci/config.yml`    | Different syntax                   |
| Travis CI | `.travis.yml`             | Different syntax                   |

---

## Deferred Work Items

### Phase B - Secret Scanning & Dependency Auditing (DEFERRED)

**Status:** Blocked on repository setup decisions
**Timeline:** After roadmap.md completion
**Items:**

- [ ] Add `.gitleaks.toml` configuration for secret scanning
- [ ] Add dependency audit workflow (`npm audit` in CI)
- [ ] Evaluate need for encryption key rotation (`.env` contains real key)

**Dependencies:**

- roadmap.md completion
- Remote repository setup
- Decision on CI platform (GitHub Actions vs alternatives)

---

### Phase C - Security Hardening (DEFERRED)

**Status:** Blocked on CI setup
**Timeline:** After remote setup
**Items:**

- [ ] Add CSP headers configuration
- [ ] Add CodeQL or Semgrep security scanning
- [ ] Audit all routes for proper auth enforcement

---

### Phase D - Design Governance (DEFERRED)

**Status:** Lower priority, can be done anytime
**Timeline:** After remote setup
**Items:**

- [ ] Create PR template (`.github/pull_request_template.md`)
- [ ] Create ADR (Architecture Decision Records) process
- [ ] Add issue templates

---

## When to Revisit This Document

**Trigger:** Completion of roadmap.md

**Then:**

1. Create remote repository
2. Re-add `.github/workflows/ci.yml`
3. Proceed with Phase B (secret scanning, dependency audit)

---

## Phase 4 - Job Engine (COMPLETE)

**Completed:** April 12, 2026

**Deliverables:**

| Component            | File                                      | Description                                       |
| -------------------- | ----------------------------------------- | ------------------------------------------------- |
| Token Expiry Error   | `app/schemas/errors.ts`                   | `TokenExpiredError` for 401 responses             |
| 401 Detection        | `app/lib/shopify/client.server.ts`        | Detects 401s, throws typed error                  |
| Job Types            | `app/lib/jobs/types.server.ts`            | `JobContext`, `JobExecutor`, `ChangeLogEntry`     |
| ChangeLog Buffer     | `app/lib/jobs/changelog-buffer.server.ts` | Batches inserts (500 per batch)                   |
| Job Runner           | `app/lib/jobs/runner.server.ts`           | `runJob()` orchestrator with lock/quota/execution |
| State Machine Update | `app/schemas/job.ts`                      | Added `queued → failed` transition                |

**Architecture Decisions:**

1. **No `partial` status** - Use `succeeded` with `JobSummary.failed > 0` for partial completions
2. **Simple executor pattern** - `(ctx: JobContext) => Promise<JobSummary>`
3. **Buffered changelogs** - Fire-and-forget `logChange()`, auto-flush at end
4. **Pre-execution failures** - Quota/lock failures transition `queued → failed` (new transition)
5. **Token expiry handling** - Caught in runner, job fails with merchant-friendly message

**Test Coverage:**

- Unit: ChangeLog buffer batching (5 tests)
- Unit: State transitions (1 new test)
- Integration: Full job lifecycle (7 tests)
- **Total: 143 tests passing** (+13 from Phase 4)

---

## Current State Summary

**What's Working Now (Local Only):**

- ✅ ESLint passes (0 errors)
- ✅ TypeScript typecheck passes
- ✅ All 143 tests pass
- ✅ Pre-commit hooks active (husky + lint-staged)
- ✅ `.github/` directory removed (will recreate later)
- ✅ Job engine ready for wizard implementation

**Completed Phases:**

| Phase                        | Status | Tests |
| ---------------------------- | ------ | ----- |
| Phase 0: Test Infrastructure | ✅     | 2     |
| Phase 1: Database            | ✅     | 106   |
| Phase 2: Server Utilities    | ✅     | 122   |
| Phase 3: OAuth               | ✅     | 127   |
| Phase 4: Job Engine          | ✅     | 143   |

**Next:** Phase 5 - Price Wizard

**What's Blocked:**

- ⏳ CI/CD (waiting for roadmap.md + remote setup)
- ⏳ Secret scanning (waiting for remote)
- ⏳ Dependency auditing (waiting for CI)
- ⏳ Automated security scanning (waiting for CI)

---

_Last updated: After Phase 4 completion_
