-- 检查和修复用户角色问题

-- 1. 删除现有的get_user_role函数（如果存在）
DROP FUNCTION IF EXISTS get_user_role(UUID);

-- 2. 查看所有用户信息
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email LIKE '%wangpangzier%' OR email LIKE '%gmail%'
ORDER BY created_at DESC;

-- 3. 查看用户角色表中的所有数据
SELECT 
    ur.id,
    ur.user_id,
    ur.role,
    ur.is_active,
    ur.granted_at,
    u.email
FROM user_roles ur
LEFT JOIN auth.users u ON ur.user_id = u.id
ORDER BY ur.created_at DESC;

-- 4. 重新创建get_user_role函数
CREATE OR REPLACE FUNCTION get_user_role(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- 从user_roles表获取用户角色
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = user_id_param
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY granted_at DESC
    LIMIT 1;
    
    -- 如果没有找到角色，返回默认角色
    IF user_role IS NULL THEN
        user_role := 'free';
    END IF;
    
    RETURN user_role;
END;
$$;

-- 5. 确保wangpangzier@gmail.com用户有管理员角色
DO $$
DECLARE
    target_user_id UUID;
    existing_role_id UUID;
BEGIN
    -- 获取用户ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'wangpangzier@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- 检查是否已有角色记录
        SELECT id INTO existing_role_id
        FROM user_roles
        WHERE user_id = target_user_id;
        
        IF existing_role_id IS NOT NULL THEN
            -- 更新现有角色为admin
            UPDATE user_roles
            SET role = 'admin',
                is_active = true,
                updated_at = NOW()
            WHERE user_id = target_user_id;
            
            RAISE NOTICE 'Updated existing role for user % to admin', target_user_id;
        ELSE
            -- 插入新的管理员角色
            INSERT INTO user_roles (user_id, role, is_active)
            VALUES (target_user_id, 'admin', true);
            
            RAISE NOTICE 'Created new admin role for user %', target_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'User wangpangzier@gmail.com not found in auth.users table';
    END IF;
END;
$$;

-- 6. 验证修复结果
SELECT 
    u.email,
    ur.role,
    ur.is_active,
    ur.granted_at,
    get_user_role(u.id) as function_result
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'wangpangzier@gmail.com';

-- 7. 检查权限设置
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 8. 确保权限正确设置
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON user_roles TO anon;