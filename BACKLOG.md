# FlipTheScript — Backlog

## Features

### Markdown export / import (archive format)
Export a full production breakdown to a structured markdown file — scenes, elements, synopses, notes, to-dos, shoot schedule. Human-readable and storable anywhere (Google Drive, email, etc).

On re-import, the app restores the breakdown into Core Data as a baseline. Not editable outside the app (snapshot only, not source of truth).

**Why:** Productions often pause for months or years then come back. Cloud subscriptions will lapse during that time. This gives teams a way to archive their work and restore it when the production resumes, without being locked into an active subscription.

**Scope:**
- Export: one markdown file per production (or per episode for episodic)
- Covers: scenes, elements (by category), synopsis, notes, to-dos, shoot day assignments
- Import: parses the markdown back into a new production in Core Data
- Available to all users (Mac app), not gated behind Cloud

### Re-add Sparkle auto-update
Sparkle was removed at some point, breaking in-app update prompts. v1.7 users cannot auto-update to v1.8 — they need to download manually from the site. Fine for user testing, but needs fixing before wider release.

**Decision needed:** re-add Sparkle to the Xcode project, or replace with a lightweight "new version available" banner that links to the download page.

---

## Go-to-market / pricing

### Pricing model (agreed)
- **Mac app** — £199 one-time. Required for whoever does the actual breakdown work.
- **Cloud team licence** — £49.99/month. Whole team gets visibility and collaboration. Cancel anytime.
- **Individual Cloud** — £9.99/month per person. Self-serve, bottom-up adoption.
- Cancel → 30-day read-only grace period to export data before access closes.

### Bottom-up to top-down conversion
5 individuals at £9.99 = ~£50, same as the team licence. Natural trigger for HODs to consolidate onto the team licence once a cluster of individuals is already using it.
