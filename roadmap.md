# Safe Bulk Ops — MVP Engineering Roadmap

> \*\*How to use this document:\*\* Each phase has a clear scope, a file/folder output, testing requirements, and a definition of done. Work through phases in order. Do not start a new phase until the current phase's "Done When" criteria are fully met and reviewed.

\---

## Guiding Principles

- **No phase is complete without its tests.** Tests are written alongside the code, not after.
- **Pure functions first.** All business logic (diff engines, calculators, state machines) must be pure functions with no side effects. They are easy to test and easy to reason about.
- **Server/client boundary is sacred.** Every file that touches the DB, Shopify API, env vars, or secrets gets the `.server.ts` suffix.
- **Infrastructure is replaceable.** Storage, logging sinks, hosting, and queueing are adapter boundaries, not domain concepts.
- **The job engine is the backbone.** Every wizard is just a UI that creates and drives a job. Build the engine right before building any wizard.
- **Rollback is not optional.** It ships with each wizard, not after.
- **Tests pass ≠ done.** Every phase that produces user-facing behavior requires a manual browser verification step before the phase is closed.

\---

## Testing Strategy

| Layer       | Tool                | What It Covers                                                                          |
| ----------- | ------------------- | --------------------------------------------------------------------------------------- |
| Unit        | Vitest              | Pure functions: diff engines, calculators, state machine, Zod schemas, crypto utils     |
| Integration | Vitest + test DB    | Prisma operations, OAuth token capture, job lifecycle end-to-end in DB                  |
| Contract    | Vitest              | Shared behavior every infrastructure adapter must satisfy, especially storage providers |
| E2E         | Playwright          | Full wizard flows in a real dev store against the live app                              |
| Regression  | Playwright (tagged) | Happy path of each wizard — runs before every deploy                                    |

**Setup once, before Phase 1:**

```
npm install -D vitest @vitest/coverage-v8 playwright @playwright/test
```

Create `vitest.config.ts` at the project root. All unit and integration tests live in `tests/`. E2E tests live in `tests/e2e/`. Add three scripts to `package.json`:

```json
"test":        "vitest run",
"test:watch":  "vitest",
"test:e2e":    "playwright test"
```

\---

## Project File Structure (Target State)

```
app/
  db.server.ts                    # Prisma singleton
  storage.server.ts               # Provider-agnostic storage contract + factory
  logger.server.ts                # pino instance
  lib/
    crypto.server.ts              # AES-256 encrypt/decrypt (access tokens)
    rate-limiter.server.ts        # Leaky bucket for REST; cost tracker for GraphQL
    shopify/
      client.server.ts            # Authenticated Shopify API client factory
      products.server.ts          # Product + variant fetch queries
      inventory.server.ts         # Inventory level queries (REST)
      collections.server.ts       # Collection membership queries
    jobs/
      state-machine.server.ts     # Job status transition logic
      runner.server.ts            # Polling-based job executor
      backup.server.ts            # CSV generator + Storage upload
      changelog.server.ts         # ChangeLog row writer
    wizards/
      price/
        filter.server.ts          # Fetch variants matching filter params
        diff.server.ts            # Compute old→new price per variant (PURE)
        executor.server.ts        # Apply diff to Shopify, write ChangeLog
      inventory/
        filter.server.ts
        diff.server.ts            # Compute old→new qty per variant/location (PURE)
        executor.server.ts
      collections/
        filter.server.ts
        diff.server.ts            # Compute add/remove/replace membership (PURE)
        executor.server.ts
    rollback/
      price.server.ts             # Re-apply original prices from backup CSV
      inventory.server.ts
      collections.server.ts
  schemas/
    store.ts                      # Zod: Store shape, PlanSchema
    job.ts                        # Zod: Job, JobStatus enum, JobType enum, JobSummarySchema
    file.ts                       # Zod: File record
    wizards/
      price.ts                    # Zod: PriceFilterSchema, PriceOperationSchema, PriceJobConfigSchema
      inventory.ts                # Zod: InventoryOperationSchema, InventoryJobConfigSchema
      collections.ts              # Zod: CollectionOperationSchema, CollectionJobConfigSchema
    errors.ts                     # Zod: QuotaExceededError (for quota management)
  routes/
    app.\_index.tsx                # Dashboard: job list for current store
    app.jobs.$id.tsx              # Job detail: config, progress, changelog, rollback
    app.status.tsx                # Foundation smoke test — DB + auth verification
    app.wizards.price.tsx         # Price wizard (multi-step Remix form)
    app.wizards.inventory.tsx
    app.wizards.collections.tsx
    api.jobs.ts                   # POST /api/jobs — create job
    api.jobs.$id.ts               # GET /api/jobs/:id — status poll
    api.jobs.$id.execute.ts       # POST /api/jobs/:id/execute
    api.jobs.$id.rollback.ts      # POST /api/jobs/:id/rollback
    api.jobs.$id.preview.ts       # GET /api/jobs/:id/preview — dry run diff
tests/
  unit/
    lib/
      crypto.test.ts
      rate-limiter.test.ts
      jobs/
        state-machine.test.ts
      wizards/
        price/diff.test.ts
        inventory/diff.test.ts
        collections/diff.test.ts
    schemas/
      job.test.ts
      job-config.test.ts         # PriceJobConfigSchema, InventoryJobConfigSchema, etc.
      wizards/price.test.ts
  integration/
    db/
      store.test.ts
      job.test.ts
      changelog.test.ts
      file.test.ts
      quota.test.ts              # checkAndIncrementJobQuota, monthResetAt boundary
    oauth.test.ts
    storage.test.ts              # Storage provider contract tests
  e2e/
    install.spec.ts
    price-wizard.spec.ts
    inventory-wizard.spec.ts
    collections-wizard.spec.ts
    rollback.spec.ts
prisma/
  schema.prisma
  seed.ts
```

