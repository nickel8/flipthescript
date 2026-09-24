# FlipTheScript — Architecture

A guide to where everything lives, how it fits together, and how to bring
someone up to speed quickly.

---

## 1. The Three Things

There are three distinct applications inside the same local folder
(`~/Documents/FlipTheScript/`). Only two are actively deployed.

```
~/Documents/FlipTheScript/
│
├── FlipTheScript/        ← Mac app (Swift / SwiftUI / Core Data)
├── FlipTheScript.xcodeproj/
│
├── web/                  ← ✅ ACTIVE web app (this repo, deployed to Vercel)
│   ├── app/
│   ├── lib/
│   ├── supabase/
│   └── .git              ← its own git repo
│
├── app/                  ← ⚠️  OLD web app (dormant, not deployed)
├── lib/
├── supabase/             ← has some migrations not yet copied to web/
└── .git                  ← outer git repo, largely unused
```

### What is actively deployed?
`web/` only. It has its own git repo pointing to
`github.com/nickel8/flipthescript`. Vercel watches that repo and
auto-deploys on every push to `main`.

### What is the outer git repo?
The outer repo at `~/Documents/FlipTheScript/.git` was the original
git repo before the project was reorganised. It points to the same
GitHub remote but is no longer actively pushed. The `app/` and `lib/`
directories at the root are the old web app — consider them archived.

---

## 2. The Mac App (`FlipTheScript/`)

A native macOS app built in Swift / SwiftUI, distributed via Sparkle.

**What it does**
- Imports PDF scripts and parses them into scenes
- Breakdown editor: tag scenes with elements by category
- Shoot schedule management
- Exports breakdown as XLSX or PDF
- Publishes the production snapshot to the cloud (Supabase) so the
  team can see it on the web app

**Key source files**
| File | Role |
|---|---|
| `Services/PublishService.swift` | Pushes the full production to `POST /api/publish` |
| `Services/ShareService.swift` | Cloud sync — reads + writes todos, reads shoot days |
| `Services/ScriptParser.swift` | PDF → scene list parser |
| `Services/ScriptDiffer.swift` | Detects changes between script versions |
| `Services/TodoSyncService.swift` | Bidirectional todo sync with Supabase |
| `Views/BreakdownLiveView.swift` | Main breakdown editor UI |
| `Views/ShareView.swift` | Cloud publish / sync UI |

**Important behaviour**
- The Mac app is the **only writer** of scenes, scripts, elements, and
  scene_elements. The web app reads these.
- When the Mac app publishes, it sends a full snapshot. The web
  handles this as an upsert (`merge-duplicates` on `cloud_id`).
- `shoot_day` / `shoot_order` are **intentionally excluded** from the
  publish upsert — the web manages these exclusively.

---

## 3. The Web App (`web/`)

Next.js 16, React 19, TypeScript, Tailwind 4. Deployed to Vercel.

### Top-level structure

```
web/
├── app/
│   ├── page.tsx            ← Marketing / beta landing page
│   ├── pricing/            ← Pricing page
│   ├── v2/                 ← Archived old marketing site
│   ├── cloud/              ← 🔑 The main product (requires auth)
│   │   ├── layout.tsx      ← Shared header for all /cloud/* pages
│   │   ├── sign-in/        ← OTP email sign-in
│   │   ├── dashboard/      ← Production list
│   │   └── productions/
│   │       └── [cloudId]/  ← Everything per-production (see below)
│   ├── api/                ← All server-side API routes
│   ├── auth/               ← Magic-link callback handler
│   ├── admin/              ← Internal admin (user list)
│   ├── open/               ← Public shared breakdown view
│   └── view/[breakdownId]/ ← Public read-only breakdown view
├── lib/
│   ├── cloud-session.ts    ← Auth: get/require session from cookie
│   ├── script-parser.ts    ← TypeScript port of Mac script parser
│   ├── schedule-parser.ts  ← PDF schedule → shoot days
│   ├── breakdown-pdf.tsx   ← PDF export renderer
│   └── digest.ts           ← Digest email helper
├── supabase/
│   └── migrations/         ← SQL migration files (run manually)
└── public/                 ← Static assets
```

