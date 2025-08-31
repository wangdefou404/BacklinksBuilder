-- 检查用户角色设置的调试脚本

-- 1. 查看 wangpangzier@gmail.com 的用户信息
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'wangpangzier@gmail.com';

-- 2. 查看该用户在 user_roles 表中的角色设置
SELECT 
    ur.id,
    ur.user_id,
    ur.role,
    ur.granted_at,
    ur.granted_by,
    ur.expires_at,
    ur.is_active,
    ur.created_at,
    ur.updated_at,
    u.email
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'wangpangzier@gmail.com';

-- 3. 测试 get_user_role 函数
SELECT get_user_role(
    (SELECT id FROM auth.users WHERE email = 'wangpangzier@gmail.com')
) as user_role_result;

-- 4. 查看所有用户的角色分布
SELECT 
    ur.role,
    COUNT(*) as count,
    array_agg(u.email) as users
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE ur.is_active = true
GROUP BY ur.role
ORDER BY ur.role;

-- 5. 检查 get_user_role 函数的定义
SELECT 
    proname as function_name,
    prosrc as function_body,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'get_user_role';