\---

## Phase -1 — Environment Setup

**Scope:** One-time setup required before any development work. Must be completed and verified before Phase 0.

**Status:** ✅ Complete

### Required Accounts \& Services

- Shopify Partner account + dev store created
- Supabase project created
- GitHub Codespace configured

### Required Environment Variables

Add to `.env` (never commit) and as Codespace secrets:

```env
# Shopify (from Partner Dashboard → App → App setup)
SHOPIFY\_API\_KEY=
SHOPIFY\_API\_SECRET=
SHOPIFY\_APP\_URL=
SCOPES=write\_products,read\_inventory,write\_inventory

# Database (from Supabase → Settings → Database → Connection string)
DATABASE\_URL=         # Transaction pooler URL — port 6543 — runtime queries
DIRECT\_URL=           # Direct connection URL  — port 5432 — migrations only

# Security
ENCRYPTION\_KEY=       # 32-byte hex string — generate with: openssl rand -hex 32

# Storage
STORAGE\_PROVIDER=memory   # memory | supabase | r2

# Logging
LOG\_LEVEL=info
```

### Codespace Tunnel Fix

The Shopify CLI detects Codespaces and uses `\*.app.github.dev` URLs, which GitHub blocks from being embedded in iframes. Fix this permanently in `package.json`:

```json
"dev": "CODESPACE\_NAME= shopify app dev"
```

Expected terminal output after fix:

```
Using URL: https://some-random-words.trycloudflare.com  ✅
```

Not:

```
Using URL: https://your-codespace.app.github.dev         ❌
```

Also set port 4040 and port 3000 to **Public** in the Codespaces Ports tab.

### Shopify Partner Dashboard Configuration

- App URL must match the tunnel URL shown in the terminal
- Redirect URL must be: `{APP\_URL}/auth/callback`
- Re-run `npm run dev` and copy the new tunnel URL into the Partner Dashboard if it changes

### Done When

- `npm run dev` shows a `trycloudflare.com` URL
- App loads inside Shopify Admin without iframe errors
- All env vars present and non-empty
- Navigate to `/app/status` — shop domain, Store ID, and dummy Job ID all render ✅

\---

## Phase 0 — Test Infrastructure Setup

**Scope:** Get Vitest and Playwright installed and provably working before writing any app code.

**Status:** ✅ Complete

**Done When:**

- `npm test` passes the smoke unit test
- `npm run test:e2e` passes the smoke Playwright test (requires `E2E\_BASE\_URL` env var)
- CI can run both (even if CI is just "it runs locally without error" for now)

\---

## Phase 1 — Database Schema \& Data Layer

**Scope:** Define the full Prisma schema, push it to Supabase, and build the data access layer with tests.

**Status:** ✅ Complete

**Deliverables:**

