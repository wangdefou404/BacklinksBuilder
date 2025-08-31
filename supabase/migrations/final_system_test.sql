-- 最终系统测试：验证角色系统完整性

-- 1. 检查当前用户状态
SELECT '=== Current User Status ===' as info;
SELECT 
    u.email,
    u.role as users_table_role,
    ur.role as user_roles_table_role,
    ur.is_active,
    get_user_role(u.id) as function_result
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE u.email = 'wangpangzier@gmail.com';

-- 2. 测试角色切换功能
SELECT '=== Testing Role Switch ===' as info;

-- 临时切换到普通用户
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE email = 'wangpangzier@gmail.com';
    
    IF test_user_id IS NOT NULL THEN
        -- 更新为普通用户
        UPDATE users SET role = 'user' WHERE id = test_user_id;
        DELETE FROM user_roles WHERE user_id = test_user_id;
        INSERT INTO user_roles (user_id, role, is_active) VALUES (test_user_id, 'free', true);
        
        RAISE NOTICE 'Temporarily switched to free user';
    END IF;
END $$;

-- 验证切换结果
SELECT 
    u.email,
    u.role as users_table_role,
    ur.role as user_roles_table_role,
    get_user_role(u.id) as function_result
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE u.email = 'wangpangzier@gmail.com';

-- 等待5秒（模拟用户操作）
SELECT pg_sleep(2);

-- 恢复为管理员
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE email = 'wangpangzier@gmail.com';
    
    IF test_user_id IS NOT NULL THEN
        -- 恢复为管理员
        UPDATE users SET role = 'admin' WHERE id = test_user_id;
        DELETE FROM user_roles WHERE user_id = test_user_id;
        INSERT INTO user_roles (user_id, role, is_active) VALUES (test_user_id, 'admin', true);
        
        RAISE NOTICE 'Restored to admin user';
    END IF;
END $$;

-- 最终验证
SELECT '=== Final Verification ===' as info;
SELECT 
    u.email,
    u.role as users_table_role,
    ur.role as user_roles_table_role,
    get_user_role(u.id) as function_result,
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN '✅ Admin access granted'
        ELSE '❌ Admin access denied'
    END as access_status
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE u.email = 'wangpangzier@gmail.com';

SELECT '=== System Test Complete ===' as info;