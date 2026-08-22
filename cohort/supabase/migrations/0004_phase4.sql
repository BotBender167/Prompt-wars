-- Cohort – Phase 4 Schema Updates (Performance & Seed Fixes)
-- Migration: 0004_phase4.sql

-- 1. Add missing indices for discover query performance
CREATE INDEX IF NOT EXISTS idx_profiles_institution_id ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_profile_domains_profile_id ON profile_domains(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_domains_domain_id ON profile_domains(domain_id);

-- 2. Scrub existing profiles with invalid department names
-- We only update to a valid Thapar department if we can map it roughly, or null it out if completely invalid.
-- Since it's a seed/dev environment, we'll just set anything not in the official list to NULL.
UPDATE profiles 
SET department = NULL
WHERE department NOT IN (
  'Chemical Engineering',
  'Civil Engineering',
  'Computer Science & Engineering',
  'Department of Biotechnology',
  'Electrical & Instrumentation Engineering',
  'Electronics & Communication Engineering',
  'Mechanical Engineering',
  'Basic & Engineering Sciences (Dera Bassi Campus)',
  'Department of Chemistry & Biochemistry',
  'Department of Energy and Environment',
  'Department of Mathematics',
  'Department of Physics & Materials Science',
  'L. M. Thapar School of Management',
  'School of Humanities & Social Sciences',
  'Thapar School of Liberal Arts & Sciences (TSLAS)'
);
