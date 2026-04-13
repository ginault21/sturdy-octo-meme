# Safe Bulk Ops for Shopify — Project Brief

> "Safe, opinionated bulk operations for Shopify merchants who don't want to become data engineers."

---

## 1. The Problem

Shopify's native bulk editor and CSV import/export work for small catalogs but break down at scale:

- Merchants must manually scroll to add products to collections — the bulk editor doesn't support collection membership editing at scale
- A merchant updating 300 products/1,800 variants must export → edit in Excel → **delete all products** → re-import, risking data loss
- Shopify's own answer to bulk price/image updates: "prepare a CSV under 15MB and deal with the error report"

**Matrixify proves the demand** but is overkill — reviewers explicitly call it "too complex and costly for small businesses" with reliance on Google Sheets, FTP, and deep Shopify field knowledge.

**Our wedge:** same demand, dramatically simpler experience.

---

## 2. Positioning

### One-line thesis

"Safe, opinionated bulk operations for Shopify merchants who don't want to become data engineers."

### Ideal Customer Profiles (ICPs)

**ICP 1 — Mid-size merchants (500–10,000 SKUs)**

- Pain: run promos, seasonal pricing, and inventory changes without breaking the catalog
- Skills: basic spreadsheet comfort; not comfortable with Shopify API docs or CSV templates

**ICP 2 — Boutique Shopify agencies / freelancers**

- Pain: repeatable, safe bulk work across multiple client stores using bespoke scripts or Matrixify
- Skills: technical but time-constrained; want a tool they can hand to junior staff

### Non-goals (V1)

- ❌ Full migration tool (BigCommerce → Shopify) — leave to Matrixify
- ❌ "Edit every Shopify entity" platform — laser focus on Products + Collections
- ❌ Full reporting/BI — a simple audit trail is enough

---

## 3. Product Spec

All features are **guided wizards** built on the same underlying job engine.

### Core V1 Jobs

#### Job 1: Bulk Price Update Wizard

1. Select scope (collection, tags, vendor, type, or manual search)
2. Choose operation (set absolute / increase or decrease by % or amount)
3. Choose targets (all variants or matching SKU/option conditions)
4. Confirm & preview (diff table: old price → new price, per variant + aggregate summary)
5. Apply & backup (auto-backup CSV before changes; live progress; failure capture)

**Backend:** Shopify Product API → minimal fields → batch updates respecting API throttle (2 req/s leaky bucket) → persist `ChangeLog` rows

#### Job 2: Bulk Inventory Adjustment Wizard

1. Select location(s)
2. Select products/variants (same filter UX as price job)
3. Choose operation (set absolute quantity or +/- adjust)
4. Diff preview per variant/location + location summary
5. Backup + apply (backup includes inventory item IDs per location for rollback)

#### Job 3: Bulk Collection Membership Wizard

1. Choose target manual collection(s)
2. Select products via filter/search
3. Choose: add / remove / replace collections
4. Preview: count of changes + conflict surface
5. Backup + apply

### V1.5 Roadmap (post-launch)

- **Metafield editor** — size charts, SEO metafields, product badges
- **Scheduled jobs** — recurring nightly/weekly price or inventory sync
- **Cross-store sync** — one-directional price/metafield copy from Store A → Store B

---

## 4. Data Model

### Tables

| Table           | Key Fields                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Store**       | id, shop_domain, shopify_access_token (encrypted), plan (trial/basic/pro/agency), created_at, updated_at                                                                      |
| **Job**         | id, store_id, type (price_update/inventory_update/collection_update), status (queued/running/succeeded/failed/cancelled), summary (JSON), created_at, started_at, finished_at |
| **JobTemplate** | id, type, label, config (JSON)                                                                                                                                                |
| **File**        | id, store_id, job_id, kind (backup/import/export), storage_url, metadata (JSON), created_at                                                                                   |
| **ChangeLog**   | id, job_id, shopify_product_id, shopify_variant_id, field, old_value, new_value, created_at                                                                                   |

### Internal API Surface

| Endpoint                           | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `POST /api/shopify/oauth/callback` | App install + token capture                   |
| `GET /api/jobs`                    | List jobs                                     |
| `GET /api/jobs/:id`                | Job detail + status                           |
| `POST /api/jobs`                   | Create job (type, filter, operation, dry_run) |
| `POST /api/jobs/:id/execute`       | Start execution                               |
| `POST /api/jobs/:id/rollback`      | Rollback from backup                          |
| `GET /api/jobs/:id/preview`        | Compute diff without applying                 |

---

## 5. Architecture

### Current Stack (as of March 2026)

- **Frontend + Routes:** Remix (App Router) — _chosen over Next.js for Shopify app conventions_
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + Shopify App Bridge React (embedded app, SSO, theming)
- **Database:** Supabase (Postgres) via Prisma ORM
- **File storage:** Cloudflare R2 or Supabase Storage (CSV backups/exports)
- **Job processing:** Remix API routes + polling worker (Option A) → BullMQ/Redis at scale (Option B)
- **Hosting:** TBD (Vercel or Railway)

