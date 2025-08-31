-- 临时将wangpangzier@gmail.com设置为普通用户来测试重定向
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE email = 'wangpangzier@gmail.com';
    
    IF test_user_id IS NOT NULL THEN
        -- 更新users表中的角色为user
        UPDATE users SET role = 'user' WHERE id = test_user_id;
        
        -- 删除现有的user_roles记录
        DELETE FROM user_roles WHERE user_id = test_user_id;
        
        -- 插入普通用户角色
        INSERT INTO user_roles (user_id, role, is_active) 
        VALUES (test_user_id, 'free', true);
        
        RAISE NOTICE 'User % temporarily set to regular user role', 'wangpangzier@gmail.com';
    END IF;
END $$;

-- 验证更改
SELECT 'Verification after role change:' as info;
SELECT u.email, u.role as users_table_role, ur.role as user_roles_table_role, get_user_role(u.id) as function_result
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE u.email = 'wangpangzier@gmail.com';