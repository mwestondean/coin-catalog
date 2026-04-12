-- 002_add_reviewed_flag.sql
-- Adds reviewed_by_admin flag for notification system.
-- Tish catalogues coins; Weston sees unreviewed ones in his inbox.
-- Claude-3Kx7:mexican-coin-platform | 2026-04-12

ALTER TABLE coins ADD COLUMN reviewed_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_coins_unreviewed ON coins (reviewed_by_admin) WHERE reviewed_by_admin = FALSE;
