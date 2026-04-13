# AGENTS.md — Safe Bulk Ops for Shopify

> A React Router app for bulk price/inventory/collection operations. Built for merchants who want safe, opinionated bulk operations without becoming data engineers.

## Quick Start

```bash
# First time setup
npm install
npm run setup          # prisma generate + migrate deploy

# Daily development
npm run dev            # shopify app dev (opens tunnel, requires Shopify login)
```

Press `P` in the CLI to open the app URL. The app runs embedded in Shopify admin.

## Project Architecture

| Layer            | Location                | Purpose                                                           |
| ---------------- | ----------------------- | ----------------------------------------------------------------- |
| **Routes**       | `app/routes/`           | React Router routes using flatRoutes convention                   |
| **Database**     | `app/db.server.ts`      | Prisma client + data helpers (createStore, createJob, etc.)       |
| **Schemas**      | `app/schemas/`          | Zod validation schemas                                            |
| **Server Utils** | `app/lib/*.server.ts`   | Server-only utilities (encryption, rate limiting, Shopify client) |
| **Storage**      | `app/storage.server.ts` | Provider-agnostic storage abstraction                             |

### Route Naming Convention

Routes use dot notation for nested paths:

- `app._index.tsx` → `/app`
- `app.jobs.$id.tsx` → `/app/jobs/:id`
- `webhooks.app.uninstalled.tsx` → `/webhooks/app/uninstalled`

## Critical Conventions

### Agent Behavioral Guardrails

These rules prevent hallucinations and incorrect assumptions:

**VERIFY BEFORE ASSUMING**

- Never assume infrastructure exists (remote repos, CI/CD, accounts)
- Never assume dependencies are set up
- Never assume the user wants what seems "obvious"
- Always verify the current state before making changes

**Pre-Action Checklist (Infrastructure, CI/CD, Git, External Services)**

Verify Git State:

```bash
git remote -v          # Is there a remote?
git status             # What's the current state?
git log --oneline -5   # What's been committed?
git branch -a          # What branches exist?
```

Verify Infrastructure:

```bash
ls -la .github/        # Does CI already exist?
cat package.json       # What scripts exist?
npm list <package>     # Is the package installed?
```

**Forbidden Assumptions**

- ❌ Remote repository exists — Always check `git remote -v`
- ❌ GitHub is the platform — Could be GitLab, Bitbucket, self-hosted
- ❌ CI/CD is desired — Ask if user wants it
- ❌ User is ready to commit/push — Check `git status` first
- ❌ Default branch is main/master — Verify with `git branch`
- ❌ User has accounts — GitHub, Vercel, etc. may not exist
- ❌ Environment is set up — Don't assume env vars, DBs, etc. exist

**When to Ask vs When to Act**

Ask First:

- Setting up CI/CD pipelines
- Creating remote repositories
- Installing infrastructure tools
- Configuring deployment
- Anything requiring external accounts

Act Directly:

- Code changes within existing structure
- Local-only tooling (pre-commit hooks, npm scripts)
- Documentation updates
- Bug fixes to existing code

**Required Questions for Infrastructure Work**

Before touching Git/Repository:

- "Do you have a remote repository set up?"
- "What platform do you prefer (GitHub, GitLab, etc.)?"
- "When do you plan to push code?"
- "What branch strategy do you want?"

Before touching CI/CD:

- "Do you want CI/CD now or later?"
- "What platform (GitHub Actions, Travis, etc.)?"
- "Should this run on every push or just PRs?"

**Documentation Requirements**

When an assumption is identified:

1. Document it in `followup.md` or similar
2. Note the decision clearly
3. Specify trigger for when to revisit
4. Update this file if it's a recurring pattern

---

### 1. Server/Client Boundary

**NEVER** import `.server.ts` files in client code:

```typescript
// ✅ Correct: Only use in server context (loaders, actions, .server.ts files)
import { encrypt } from '~/lib/crypto.server.ts';

// ❌ Wrong: Never import in components or regular .ts files
```

### 2. Embedded App Navigation

The app runs inside Shopify admin iframe. **Never** use raw `<a>` tags or react-router `redirect`:

```typescript
// ✅ Correct: Use Polaris Link or react-router navigation
import { Link } from '@shopify/polaris';
import { useNavigate } from 'react-router';

// ✅ Correct: Use authenticate.admin() redirect in loaders/actions
const { redirect } = await authenticate.admin(request);
return redirect('/app');

// ❌ Wrong: Never use raw <a> tags or react-router redirect in server code
```

