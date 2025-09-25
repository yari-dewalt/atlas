-- Quick fix for comments RLS policies
-- Run this if you need a simpler approach or want to apply policies one by one

-- 1. Enable RLS on both tables
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 2. Clear all existing comment policies
DROP POLICY IF EXISTS "Anyone can view comments" ON post_comments;
DROP POLICY IF EXISTS "Users can view all comments" ON post_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Comment owners and post owners can delete comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;
DROP POLICY IF EXISTS "Allow comment access" ON post_comments;

-- 3. Clear all existing comment likes policies  
DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can view all comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can insert their own comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Allow comment likes access" ON comment_likes;

-- 4. Create new comment policies
CREATE POLICY "Anyone can view comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Comment owners and post owners can delete comments" ON post_comments FOR DELETE USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT posts.user_id FROM posts WHERE posts.id = post_comments.post_id)
);

-- 5. Create new comment likes policies
CREATE POLICY "Anyone can view comment likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comment likes" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comment likes" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 6. Ensure posts can be viewed (needed for comment deletion policy)
CREATE POLICY IF NOT EXISTS "Anyone can view posts" ON posts FOR SELECT USING (true);
