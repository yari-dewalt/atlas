-- Add user blocks table to track blocked users
-- This prevents blocked users' content from appearing in feeds and allows content moderation

-- Create user_blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can't block the same person twice
    UNIQUE(blocker_id, blocked_id),
    
    -- Ensure a user can't block themselves
    CHECK (blocker_id != blocked_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_created_at ON user_blocks(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own blocks
CREATE POLICY "Users can view their own blocks" ON user_blocks
    FOR SELECT USING (auth.uid() = blocker_id);

-- Policy: Users can create blocks for themselves
CREATE POLICY "Users can create their own blocks" ON user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Policy: Users can delete their own blocks (unblock)
CREATE POLICY "Users can delete their own blocks" ON user_blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- Add helper functions for blocking/unblocking users
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert block record
    INSERT INTO user_blocks (blocker_id, blocked_id)
    VALUES (auth.uid(), p_blocked_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
    
    -- Also unfollow the blocked user if currently following
    DELETE FROM follows 
    WHERE follower_id = auth.uid() AND following_id = p_blocked_id;
    
    -- Remove the blocked user's follow of the blocker
    DELETE FROM follows 
    WHERE follower_id = p_blocked_id AND following_id = auth.uid();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unblock_user(p_blocked_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove block record
    DELETE FROM user_blocks 
    WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_blocked(p_user_id UUID, p_blocked_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = p_user_id AND blocked_id = p_blocked_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON user_blocks TO authenticated;
GRANT EXECUTE ON FUNCTION block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_blocked(UUID, UUID) TO authenticated;
