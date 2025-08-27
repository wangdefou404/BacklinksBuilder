-- 修复get_user_role函数，支持从users表回退获取角色
CREATE OR REPLACE FUNCTION get_user_role(user_id_param UUID)
RETURNS VARCHAR AS $$
DECLARE
    user_role VARCHAR;
    fallback_role VARCHAR;
BEGIN
    -- 首先尝试从user_roles表获取角色
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = user_id_param
      AND is_active = true
    LIMIT 1;
    
    -- 如果在user_roles表中找不到，则从users表获取
    IF user_role IS NULL THEN
        SELECT role INTO fallback_role
        FROM users
        WHERE id = user_id_param;
        
        -- 将users表中的角色映射到新的角色系统
        CASE fallback_role
            WHEN 'admin' THEN user_role := 'admin';
            WHEN 'user' THEN user_role := 'free';
            WHEN 'premium' THEN user_role := 'premium';
            ELSE user_role := 'free';
        END CASE;
    END IF;
    
    RETURN COALESCE(user_role, 'free');
END;
$$ LANGUAGE plpgsql;