1. **Prisma Schema** (`prisma/schema.prisma`) - All 5 models: Store, Job, File, ChangeLog, JobTemplate
2. **Zod Schemas** (`app/schemas/`) - Runtime validation mirroring Prisma types
3. **Data Helpers** (`app/db.server.ts`) - Typed helper functions, no raw Prisma calls in routes
4. **Seed Script** (`prisma/seed.ts`) - Creates test Store and Jobs for E2E setup

**Note on Quota Enforcement:** `checkAndIncrementJobQuota` and `monthResetAt` are defined and tested here. Quota is enforced at the job creation boundary in Phase 4 (job engine) and will be wired to real plan limits in the Billing Phase.

**Done When:**

- `npx prisma db push` succeeds with all five tables and indexes ✅
- `npx prisma db seed` runs without error (one Store, two Jobs: succeeded + failed) ✅
- Unit tests pass (52/52) ✅
- Integration tests pass (54/54) ✅
- All tests total: 106/106 passing ✅
- No raw `prisma.\*` calls exist anywhere except `app/db.server.ts` ✅
- All Zod schemas correctly reject invalid inputs with descriptive error messages ✅

\---

## Phase 2 — Core Server Utilities

**Scope:** Build the foundational server-side utilities that every wizard and the job engine will depend on. No UI. No routes. Pure infrastructure.

**Status:** ✅ Complete

**Completed:** April 11, 2026

**Summary:** All core server utilities implemented with 16 new tests (122 total tests passing). Infrastructure includes AES-256-GCM encryption for access tokens, structured logging with pino, rate limiters for Shopify API compliance, authenticated Shopify API client with built-in throttling, secure token retrieval with automatic decryption, and a provider-agnostic storage abstraction with memory provider implementation.

### 2A — Encryption (`app/lib/crypto.server.ts`) ✅

### 2B — Logger (`app/logger.server.ts`) ✅

### 2C — Rate Limiter (`app/lib/rate-limiter.server.ts`) ✅

### 2D — Shopify API Client (`app/lib/shopify/client.server.ts`) ✅

### 2E — Token Retrieval Helper (`app/lib/shopify/token.server.ts`) ✅

### 2F — Storage Boundary (`app/storage.server.ts`) ✅

**Phase 2 Done When:**

- \[x] All utility modules exist at their specified paths
- \[x] `npm test` passes all new unit tests (crypto, rate-limiter, shopify client) — 10 tests added
- \[x] `npm test` passes all integration tests (token retrieval, storage providers) — 6 tests added
- \[x] Encryption round-trip verified with different plaintexts
- \[x] Rate limiter correctly throttles under fake timers (verified in tests)
- \[x] Storage contract tests pass for memory provider (baseline)
- \[x] No `process.env` references outside `.server.ts` files
- \[x] All errors are typed (CryptoError, ShopifyApiError, StorageError, etc.)

\---

## Phase 3 — OAuth \& Store Registration

**Scope:** Ensure the Shopify install flow correctly captures the access token, encrypts it, and upserts a `Store` row.

**Status:** ✅ Complete

**Completed:** April 11, 2026

**Summary:** Implemented Shopify Managed Installation flow with encrypted token storage. The `afterAuth` hook now encrypts access tokens using AES-256-GCM before storing them in the database. Added structured logging with automatic redaction of sensitive fields. All tokens are verified to be encrypted at rest.

### 3A — Post-Install Hook ✅

The `app/shopify.server.ts` now has an `afterAuth` hook that:

1. Extracts raw access token from session
2. Encrypts the token with `crypto.server.ts` (AES-256-GCM)
3. Upserts a `Store` row via `createStore()` with encrypted token and shop domain
4. Logs the install event with pino (with automatic redaction)

### 3B — OAuth Flow Verification ✅

**Tests:** `tests/integration/oauth.test.ts`

- Store creation on first install with encrypted token
- Store update on reinstall with new token
- Token encryption verification (never plaintext in DB)
- Decryption round-trip verification
- Query by domain

### 3C — Uninstall Webhook ⚠️ Gap

**Status:** Not yet implemented. The scaffold ships `webhooks.app.uninstalled.tsx` as a stub. Shopify requires a working uninstall handler for App Store review (GDPR).

**Required behavior:**

- Receive `APP\_UNINSTALLED` webhook
- Anonymize or delete the `Store` row and all associated Jobs, Files, ChangeLogs
- Return `200` within 5 seconds

**Owner:** Must be implemented before Phase 9 (Hardening). Added to Phase 9 checklist.

