-- Fix RLS policies for post_comments and comment_likes tables
-- Requirements:
-- 1. Anyone should be able to read comments
-- 2. Users should be able to create their own comments  
-- 3. Owners of comments and post owners should be able to delete comments
-- 4. Everyone should be able to like and dislike comments
-- 5. Owners of comments should be able to edit their comments

-- Enable RLS on both tables
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can view comments" ON post_comments;
DROP POLICY IF EXISTS "Users can view all comments" ON post_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Comment owners and post owners can delete comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;

DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can view all comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can insert their own comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;

-- POST_COMMENTS TABLE POLICIES

-- 1. Anyone can read comments (including non-authenticated users)
CREATE POLICY "Anyone can view comments" ON post_comments
  FOR SELECT USING (true);

-- 2. Users can create their own comments
CREATE POLICY "Users can insert their own comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Users can edit their own comments
CREATE POLICY "Users can update their own comments" ON post_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Comment owners and post owners can delete comments
-- This requires a subquery to check if the current user is the post owner
CREATE POLICY "Comment owners and post owners can delete comments" ON post_comments
  FOR DELETE USING (
    auth.uid() = user_id OR  -- Comment owner can delete
    auth.uid() IN (          -- Post owner can delete
      SELECT posts.user_id 
      FROM posts 
      WHERE posts.id = post_comments.post_id
    )
  );

-- COMMENT_LIKES TABLE POLICIES

-- 1. Anyone can view comment likes (needed for displaying like counts)
CREATE POLICY "Anyone can view comment likes" ON comment_likes
  FOR SELECT USING (true);

-- 2. Users can insert their own likes
CREATE POLICY "Users can insert their own comment likes" ON comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Users can delete their own likes (for unliking)
CREATE POLICY "Users can delete their own comment likes" ON comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ADDITIONAL POLICIES FOR POSTS TABLE (if needed for comment deletion policy)
-- Make sure the posts table has proper RLS policies for the subquery to work

-- Enable RLS on posts table if not already enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Ensure users can view posts (needed for the comment deletion policy subquery)
CREATE POLICY IF NOT EXISTS "Anyone can view posts" ON posts
  FOR SELECT USING (true);

-- Test the policies with some sample queries
-- These are just for reference and don't need to be executed

/*
-- Test comment viewing (should work for everyone)
SELECT * FROM post_comments WHERE post_id = 'some-post-id';

-- Test comment creation (should only work for authenticated users creating their own)
INSERT INTO post_comments (post_id, user_id, text) 
VALUES ('some-post-id', auth.uid(), 'Test comment');

-- Test comment editing (should only work for comment owner)
UPDATE post_comments 
SET text = 'Updated comment' 
WHERE id = 'some-comment-id' AND user_id = auth.uid();

-- Test comment deletion by comment owner
DELETE FROM post_comments 
WHERE id = 'some-comment-id' AND user_id = auth.uid();

-- Test comment deletion by post owner
DELETE FROM post_comments 
WHERE id = 'some-comment-id' 
AND auth.uid() IN (
  SELECT posts.user_id 
  FROM posts 
  WHERE posts.id = post_comments.post_id
);

-- Test comment liking
INSERT INTO comment_likes (comment_id, user_id) 
VALUES ('some-comment-id', auth.uid());

-- Test comment unliking
DELETE FROM comment_likes 
WHERE comment_id = 'some-comment-id' AND user_id = auth.uid();
*/

-- Verify the policies are created correctly
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename IN ('post_comments', 'comment_likes')
ORDER BY tablename, cmd;
