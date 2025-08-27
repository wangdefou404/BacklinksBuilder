-- 调试用户角色分配问题
-- 查看所有用户的角色分配情况

-- 1. 查看所有用户及其角色
SELECT 
    u.id,
    u.email,
    ur.role,
    ur.is_active,
    ur.granted_at
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ORDER BY u.email;

-- 2. 测试get_user_role函数
SELECT 
    u.email,
    get_user_role(u.id) as function_result,
    ur.role as table_role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ORDER BY u.email;

-- 3. 检查是否有重复的活跃角色
SELECT 
    user_id,
    COUNT(*) as active_roles_count
FROM user_roles 
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 4. 查看所有用户角色记录（包括非活跃的）
SELECT 
    u.email,
    ur.role,
    ur.is_active,
    ur.granted_at,
    ur.created_at
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
ORDER BY u.email, ur.created_at DESC;