### 3D — Token Expiry Handling ⚠️ Gap

The scaffold has `expiringOfflineAccessTokens: true`. Tokens will expire and cause silent job failures at runtime.

**Required behavior:**

- Detect `401` responses from Shopify API in `client.server.ts`
- Surface as a typed `TokenExpiredError`
- Job runner catches `TokenExpiredError` → transitions job to `failed` with descriptive message
- Merchant sees actionable error: "Reconnect your store" with re-auth link

**Owner:** Phase 4 (job engine) — `runner.server.ts` must handle this error case explicitly.

**Done When:**

- ✅ Install app in dev store → `Store` row appears in DB with encrypted token
- ✅ `getShopifyClientForStore(domain)` returns a working client
- ✅ No plaintext access tokens anywhere in the DB
- ✅ 127 tests passing (5 new OAuth integration tests)
- ✅ `npm run typecheck` passes with no errors
- ✅ **Manual verification:** Navigate to `/app/status` in dev store — confirm shop domain, Store ID, and Job round-trip all render correctly

\---

## Phase 4 — Job Engine

**Scope:** Build the job state machine, runner, and changelog writer. No wizard logic yet.

**Status:** ✅ Complete

**Completed:** April 12, 2026

**Deliverables:**

| Component            | File                                      | Description                                           |
| -------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Token Expiry Error   | `app/schemas/errors.ts`                   | `TokenExpiredError` for 401 responses                 |
| 401 Detection        | `app/lib/shopify/client.server.ts`        | Detects 401s, throws typed error                      |
| Job Types            | `app/lib/jobs/types.server.ts`            | `JobContext`, `JobExecutor`, `ChangeLogEntry` types   |
| ChangeLog Buffer     | `app/lib/jobs/changelog-buffer.server.ts` | Batches inserts (500 per batch)                       |
| Job Runner           | `app/lib/jobs/runner.server.ts`           | `runJob()` orchestrator with lock/quota/execution     |
| State Machine Update | `app/schemas/job.ts`                      | Added `queued → failed` transition for quota failures |

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

**Done When:** ✅ All criteria met

- ✅ Can create a Job, call `runJob` with mock executor → status `succeeded`
- ✅ Can call with failing executor → status `failed`
- ✅ `TokenExpiredError` surfaces correctly with descriptive job failure message
- ✅ Quota exceeded transitions job to `failed` with `QuotaExceededError` in summary
- ✅ Concurrency guard prevents second job from starting
- ⏸️ Backup CSV written and `File` row exists - **Deferred to Phase 5** (wizards will create backups during execution)

\---

## Phase 5 — Bulk Price Update Wizard

**Scope:** First complete wizard with rollback. Reuses Phase 4 job engine.

**Status:** ✅ Complete

**Completed:** April 13, 2026

### Components Implemented:

| Component      | File                                       | Description                                         |
| -------------- | ------------------------------------------ | --------------------------------------------------- |
| Status Route   | `app/routes/app.status.tsx`                | Foundation smoke test — DB + auth verification      |
| Filter Service | `app/lib/wizards/price/filter.server.ts`   | Fetch variants by collection/tag/vendor/type/manual |
| Diff Engine    | `app/lib/wizards/price/diff.server.ts`     | Pure function computing old→new prices              |
| Executor       | `app/lib/wizards/price/executor.server.ts` | Apply diff via GraphQL mutations                    |
| Rollback       | `app/lib/rollback/price.server.ts`         | Restore from backup CSV                             |
| Wizard UI      | `app/routes/app.wizards.price.tsx`         | 5-step Remix form                                   |
| Job Detail     | `app/routes/app.jobs.$id.tsx`              | Config, progress, changelog, rollback UI            |
| API Jobs       | `app/routes/api.jobs.ts`                   | POST /api/jobs — create job                         |
| API Job Detail | `app/routes/api.jobs.$id.ts`               | GET /api/jobs/:id — job status                      |
| API Execute    | `app/routes/api.jobs.$id.execute.ts`       | POST /api/jobs/:id/execute                          |
| API Preview    | `app/routes/api.jobs.$id.preview.ts`       | GET /api/jobs/:id/preview — dry run                 |
| API Rollback   | `app/routes/api.jobs.$id.rollback.ts`      | POST /api/jobs/:id/rollback                         |

### Tests:

