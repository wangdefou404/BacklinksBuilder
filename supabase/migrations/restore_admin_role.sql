-- 恢复wangpangzier@gmail.com为管理员角色
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE email = 'wangpangzier@gmail.com';
    
    IF admin_user_id IS NOT NULL THEN
        -- 更新users表中的角色为admin
        UPDATE users SET role = 'admin' WHERE id = admin_user_id;
        
        -- 删除现有的user_roles记录
        DELETE FROM user_roles WHERE user_id = admin_user_id;
        
        -- 插入管理员角色
        INSERT INTO user_roles (user_id, role, is_active) 
        VALUES (admin_user_id, 'admin', true);
        
        RAISE NOTICE 'User % restored to admin role', 'wangpangzier@gmail.com';
    END IF;
END $$;

-- 验证恢复
SELECT 'Verification after role restoration:' as info;
SELECT u.email, u.role as users_table_role, ur.role as user_roles_table_role, get_user_role(u.id) as function_result
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE u.email = 'wangpangzier@gmail.com';