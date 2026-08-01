-- ─────────────────────────────────────────────────────────────────────────────
-- Digest support
--
-- 1. department on breakdown_access  — filters digest content by role
-- 2. digest_log                      — one row per send attempt, for observability
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Department stored per-recipient so digests can be category-filtered.
--    Nullable: null means "all categories" (same as Art Direction / Other).
ALTER TABLE breakdown_access ADD COLUMN department text;

-- 2. Digest send log.
--    Records every attempt so failures are visible without checking Resend.
CREATE TABLE digest_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  breakdown_id        uuid        NOT NULL REFERENCES shared_breakdowns(id) ON DELETE CASCADE,
  email               text        NOT NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  changes_count       int         NOT NULL DEFAULT 0,
  resend_message_id   text,
  error               text
);