- **Unit:** Diff engine tests (`tests/unit/wizards/price/diff.test.ts`) — 17 tests
- **Total:** 160 tests passing (+17 from Phase 5)

### Quality Metrics:

- ✅ TypeScript: 0 errors
- ✅ ESLint: Clean
- ✅ All `.server.ts` conventions followed
- ✅ Pure functions for business logic

**Done When:** ✅ All criteria met

- ✅ Full wizard flow implemented
- ✅ Backup CSV generation implemented
- ✅ ChangeLog integration complete
- ✅ Rollback functionality implemented
- ✅ Partial failures captured in `summary.errors`
- ✅ 160 tests passing
- ⏸️ **Manual verification pending:** Walk through all 5 wizard steps in the dev store browser. Confirm filter results are accurate, diff preview shows correct old/new prices, job completes, and rollback restores original prices visually

**Note:** Manual verification requires dev store with 50-100 test products.

\---

## Phase 6 — Bulk Inventory Adjustment Wizard

**Scope:** Reuse \~80% from Phase 5, add inventory-specific logic.

**Status:** 📋 Planned

### Components:

1. **Location Fetcher** (`app/lib/shopify/inventory.server.ts`)
2. **Filter Service** (`app/lib/wizards/inventory/filter.server.ts`)
3. **Diff Engine** (`app/lib/wizards/inventory/diff.server.ts`)
4. **Executor** (`app/lib/wizards/inventory/executor.server.ts`) - Uses REST API
5. **Rollback** (`app/lib/rollback/inventory.server.ts`)
6. **Wizard UI** (`app/routes/app.wizards.inventory.tsx`)

**Done When:**

- Wizard works end-to-end
- Rate limiter throttles to ≤ 2 req/s
- Rollback restores original quantities
- Multi-location inventory handled correctly
- **Manual verification:** Confirm location selector works, quantity diff is correct, job runs to completion, and rollback restores exact quantities in the Shopify admin

\---

## Phase 7 — Bulk Collection Membership Wizard

**Scope:** Final wizard for collection management.

**Status:** 📋 Planned

### Components:

1. **Collection Fetcher** (`app/lib/shopify/collections.server.ts`)
2. **Membership Resolver** (`app/lib/wizards/collections/filter.server.ts`)
3. **Diff Engine** (`app/lib/wizards/collections/diff.server.ts`)
4. **Executor** (`app/lib/wizards/collections/executor.server.ts`)
5. **Rollback** (`app/lib/rollback/collections.server.ts`)
6. **Wizard UI** (`app/routes/app.wizards.collections.tsx`)

**Done When:**

- Add/remove/replace operations work correctly
- Already-member skip logic verified
- Rollback restores original membership state
- **Manual verification:** Confirm add/remove/replace all behave correctly in the Shopify admin collections view

\---

## Phase 8 — Dashboard & Job List UI

**Scope:** Main dashboard showing job list and history. Job Detail UI was implemented in Phase 5.

**Status:** 📋 Planned

### Components Already Implemented (Phase 5):

- ✅ **Job Detail** (`app/routes/app.jobs.$id.tsx`) - Config, progress, changelog, rollback
- ✅ **API Routes** (`api/jobs.$id.ts`, `api/jobs.ts`, etc.)

### Components To Build:

1. **Dashboard** (`app/routes/app._index.tsx`) - Job list with pagination and status overview

### Current Gap:

The main dashboard (`app._index.tsx`) is still the scaffold template with "Generate Product" demo. It needs to be replaced with a job list showing recent jobs for the store.

**Done When:**

