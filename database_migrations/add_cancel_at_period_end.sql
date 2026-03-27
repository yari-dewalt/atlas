-- Add cancel_at_period_end flag to subscriptions table
-- This tracks whether the user has requested cancellation at the end of their billing period
-- (Spotify/Netflix-style: access continues until period ends, then revoked automatically)

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