### The `/cloud/productions/[cloudId]` section

This is where all the active product work lives.

```
[cloudId]/
├── page.tsx              ← Overview / Daily Digest
├── breakdown/
│   └── page.tsx          ← Breakdown editor
├── tasks/
│   ├── page.tsx          ← My flags (server)
│   └── TaskList.tsx      ← My flags (client)
├── sidings/
│   └── page.tsx          ← Today's call sheet summary
├── schedule/
│   └── page.tsx          ← Import shoot schedule from PDF
├── upload/
│   └── page.tsx          ← Upload new script PDF
├── members/              ← Team management
├── budget/               ← Placeholder
├── continuity/           ← Placeholder
│
├── BreakdownEditor.tsx   ← 3-panel client component (scenes | editor | categories)
├── SceneList.tsx         ← Left panel: scene list + Story/Shoot toggle
├── ShootView.tsx         ← Shoot mode: drag-to-schedule with dnd-kit
├── SceneEditor.tsx       ← Centre panel: synopsis + element categories
├── CategoriesPanel.tsx   ← Right panel: manage production categories
├── DigestSceneList.tsx   ← Digest accordion scene list
├── actions.ts            ← Server actions (DB writes for breakdown)
└── types.ts              ← Shared TypeScript interfaces
```

### API routes (`app/api/`)

| Route | Method | What it does |
|---|---|---|
| `/api/publish` | POST | Mac app → full production snapshot to Supabase |
| `/api/element-flags` | GET/POST/PATCH/DELETE | Personal element flags (to-do list) |
| `/api/update-shoot-order` | PATCH | Save drag-to-schedule changes |
| `/api/update-shoot-day` | PATCH | Save shoot day date assignment |
| `/api/parse-script` | POST | Upload PDF, extract scenes (pdfjs) |
| `/api/import-script` | POST | Commit parsed scenes to DB |
| `/api/import-schedule` | POST | Upload schedule PDF, extract shoot days |
| `/api/script-pdf` | GET | Stream stored PDF from Vercel Blob |
| `/api/export-breakdown` | GET | Generate breakdown PDF via @react-pdf/renderer |
| `/api/production-categories` | GET/POST/DELETE | Per-production element categories |
| `/api/category-library` | GET | Admin-curated category library |
| `/api/cloud-todos` | GET/POST/PATCH/DELETE | Production to-dos (unused in current UI) |
| `/api/cloud-auth/send-otp` | POST | Send magic-link / OTP email |
| `/api/cloud-auth/sign-in` | POST | Verify OTP, set session cookie |
| `/api/cloud-auth/sign-out` | POST | Clear session cookie |
| `/api/production-members` | GET/POST/DELETE | Team membership management |
| `/api/share` | POST | Create public shared breakdown link |
| `/api/paddle/webhook` | POST | Paddle payment webhook |

**Auth pattern**: All cloud API routes call `getCloudSession()` or
`requireCloudSession()` from `lib/cloud-session.ts`. The session comes
from a cookie set at sign-in. DB writes use the Supabase service role
key (bypasses RLS).

---

## 4. The Database (Supabase / Postgres)

Supabase handles: Postgres, Auth (OTP email), Row Level Security.

### Core tables

```
productions          cloud_id (from Mac), owner_id, name
  └── episodes       one per production (usually one)
       └── scripts   one per script version, blob_url (PDF in Vercel Blob)
            └── scenes  scene_number, shoot_day, shoot_order, is_complete
                 └── breakdown_sheets  synopsis, notes, is_reviewed
                      └── scene_elements → elements (name, category)

elements             production-level, shared across scenes
production_members   user ↔ production, role (owner/dept_owner/collaborator), tier (free/paid)
subscriptions        Paddle subscription state per user
todos                production-level or scene-level to-dos
element_flags        personal per-user flags on scene elements (to-do list)
shoot_days           dayNumber → shoot_date mapping per production
production_categories  per-production element category list
category_library     admin-curated global category library
```

