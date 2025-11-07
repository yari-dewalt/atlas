-- Add content reports table to track reported posts
-- This allows users to flag objectionable content for moderation

-- Create content_reports table
CREATE TABLE IF NOT EXISTS content_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN (
        'harassment',
        'hate_speech', 
        'inappropriate_content',
        'spam',
        'misinformation',
        'violence',
        'self_harm',
        'copyright',
        'privacy_violation',
        'other'
    )),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    moderator_id UUID REFERENCES auth.users(id),
    moderator_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate reports from same user for same post
    UNIQUE(reporter_id, post_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_post_id ON content_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id ON content_reports(reporter_id);

-- Enable RLS
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create reports" ON content_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON content_reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- Admin policy (you'll need to create admin role or use specific user IDs)
CREATE POLICY "Admins can view all reports" ON content_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Add admin flag to profiles table if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create function to get report counts for posts
CREATE OR REPLACE FUNCTION get_post_report_count(post_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM content_reports
        WHERE post_id = post_uuid
        AND status IN ('pending', 'reviewed')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has reported a post
CREATE OR REPLACE FUNCTION has_user_reported_post(post_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM content_reports
        WHERE post_id = post_uuid 
        AND reporter_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON content_reports TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_report_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_reported_post(UUID, UUID) TO authenticated;
