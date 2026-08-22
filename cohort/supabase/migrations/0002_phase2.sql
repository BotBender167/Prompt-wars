-- Cohort – Phase 2 Schema Extensions
-- Migration: 0002_phase2.sql

-- ─────────────────────────────────────────────
-- 1. Extend profiles with two new columns
-- ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_project text,
  ADD COLUMN IF NOT EXISTS looking_for     text;

-- ─────────────────────────────────────────────
-- 2. BEACONS – opt-in live presence
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beacons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_name   text NOT NULL,
  available_until timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient "active beacons" queries
CREATE INDEX IF NOT EXISTS beacons_available_until_idx
  ON beacons (available_until);
