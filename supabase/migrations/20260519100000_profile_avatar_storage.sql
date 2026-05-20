-- ==============================================================================
-- WHATSFLOW AI — PROFILE AVATAR STORAGE PROVISIONING
-- File: 20260519100000_profile_avatar_storage.sql
-- Description: Provision a public 'avatars' storage bucket with strict user-isolated
--              upload, update, and delete access controls.
-- Safe to re-run (uses DROP/CREATE IF NOT EXISTS guards)
-- ==============================================================================

BEGIN;

-- 1. Create public 'avatars' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if any to avoid collisions
DROP POLICY IF EXISTS "Avatar Images Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Images User Isolation Insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Images User Isolation Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Images User Isolation Delete" ON storage.objects;

-- 3. Establish strict RLS storage policies

-- Allow anyone to read profile images since they are public avatars
CREATE POLICY "Avatar Images Public Read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files only under their own user ID folder
CREATE POLICY "Avatar Images User Isolation Insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update files only under their own user ID folder
CREATE POLICY "Avatar Images User Isolation Update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete files only under their own user ID folder
CREATE POLICY "Avatar Images User Isolation Delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

COMMIT;
