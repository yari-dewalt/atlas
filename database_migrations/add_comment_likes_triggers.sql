-- Add triggers to automatically update comment likes_count when comment_likes are added/removed

-- Function to update comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment the likes count
    UPDATE post_comments 
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement the likes count
    UPDATE post_comments 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for comment_likes table
DROP TRIGGER IF EXISTS increment_comment_likes_count ON comment_likes;
DROP TRIGGER IF EXISTS decrement_comment_likes_count ON comment_likes;

CREATE TRIGGER increment_comment_likes_count
  AFTER INSERT ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_likes_count();

CREATE TRIGGER decrement_comment_likes_count
  AFTER DELETE ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_likes_count();

-- Fix any existing inconsistencies by recalculating likes_count for all comments
UPDATE post_comments 
SET likes_count = (
  SELECT COUNT(*) 
  FROM comment_likes 
  WHERE comment_likes.comment_id = post_comments.id
);
