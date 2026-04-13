# Safe Bulk Ops — Manual Verification Checklist

> **Purpose:** Track what's manually verifiable now vs. what requires agent implementation in Phase 5.
> **Created:** April 13, 2026
> **Current Phase:** 4 Complete → 5 (Price Wizard) In Progress

---

## Current State Summary

| Phase | Focus                        | Status     | Tests |
| ----- | ---------------------------- | ---------- | ----- |
| -1    | Environment setup            | ✅ Done    | -     |
| 0     | Test infrastructure          | ✅ Done    | 2     |
| 1     | Database schema & data layer | ✅ Done    | 106   |
| 2     | Core server utilities        | ✅ Done    | 122   |
| 3     | OAuth & Store registration   | ✅ Done    | 127   |
| 4     | Job engine                   | ✅ Done    | 143   |
| 5     | Price Wizard                 | 🔄 Current | -     |

---

## ✅ What You Can Manually Verify Now

### 1. Environment Setup Verification

**Command:**

```bash
npm run dev
```

**Expected Output:**

```
Using URL: https://some-random-words.trycloudflare.com  ✅
```

**NOT:**

```
Using URL: https://your-codespace.app.github.dev         ❌
```

**If wrong:** Check `package.json` has `"dev": "CODESPACE_NAME= shopify app dev"`

**Manual Check:**

- [ ] App loads inside Shopify Admin without iframe errors
- [ ] Port 4040 and 3000 are set to **Public** in Codespaces Ports tab
- [ ] App URL in Partner Dashboard matches the tunnel URL
- [ ] Redirect URL is `{APP_URL}/auth/callback`

---

### 2. Install Flow Verification

**Steps:**

1. Uninstall app from dev store (if previously installed)
2. Reinstall via Partner Dashboard "Test your app"
3. Complete OAuth flow

**Verification:**

```bash
# Check database
npx prisma studio
# Navigate to Store table
```

**Expected:**

- [ ] New row appears in `Store` table
- [ ] `shopDomain` matches your dev store (e.g., `your-store.myshopify.com`)
- [ ] `accessToken` is **encrypted** (long hex string, not plaintext)
- [ ] `plan` is set to `"trial"`
- [ ] `installedAt` timestamp is recent

**Security Check:**

- [ ] No plaintext tokens anywhere in the DB
- [ ] Token cannot be decoded by eye (should be AES-256-GCM encrypted)

---

### 3. Database Layer Verification

**Commands:**

```bash
npm run setup        # Should complete without errors
npx prisma db seed   # Creates test data
```

**Expected Output:**

```
🌱  Seeding database...
✅  Created test store: quickstart-12345678.myshopify.com
✅  Created succeeded job: cld123...
✅  Created failed job: cld456...
```

**Verification in Prisma Studio:**

- [ ] `Session` table: Standard Shopify session row exists
- [ ] `Store` table: At least 1 row (your dev store)
- [ ] `Job` table: 2 rows (1 succeeded, 1 failed from seed)
- [ ] `File` table: Empty or has test file references
- [ ] `ChangeLog` table: May have test entries
- [ ] `JobTemplate` table: Empty (not yet implemented)

**Quota System Check:**

```typescript
// In Prisma Studio, check Store row:
jobsThisMonth: 0
monthResetAt: null (or future date)
```

---

### 4. Test Suite Verification

**Commands:**

```bash
npm test              # All unit + integration tests
npm run typecheck     # TypeScript compilation
npm run lint          # ESLint checks
```

**Expected Results:**

- [ ] 143 tests passing
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors

**Sample Output:**

```
 Test Files  17 passed (17)
      Tests  143 passed (143)
   Duration  26.40s
```

**If tests fail:**

- Check `.env` has all required variables
- Run `npm run setup` to ensure DB is migrated
- Check test database is not corrupted

---

### 5. Job Engine Verification (Unit Tested Only)

**Current State:** Job engine is implemented and passing tests, but needs manual end-to-end verification through a wizard.

**Test Coverage:**

- [ ] `tests/integration/jobs/runner.test.ts` — 7 tests (lifecycle, lock, quota, errors)
- [ ] `tests/unit/jobs/changelog-buffer.test.ts` — 5 tests (batching, flushing)
- [ ] `tests/unit/schemas/job.test.ts` — State machine transitions

**Key Behaviors Verified in Tests:**

- Job lock prevents concurrent jobs for same store
- Quota exceeded transitions job to `failed`
- TokenExpiredError caught and re-thrown with merchant-friendly message
- Changelog buffer batches inserts (500 per batch)
- State transitions: `queued` → `running` → `succeeded`/`failed`

**What Needs Manual Verification:**

- [ ] End-to-end job creation via API
- [ ] Job execution through wizard UI
- [ ] ChangeLog entries appear in DB after job
- [ ] Backup CSV generation and storage
- [ ] Rollback functionality

---

### 6. Pre-commit Hooks Verification

**Test:**

```bash
# Make a trivial change
echo "// test" >> app/db.server.ts
git add .
git commit -m "test: verify pre-commit hooks"
```

**Expected:**

