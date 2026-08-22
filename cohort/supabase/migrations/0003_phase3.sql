-- Cohort – Phase 3 Schema Extensions
-- Migration: 0003_phase3.sql

-- ─────────────────────────────────────────────
-- 1. INSTITUTIONS – isolated campuses
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- Seed Thapar Institute
INSERT INTO institutions (name)
VALUES ('Thapar Institute of Engineering and Technology')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Link PROFILES to INSTITUTIONS
-- ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

-- Optional: Since we only have Thapar right now, we can update existing profiles
UPDATE profiles 
SET institution_id = (SELECT id FROM institutions WHERE name = 'Thapar Institute of Engineering and Technology')
WHERE institution_id IS NULL;
