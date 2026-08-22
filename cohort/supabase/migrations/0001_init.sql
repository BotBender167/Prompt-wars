-- Cohort – Phase 1 Initial Schema & Domain Seed
-- Migration: 0001_init.sql

-- ─────────────────────────────────────────────
-- 1. DOMAINS – reference taxonomy, never user data
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text UNIQUE NOT NULL,
  category text NOT NULL
);

-- ─────────────────────────────────────────────
-- 2. PROFILES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          text NOT NULL,
  year               int,
  department         text,
  bio                text,
  github_username    text,
  codeforces_handle  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. PROFILE_DOMAINS – many-to-many
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_domains (
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_id   uuid NOT NULL REFERENCES domains(id)  ON DELETE CASCADE,
  PRIMARY KEY (profile_id, domain_id)
);

-- ─────────────────────────────────────────────
-- 4. GITHUB_CACHE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS github_cache (
  profile_id   uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  languages    jsonb,
  commits_90d  int,
  public_repos int,
  synced_at    timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. CODEFORCES_CACHE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codeforces_cache (
  profile_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rating          int,
  max_rating      int,
  rank_title      text,
  problems_solved int,
  synced_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 6. DOMAIN SEED (~40 rows, multi-disciplinary)
--    This is reference taxonomy data, not user data.
-- ─────────────────────────────────────────────
INSERT INTO domains (name, category) VALUES
  -- Electronics & Embedded
  ('Embedded Systems',          'Electronics'),
  ('VLSI Design',               'Electronics'),
  ('PCB Design',                'Electronics'),
  ('Signal Processing',         'Electronics'),
  ('Power Electronics',         'Electronics'),
  ('IoT & Hardware',            'Electronics'),
  ('FPGA Development',          'Electronics'),

  -- Software Engineering
  ('Web Development',           'Software'),
  ('Mobile Development',        'Software'),
  ('Backend Engineering',       'Software'),
  ('DevOps & Cloud',            'Software'),
  ('Systems Programming',       'Software'),
  ('Compiler Design',           'Software'),
  ('Open Source Contribution',  'Software'),

  -- Competitive Programming & Algorithms
  ('Competitive Programming',   'Algorithms'),
  ('Data Structures',           'Algorithms'),
  ('Graph Theory',              'Algorithms'),
  ('Cryptography',              'Algorithms'),

  -- Data & AI
  ('Machine Learning',          'Data & AI'),
  ('Deep Learning',             'Data & AI'),
  ('Computer Vision',           'Data & AI'),
  ('Natural Language Processing','Data & AI'),
  ('Data Engineering',          'Data & AI'),
  ('Data Analysis & Viz',       'Data & AI'),
  ('Reinforcement Learning',    'Data & AI'),

  -- Mechanical & Robotics
  ('Robotics',                  'Mechanical'),
  ('CAD & Simulation',          'Mechanical'),
  ('Thermodynamics',            'Mechanical'),
  ('Fluid Mechanics',           'Mechanical'),
  ('Control Systems',           'Mechanical'),
  ('3D Printing & Fabrication', 'Mechanical'),

  -- Design & UX
  ('UI/UX Design',              'Design'),
  ('Graphic Design',            'Design'),
  ('Motion & Animation',        'Design'),
  ('Design Systems',            'Design'),

  -- Biotech & Life Sciences
  ('Bioinformatics',            'Biotech'),
  ('Synthetic Biology',         'Biotech'),
  ('Medical Devices',           'Biotech'),

  -- Business & Management
  ('Product Management',        'Business'),
  ('Entrepreneurship',          'Business'),
  ('Finance & Quant',           'Business')
ON CONFLICT (name) DO NOTHING;
