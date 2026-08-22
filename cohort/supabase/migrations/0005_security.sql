-- Keep all application data behind server-side route handlers. Browser roles
-- receive no direct table privileges; the service role used by the server is
-- explicitly retained.

CREATE TABLE IF NOT EXISTS profile_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_sessions_expires_at_idx
  ON profile_sessions (expires_at);

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE codeforces_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  domains,
  institutions,
  profiles,
  profile_domains,
  github_cache,
  codeforces_cache,
  beacons,
  profile_sessions
FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  domains,
  institutions,
  profiles,
  profile_domains,
  github_cache,
  codeforces_cache,
  beacons,
  profile_sessions
TO service_role;
