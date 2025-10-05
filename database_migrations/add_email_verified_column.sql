-- Add email_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified 
ON public.profiles USING btree (email_verified) 
TABLESPACE pg_default;

-- Update existing users to be verified (since they were created before this system)
-- You can modify this logic based on your needs
UPDATE public.profiles 
SET email_verified = true 
WHERE created_at < NOW(); -- Mark existing users as verified

-- For testing purposes, you can set specific users to unverified:
-- UPDATE public.profiles SET email_verified = false WHERE email = 'test@example.com';