- [ ] Hooks run automatically (you'll see output)
- [ ] ESLint --fix runs
- [ ] TypeScript typecheck runs
- [ ] If no errors, commit succeeds

**If hooks don't run:**

```bash
npx husky install
```

---

### 7. Security Verification

**Check List:**

- [ ] `.env` file exists and has all required variables
- [ ] `ENCRYPTION_KEY` is 32-byte hex (64 characters)
- [ ] No `.env` in git (check `.gitignore`)
- [ ] All `.server.ts` files are server-only
- [ ] No `process.env` references in client code

**Generate encryption key if needed:**

```bash
openssl rand -hex 32
```

---

### 8. API Client Verification (via Tests)

**Files:**

- `tests/unit/lib/shopify/client.test.ts`
- `tests/integration/shopify/token.test.ts`

**Verified Behaviors:**

- [ ] 401 detection throws `TokenExpiredError`
- [ ] Rate limiting throttles requests
- [ ] Token retrieval decrypts encrypted tokens
- [ ] GraphQL/REST requests include proper auth headers

**Manual Check (Optional):**

```typescript
// In any loader/action:
import { getShopifyClientForStore } from '~/lib/shopify/token.server';

const client = await getShopifyClientForStore(storeId);
const response = await client.graphql(`{ shop { name } }`);
```

---

### 9. Storage Provider Verification

**Configuration:**

- Set `STORAGE_PROVIDER=memory` in `.env` (for testing)

**Verified via:**

- `tests/integration/storage/memory.test.ts`
- `tests/contracts/storage.contract.test.ts`

**Check List:**

- [ ] Memory provider passes contract tests
- [ ] Upload/download round-trip works
- [ ] Contract defines interface for future providers (Supabase, R2)

---

## ❌ What Requires Agent Implementation (Phase 5)

### Files to Create

| Component      | File Path                                  | Priority |
| -------------- | ------------------------------------------ | -------- |
| Status Route   | `app/routes/app.status.tsx`                | High     |
| Price Filter   | `app/lib/wizards/price/filter.server.ts`   | High     |
| Price Diff     | `app/lib/wizards/price/diff.server.ts`     | High     |
| Price Executor | `app/lib/wizards/price/executor.server.ts` | High     |
| Price Rollback | `app/lib/rollback/price.server.ts`         | High     |
| API Jobs       | `app/routes/api.jobs.ts`                   | High     |
| API Job Detail | `app/routes/api.jobs.$id.ts`               | High     |
| API Execute    | `app/routes/api.jobs.$id.execute.ts`       | High     |
| Wizard UI      | `app/routes/app.wizards.price.tsx`         | High     |
| Job Detail UI  | `app/routes/app.jobs.$id.tsx`              | Medium   |
| Diff Tests     | `tests/unit/wizards/price/diff.test.ts`    | High     |
| E2E Tests      | `tests/e2e/price-wizard.spec.ts`           | Medium   |

### What Requires Your Manual Action

1. **Dev Store Seeding (REQUIRED before Phase 5)**
   - [ ] Open dev store admin
   - [ ] Create or import 50-100 products
   - [ ] Ensure products have multiple variants
   - [ ] Verify products appear in store catalog

2. **Post-Implementation Verification**
   - [ ] Navigate all 5 wizard steps in browser
   - [ ] Confirm filter results match dev store products
   - [ ] Verify diff preview shows correct old/new prices
   - [ ] Run job to completion
   - [ ] Confirm prices changed in Shopify admin
   - [ ] Test rollback restores original prices

---

## Environment Variables Checklist

**Required in `.env`:**

```bash
# Shopify (from Partner Dashboard)
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SCOPES=write_products,read_inventory,write_inventory

# Database
DATABASE_URL=          # file:dev.sqlite (local) or Supabase URL
DIRECT_URL=            # Only needed for Supabase migrations

# Security
ENCRYPTION_KEY=        # 32-byte hex (64 chars)

# Storage
STORAGE_PROVIDER=memory    # memory | supabase | r2

# Logging
LOG_LEVEL=info
```

**Verify All Set:**

```bash
cat .env | grep -v "^#" | grep -v "^$"
```

---

## Quick Verification Commands

```bash
# Full verification suite
npm run setup && npm test && npm run typecheck && npm run lint

# Check database state
npx prisma studio

# Check git state
git status
git log --oneline -5

# Check environment
cat .env | grep -v "^#" | grep -v "^$" | wc -l   # Should be 8-10 lines
```

---

## Troubleshooting

| Issue                                 | Cause                      | Fix                                             |
| ------------------------------------- | -------------------------- | ----------------------------------------------- |
| "table `main.Session` does not exist" | DB not initialized         | Run `npm run setup`                             |
| HMAC validation fails on webhooks     | Wrong webhook source       | Use app-specific webhooks in `shopify.app.toml` |
| "Decryption failed" error             | Invalid encryption key     | Verify `ENCRYPTION_KEY` is 32-byte hex          |
| Tests fail with "Store not found"     | DB not seeded              | Run `npx prisma db seed`                        |
| `app.github.dev` URL shown            | Codespace tunnel not fixed | Check `package.json` dev script                 |
| Pre-commit hooks not running          | Husky not initialized      | Run `npx husky install`                         |

---

## Sign-off Checklist

Before proceeding to Phase 5, verify:

- [ ] All 143 tests passing
- [ ] App installs in dev store successfully
- [ ] Store row created with encrypted token
- [ ] TypeScript compilation clean
- [ ] ESLint clean
- [ ] Pre-commit hooks working
- [ ] Dev store has 50-100 test products

---

_Last updated: April 13, 2026_
