-- 检查当前用户和角色状态
SELECT 'Current users in users table:' as info;
SELECT id, email, role as users_table_role, name, provider FROM users;

SELECT 'Current roles in user_roles table:' as info;
SELECT ur.user_id, u.email, ur.role as user_roles_table_role, ur.is_active, ur.granted_at 
FROM user_roles ur 
JOIN users u ON ur.user_id = u.id;

SELECT 'Testing get_user_role function:' as info;
SELECT email, get_user_role(id) as function_result FROM users;

-- 检查users表的约束
SELECT 'Checking table constraints:' as info;
SELECT conname, pg_get_constraintdef(oid) as constraint_def 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;

SELECT 'Final verification - current state:' as info;
SELECT u.email, u.role as users_table_role, ur.role as user_roles_table_role, get_user_role(u.id) as function_result
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ORDER BY u.email;