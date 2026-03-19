ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMPTZ;