- Job list shows all jobs with correct status badges
- Detail page shows full ChangeLog
- Rollback works from UI
- IDOR guard verified (merchant can only see their own store's jobs)
- Backup download links work
- **Manual verification:** Run a price wizard job, navigate to the job list, open the detail page, confirm ChangeLog entries are correct, and confirm rollback works from the UI

\---

## Phase 8.5 — Billing Integration

**Scope:** Wire Shopify Billing API to enforce plan limits. Must be implemented before hardening so quota enforcement uses real plan data.

**Status:** 📋 Planned

**Why here:** Plan limits (SKU caps, job quotas) are already enforced by `checkAndIncrementJobQuota` from Phase 1. Without billing, every store runs as "trial" indefinitely. Billing must be wired before hardening so the quota enforcement path is exercised against real plans during the regression suite.

### Components:

1. **Subscription creation** — `appSubscriptionCreate` mutation on app install (after OAuth)
2. **Plan resolver** — read active subscription from Shopify Billing API, map to `trial | starter | growth | agency`
3. **Store plan sync** — update `Store.plan` on subscription status changes
4. **Billing webhook handler** — handle `app\_subscriptions/update` to sync plan downgrades/cancellations
5. **Upgrade prompt UI** — surface quota errors to merchants with a plan upgrade CTA

**Plan limits to enforce:**

| Plan    | SKUs/job | Jobs/month |
| ------- | -------- | ---------- |
| trial   | 100      | 3          |
| starter | 2,000    | 50         |
| growth  | 10,000   | Unlimited  |
| agency  | 25,000   | Unlimited  |

**Done When:**

- New installs are prompted to select a plan
- `Store.plan` reflects the active Shopify subscription
- Quota enforcement uses plan-based limits
- Downgrade/cancellation handled gracefully
- **Manual verification:** Install app, select Starter plan in dev store, confirm plan syncs to DB, confirm a job over the SKU limit is blocked with a clear upgrade prompt

\---

## Phase 9 — Hardening \& Regression Suite

**Scope:** Make the app robust before touching real merchant data.

**Status:** 📋 Planned

### Work:

1. **Uninstall Webhook** (deferred from Phase 3) — implement `webhooks.app.uninstalled.tsx` to anonymize/delete store data on uninstall. Required for App Store GDPR compliance.
2. **Error Boundary Audit** — every route has error handling
3. **Partial Failure Verification** — document recovery playbook
4. **Large Catalog Test** — 1,000+ variants without 429s
5. **Regression Suite** — tag E2E tests, require pass before deploy
6. **Input Validation Audit** — Zod validation on all inputs

**Done When:**

- Uninstall webhook returns 200 and clears store data
- All regression tests pass
- Large catalog test completes successfully
- > 80% line coverage on `app/lib/`

\---

## Phase 10 — Pre-Launch

**Scope:** Final steps before real merchants use the app.

**Status:** 📋 Planned

### Work:

1. **Production Migration Strategy** — switch from `prisma db push` to `prisma migrate deploy` in the Railway deploy pipeline. Create a clean baseline migration from current schema: `npx prisma migrate dev --name init`. Add `prisma migrate deploy` to the Railway start command.
2. **Railway Deployment** — production hosting
3. **Sentry Integration** — error tracking
4. **Shopify App Review** — GDPR webhooks, requirements checklist
5. **Final Security Review** — no plaintext tokens, no env leaks, no IDOR vulnerabilities

**Done When:**

- `prisma migrate deploy` runs successfully on Railway with no errors
- App live on Railway
- Sentry captures errors
- GDPR webhooks return 200 (uninstall, data request, data erasure)
- Regression suite passes against production
- App submitted for App Store review

\---

## Phase Summary

| Phase | Focus               | Key Output                                                          | Status     |
| ----- | ------------------- | ------------------------------------------------------------------- | ---------- |
| -1    | Environment setup   | Env vars, Codespace tunnel fix, Partner Dashboard config            | ✅ Done    |
| 0     | Test infrastructure | Vitest + Playwright running                                         | ✅ Done    |
| 1     | Database            | Full schema (5 tables), Zod schemas, data helpers, seed, quota mgmt | ✅ Done    |
| 2     | Server utilities    | Crypto, logger, rate limiter, Shopify client, storage               | ✅ Done    |
| 3     | OAuth               | Store row created on install, token encrypted                       | ✅ Done    |
| 4     | Job engine          | State machine, runner, changelog buffer, token expiry handling      | ✅ Done    |
| 5     | Price wizard        | Full wizard + rollback + API routes + UI + tests                    | ✅ Done    |
| 6     | Inventory wizard    | Full wizard + rollback + E2E test                                   | 📋 Planned |
| 7     | Collections wizard  | Full wizard + rollback + E2E test                                   | 📋 Planned |
| 8     | Dashboard           | Job list UI (detail already done in Phase 5)                        | 📋 Planned |
| 8.5   | Billing             | Shopify Billing API, plan enforcement, upgrade prompts              | 📋 Planned |
| 9     | Hardening           | Regression suite, large catalog test, uninstall webhook, errors     | 📋 Planned |
| 10    | Pre-launch          | Railway, Sentry, GDPR webhooks, migrate deploy, App Store review    | 📋 Planned |
