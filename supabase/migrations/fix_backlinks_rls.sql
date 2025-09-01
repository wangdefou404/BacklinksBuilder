-- Check and fix RLS policies for backlink_resources table

-- First, let's see current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'backlink_resources';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access to guest backlinks" ON backlink_resources;
DROP POLICY IF EXISTS "Allow authenticated read access to all backlinks" ON backlink_resources;
DROP POLICY IF EXISTS "Allow authenticated users to insert backlinks" ON backlink_resources;
DROP POLICY IF EXISTS "Allow users to update their own backlinks" ON backlink_resources;
DROP POLICY IF EXISTS "Allow users to delete their own backlinks" ON backlink_resources;

-- Create new RLS policies
-- Allow anonymous users to read guest backlinks
CREATE POLICY "Allow anonymous read access to guest backlinks" 
ON backlink_resources FOR SELECT 
TO anon 
USING (access_type = 'guest' AND status = 'active');

-- Allow authenticated users to read all backlinks
CREATE POLICY "Allow authenticated read access to all backlinks" 
ON backlink_resources FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to insert backlinks
CREATE POLICY "Allow authenticated users to insert backlinks" 
ON backlink_resources FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow users to update their own backlinks
CREATE POLICY "Allow users to update their own backlinks" 
ON backlink_resources FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own backlinks
CREATE POLICY "Allow users to delete their own backlinks" 
ON backlink_resources FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT ON backlink_resources TO anon;
GRANT ALL PRIVILEGES ON backlink_resources TO authenticated;

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'backlink_resources'
ORDER BY policyname;