### Key rules
- **RLS is ON** for all tables, but all web API routes use the
  **service role key** which bypasses RLS entirely.
- Scenes/scripts/elements are **read-only from the web**. Only the Mac
  app publish endpoint writes them.
- `breakdown_sheets`, `scene_elements`, `element_flags`, `shoot_days`,
  `production_categories`, `todos` are **web-writable**.

### Migrations
SQL files live in `web/supabase/migrations/`. They must be **run
manually** in the Supabase SQL editor — there is no automated migration
runner. Run them in filename order when setting up a new environment.

---

## 5. Data Flow

```
Mac App
  │  user imports PDF, builds breakdown, assigns elements
  │
  └─► POST /api/publish  ──►  Supabase  (scenes, elements, scripts)
                                  │
  ◄── ShareService.swift ◄────────┘  (bidirectional sync: todos, flags)

Web App
  │
  ├─ Server components fetch from Supabase (service role, no-store cache)
  ├─ Client components call API routes for mutations
  │
  ├─ Breakdown editor: reads scenes from DB, writes shoot_day/synopsis/elements
  ├─ Tasks page: reads/writes element_flags
  ├─ Sidings: reads scenes for next shoot day
  └─ Digest (overview): reads scenes + shoot_days + script info
```

---

## 6. Running Locally

### Web app
```bash
cd ~/Documents/FlipTheScript/web
npm install
# Create .env.local with:
#   SUPABASE_URL=
#   SUPABASE_SERVICE_ROLE_KEY=
#   BLOB_READ_WRITE_TOKEN=
npm run dev   # → http://localhost:3000
```

### Mac app
Open `FlipTheScript.xcodeproj` in Xcode. Set the signing team.
In `CloudConfig.swift`, make sure `baseURL` points to localhost or
production as needed. Build → Run.

---

## 7. Deployment

| Thing | Where | How |
|---|---|---|
| Web app | Vercel | Auto-deploys on push to `main` in `web/` git repo |
| Database | Supabase | Persistent, no deploy step |
| PDFs | Vercel Blob | Stored at upload time via `@vercel/blob` |
| Mac app | Direct download | `build-release.sh` in root dir; appcast on Vercel |

**Environment variables** are set in the Vercel dashboard.
Local dev uses `.env.local` (gitignored).

---

## 8. Repo Cleanup (to do, not urgent)

The current state is messy for two reasons:

1. **Two Next.js apps in one folder**: The root-level `app/` (old web
   app) and `web/` (active web app) are separate Next.js projects.
   The old one is dormant. At some point, `app/` and the outer
   `package.json`/`next.config.ts` should be deleted or the Mac app
   should be extracted to its own repo.

2. **Two nested git repos pointing to the same GitHub remote**: The
   outer repo (`~/Documents/FlipTheScript/.git`) and the web repo
   (`web/.git`) both point to `nickel8/flipthescript`. Only `web/` is
   actively pushed. The outer repo was the original; when work was
   reorganised into `web/`, a new git was initialised there. The outer
   repo is now effectively abandoned.

   **Risk**: If you accidentally run `git push` from the root directory
   it could conflict with the `web/` repo's history.

3. **Supabase migrations split**: Migrations up to `viewer_role` exist
   in both `supabase/` (root) and `web/supabase/`. Newer migrations
   (`production_categories`, `element_flags`) only exist in the root-
   level `supabase/`. They need to be copied into `web/supabase/`.

**Recommended cleanup** (when time allows):
- Copy the two newer migrations into `web/supabase/migrations/`
- Move the Mac app source into its own repo or subfolder
- Delete the root-level `app/`, `lib/`, `package.json`, `next.config.ts`
- Delete the outer `.git` (keep `web/.git` only)
