# FlipTheScript — Backlog

---

## Jobs to be done

Four distinct jobs. All downstream of the breakdown — you can't do any of them
without it. Validate job 1 with the private beta before building jobs 2–4.

### Job 1 — Creating and sharing the breakdown ✅ In beta
The core job. Art director imports a script, breaks it down, shares with the team.
Team members see the latest version instantly. Amendments carry over automatically.
This is the beachhead.

**What's live:** breakdown editor, script upload, schedule import, shoot order,
collaborator access (editor/viewer), PDF export, team todos.

**Still to finish in job 1:**
- Shoot order drag-and-drop persistence (parked — investigate separately)
- Script PDF viewer split-screen in the editor
- New production from web (without Mac app)
- PDF export improvements
- Subscription / paywall (Paddle integration)
- 30-day read-only grace period on cancel
- Sparkle auto-update in Mac app (v1.7 → v1.8 broken)

---

### Job 2 — Task management (prep tracking)
Asana for the art department. Assign tasks, set priorities, flag blockers,
get approvals. More than a to-do list — a full picture of where prep stands.

**Why it's downstream of the breakdown:**
The breakdown is the source of truth for what needs to happen. Tasks without
a breakdown are just a list. Tasks tied to scenes and elements are actionable.

**Fake door live at:** `/cloud/productions/[cloudId]/tasks`

---

### Job 3 — Continuity (during filming)
Track what was actually used on the day — sets, props, dressing, costume —
against each scene as it's filmed. Flag discrepancies before you wrap.
Pre-populated from the breakdown so there's no double entry.

**Why it's downstream of the breakdown:**
Continuity is just the breakdown, confirmed (or corrected) on the day.
Without the breakdown you're starting from scratch on set.

**Fake door live at:** `/cloud/productions/[cloudId]/continuity`

---

### Job 4 — Budget (art department)
Build an art department budget line by line, tied to the breakdown.
Track spend as prep progresses. Know what's over budget before wrap.

**Why it's downstream of the breakdown:**
You can't estimate costs without knowing what you need. The breakdown
is the bill of materials. Budget is just adding numbers to it.

**Fake door live at:** `/cloud/productions/[cloudId]/budget`

---

## Tech debt / Mac app

### Markdown export / import (archive format)
Export a full production breakdown to a structured markdown file — scenes,
elements, synopses, notes, to-dos, shoot schedule. Human-readable and
storable anywhere.

On re-import, the app restores the breakdown into Core Data as a baseline.

**Why:** Productions pause for months or years. Cloud subscriptions lapse.
This gives teams a way to archive work and restore it without an active subscription.
Available to all users (Mac app), not gated behind Cloud.

### Re-add Sparkle auto-update
Sparkle was removed at some point, breaking in-app update prompts. v1.7 users
cannot auto-update to v1.8. Fine for user testing, needs fixing before wider release.

---

## Go-to-market / pricing

### Pricing model (agreed)
- **Mac app** — £199 one-time. Required for whoever does the breakdown.
- **Cloud team licence** — £49.99/month. Whole team gets visibility and collaboration.
- **Individual Cloud** — £9.99/month per person. Self-serve, bottom-up adoption.
- Cancel → 30-day read-only grace period to export before access closes.

### Bottom-up to top-down conversion
5 individuals at £9.99 ≈ £50 — same as the team licence. Natural trigger for HODs
to consolidate onto the team licence once a cluster of individuals is already using it.
