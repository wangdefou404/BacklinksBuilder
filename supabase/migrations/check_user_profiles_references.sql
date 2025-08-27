-- Check for any remaining references to user_profiles

-- Check for triggers that might reference user_profiles
SELECT 
    trigger_name, 
    event_object_table, 
    action_statement 
FROM information_schema.triggers 
WHERE action_statement LIKE '%user_profiles%';

-- Check for functions that might reference user_profiles
SELECT 
    routine_name, 
    routine_definition 
FROM information_schema.routines 
WHERE routine_definition LIKE '%user_profiles%' 
    AND routine_type = 'FUNCTION';

-- Check for views that might reference user_profiles
SELECT 
    table_name, 
    view_definition 
FROM information_schema.views 
WHERE view_definition LIKE '%user_profiles%';

-- Check for any remaining policies on user_profiles (should be empty)
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';