### 3. Authentication Pattern

```typescript
const { admin, session } = await authenticate.admin(request);
const response = await admin.graphql(`...`);
```

## Server Utilities Reference

| File                               | Purpose                | Key Exports                                        |
| ---------------------------------- | ---------------------- | -------------------------------------------------- |
| `app/lib/crypto.server.ts`         | AES-256-GCM encryption | `encrypt()`, `decrypt()`, `CryptoError`            |
| `app/logger.server.ts`             | Structured logging     | `logger`, `createChildLogger()`                    |
| `app/lib/rate-limiter.server.ts`   | API rate limiting      | `LeakyBucket`, `GraphQLCostTracker`                |
| `app/lib/shopify/client.server.ts` | Shopify API client     | `createShopifyClient()`, `ShopifyApiError`         |
| `app/lib/shopify/token.server.ts`  | Secure token retrieval | `getShopifyClientForStore()`, `StoreNotFoundError` |
| `app/storage.server.ts`            | Storage abstraction    | `getStorageProvider()`, `uploadBackupFile()`       |

## Testing

```bash
npm test               # Unit & integration tests (Vitest)
npm run test:watch     # Watch mode
npm run test:e2e       # E2E tests (requires dev server running)
```

**Test locations:**

- Unit: `tests/unit/`
- Integration: `tests/integration/`
- E2E: `tests/e2e/`

## Database (Prisma)

| Environment | Database          | Connection         |
| ----------- | ----------------- | ------------------ |
| Local       | SQLite            | `file:dev.sqlite`  |
| Production  | Supabase Postgres | Via `DATABASE_URL` |

```bash
npm run setup          # Generate client + run migrations
npm run prisma -- [cmd]  # Run Prisma CLI commands
npm run db:seed        # Seed test data
```

**Schema:** Session (Shopify), Store, Job, File, ChangeLog, JobTemplate

## Environment Variables

**Required** (provided by Shopify CLI):

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `DATABASE_URL`

**Additional:**

- `ENCRYPTION_KEY` — 32-byte hex string for AES-256-GCM token encryption
- `STORAGE_PROVIDER` — `memory` (testing), `supabase`, or `r2`
- `LOG_LEVEL` — pino log level (default: `info`)

## Build & Validation

```bash
npm run typecheck      # react-router typegen + tsc --noEmit
npm run build          # Production build
npm run start          # Production server (requires build first)
npm run lint           # ESLint checks
```

## Troubleshooting

| Issue                                 | Cause                    | Fix                                                                |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| "table `main.Session` does not exist" | Database not initialized | Run `npm run setup`                                                |
| HMAC validation fails on webhooks     | Wrong webhook source     | Use app-specific webhooks in `shopify.app.toml`, not admin-created |
| "Decryption failed" error             | Invalid encryption key   | Verify `ENCRYPTION_KEY` is set and is 32-byte hex                  |
| Storage upload fails                  | Missing provider config  | Check `STORAGE_PROVIDER` env var is set correctly                  |
| `admin` object undefined in tests     | CLI test behavior        | Expected — CLI triggers with non-existent shop                     |

## Project Status

| Phase | Focus                          | Status                          |
| ----- | ------------------------------ | ------------------------------- |
| 0     | Test infrastructure            | ✅ Complete (30 tests passing)  |
| 1     | Database schema & data layer   | ✅ Complete (106 tests passing) |
| 2     | Core server utilities          | ✅ Complete (122 tests passing) |
| 3     | OAuth & Store registration     | ✅ Complete (127 tests passing) |
| 4     | Testing infrastructure         | ✅ Complete (130 tests passing) |
| 5     | Job engine                     | 🔄 In Progress                  |
| 6-11  | Wizards, UI, hardening, launch | 📋 Planned                      |

**Note:** Audit phases 3-6 (Security, CI/CD, Governance, Gap Analysis) are paused and will resume after roadmap.md completion. See `followup.md` for details.

## References

- `app.md` — Full product spec, data model, detailed roadmap
- `roadmap.md` — Phase-by-phase engineering roadmap
- `README.md` — Shopify template docs, deployment guides
- [Shopify React Router docs](https://shopify.dev/docs/api/shopify-app-react-router)
