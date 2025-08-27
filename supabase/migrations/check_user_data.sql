-- 检查用户数据和角色分配
SELECT 
    u.id,
    u.email,
    u.role as user_table_role,
    u.provider,
    u.created_at,
    ur.role as user_roles_table_role,
    ur.granted_at,
    ur.granted_by
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email IN ('wangpangzier@gmail.com', 'wangdefou404@gmail.com')
ORDER BY u.email;

-- 检查所有用户的角色分配
SELECT 
    u.email,
    u.role as user_table_role,
    ur.role as user_roles_table_role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY u.email;