### Shopify API Strategy

- Use GraphQL Admin API (cost-based limits) + REST for inventory (leaky bucket ~2 req/s)
- 2–3 parallel update threads per store; never run concurrent jobs for same store
- Queue jobs per store; process sequentially to avoid Shopify throttle

### Safety (Core Brand Promise)

- **Mandatory backups** before every job — no exceptions
- **Dry runs** — compute + validate diff without calling Shopify
- **Rollback** — every job creates a restore point; one-click undo
- **Audit log** — every change logged with old/new values + timestamps
- **Observability** — pino structured logging + Logtail/Datadog + Sentry

---

## 6. Pricing

| Plan        | Price  | SKUs/job | Jobs/month | Notes                                   |
| ----------- | ------ | -------- | ---------- | --------------------------------------- |
| **Starter** | $19/mo | 2,000    | 50         | All 3 wizards                           |
| **Growth**  | $39/mo | 10,000   | Unlimited  | + Scheduled jobs, cross-store sync      |
| **Agency**  | $79/mo | 25,000   | Unlimited  | Up to 5 client stores, priority support |

No feature gating beyond scale. Contrast with Matrixify's complex per-entity limits.

### MRR Targets

- Target ARPU: ~$29–$39/month
- **$500 MRR** = ~13–17 customers
- **$1,000 MRR** = ~26–34 customers
- **$5,000 MRR** = ~130–170 customers (6–12 months realistic for solo founder with solid distribution)

---

## 7. Go-to-Market

### A. Shopify App Store SEO

- App name: "Safe Bulk Editor – Prices, Inventory & Collections"
- Target keywords: "bulk update prices Shopify", "bulk inventory edit", "add products to collection in bulk"
- Screenshots: wizard flows + diff previews + before/after price grids (not generic dashboards)

### B. Review Strategy

- Convert beta merchants + agencies into first reviewers at launch
- In-app review ask after each high-impact job: "You just updated 3,121 variants. Did this save you time?"
- Respond publicly to all reviews with concrete resolution

### C. Agency Channel

- "Agency Founders" deal: $49/month for up to 3 stores for early adopters
- Target 100–150 Shopify-only agencies (Shopify Experts, Clutch, Google search)
- Targeted cold email referencing specific portfolio pieces showing large catalogs

### D. Content (Low-effort, High-leverage)

- "How to safely bulk update Shopify prices without breaking SEO"
- "Three ways to keep Shopify inventory in sync across multiple stores"
- "Why native CSV import/export isn't enough once you hit 1,000 SKUs"
- Post on own blog (SEO) + Shopify Community threads (add value, light mention)

---

## 8. Execution Timeline

### ✅ Completed

- Shopify CLI Remix scaffold created (`shopify app init`)
- App ran successfully in dev mode (`shopify app dev`) and loaded in dev store
- Codespace configured with OpenCode, devcontainer, and Gemini 3.1 Flash-Lite

### 🔄 Current: Week 1–2 — Foundations

- [ ] Verify OAuth end-to-end (app install in dev store → access token captured and stored)
- [ ] Create Supabase project + get `DATABASE_URL` + `DIRECT_URL`
- [ ] Wire Prisma schema: Store + Job tables (per Section 4 above)
- [ ] Run `prisma db push` and confirm connection from `app/db.server.ts`
- [ ] Smoke test: write a dummy Job row and read it back

### 📋 Upcoming: Week 3–4 — Core Wizards

- [ ] Bulk price update wizard (filter UI → export → diff preview → apply + backup)
- [ ] Inventory adjustment wizard (reuse price job logic ~80%)
- [ ] Collection membership wizard
- [ ] Rollback support ("Undo last job")
- [ ] Job list UI + detail pages + logs

### 📋 Upcoming: Weeks 5–6 — Polish + Launch

- [ ] Harden error cases (partial failures, timeouts, invalid rows)
- [ ] In-product onboarding (wizard guides, demo job)
- [ ] Shopify billing integration (Stripe or Shopify Billing API)
- [ ] Marketing site (landing page, docs, blog)
- [ ] Submit for Shopify App Store review

### 📋 Upcoming: Weeks 7–12 — Iterate + GTM

- [ ] Watch usage → drive v1.5 priorities
- [ ] Scheduled jobs (top agency request)
- [ ] Track: install→first job, first job→paid, time saved per job
- [ ] 1–2 blog posts/month + Shopify Community answers

---

## 9. Risks + Mitigations

| Risk                               | Mitigation                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Data loss/corruption**           | Always backup before job; encourage small-scope jobs first; white-glove rollback promise for early customers |
| **Shopify API throttling/changes** | Use official SDKs; conservative throttle thresholds; subscribe to Shopify developer changelog                |
| **Support burden (solo founder)**  | Keep surface area small (3 jobs); bake diagnostics into job pages (filters, counts, backup link)             |
| **Matrixify Lite spin-off**        | Own the niche: opinionated wizards + safety-first + transparent pricing                                      |

---

_Last updated: March 2026_
