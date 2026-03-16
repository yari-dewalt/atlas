-- Add subscription fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create subscriptions audit table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'lifetime')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'expired', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only read their own subscription rows
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages all writes (no policy needed — service role bypasses RLS)
