-- 用户角色权限系统数据库迁移文件
-- 创建日期: 2025-01-27
-- 描述: 实现基于角色的用户权限系统

-- 1. 创建权限表
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建权限表索引
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- 2. 创建用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (role IN ('admin', 'premium', 'free')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户角色表索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- 确保每个用户只有一个活跃角色
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_active 
ON user_roles(user_id) 
WHERE is_active = true;

-- 3. 创建角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'premium', 'free')),
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建角色权限关联表索引
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- 确保角色-权限组合唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique 
ON role_permissions(role, permission_id);

-- 4. 更新用户配额表（如果存在则修改，不存在则创建）
DROP TABLE IF EXISTS user_quotas;
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,
    daily_limit INTEGER DEFAULT 0,
    monthly_limit INTEGER DEFAULT 0,
    daily_used INTEGER DEFAULT 0,
    monthly_used INTEGER DEFAULT 0,
    reset_daily_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    reset_monthly_at TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户配额表索引
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_type ON user_quotas(quota_type);

-- 确保用户-配额类型组合唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quotas_unique 
ON user_quotas(user_id, quota_type);

-- 5. 插入基础权限数据
INSERT INTO permissions (name, description, module, action) VALUES
('admin.backlinks.manage', '管理外链数据', 'backlinks', 'manage'),
('admin.users.manage', '管理用户', 'users', 'manage'),
('admin.analytics.view', '查看系统分析', 'analytics', 'view'),
('tools.backlink_generator.use', '使用外链生成器', 'tools', 'use'),
('tools.backlink_generator.advanced', '使用高级外链生成功能', 'tools', 'advanced'),
('tools.traffic_checker.use', '使用流量检查器', 'tools', 'use'),
('tools.traffic_checker.advanced', '使用高级流量分析', 'tools', 'advanced'),
('tools.dr_checker.use', '使用DR检查器', 'tools', 'use'),
('tools.dr_checker.batch', '批量DR检查', 'tools', 'batch'),
('data.export', '导出数据', 'data', 'export'),
('api.access', 'API访问', 'api', 'access'),
('premium.features.access', '访问付费功能', 'premium', 'access')
ON CONFLICT (name) DO NOTHING;

-- 6. 设置角色权限关联
-- 管理员权限（拥有所有权限）
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 付费用户权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'premium', id FROM permissions 
WHERE name IN (
    'tools.backlink_generator.use',
    'tools.backlink_generator.advanced',
    'tools.traffic_checker.use',
    'tools.traffic_checker.advanced',
    'tools.dr_checker.use',
    'tools.dr_checker.batch',
    'data.export',
    'api.access',
    'premium.features.access'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 普通用户权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'free', id FROM permissions 
WHERE name IN (
    'tools.backlink_generator.use',
    'tools.traffic_checker.use',
    'tools.dr_checker.use'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 7. 为现有用户分配默认角色
-- 为特定管理员邮箱分配管理员角色
INSERT INTO user_roles (user_id, role, granted_at, is_active)
SELECT id, 'admin', NOW(), true
FROM users 
WHERE email = 'wangpangzier@gmail.com'
ON CONFLICT DO NOTHING;

-- 为其他现有用户分配普通用户角色
INSERT INTO user_roles (user_id, role, granted_at, is_active)
SELECT id, 'free', NOW(), true
FROM users 
WHERE email != 'wangpangzier@gmail.com'
  AND id NOT IN (SELECT user_id FROM user_roles WHERE is_active = true)
ON CONFLICT DO NOTHING;

-- 8. 为用户创建默认配额
-- DR检查配额
INSERT INTO user_quotas (user_id, quota_type, daily_limit, monthly_limit)
SELECT 
    u.id,
    'dr_checker',
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 100
        ELSE 10  -- 普通用户每日10次
    END,
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 3000
        ELSE 300  -- 普通用户每月300次
    END
FROM users u
JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ON CONFLICT (user_id, quota_type) DO NOTHING;

-- 外链生成配额
INSERT INTO user_quotas (user_id, quota_type, daily_limit, monthly_limit)
SELECT 
    u.id,
    'backlink_generator',
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 50
        ELSE 5  -- 普通用户每日5次
    END,
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 1500
        ELSE 150  -- 普通用户每月150次
    END
FROM users u
JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ON CONFLICT (user_id, quota_type) DO NOTHING;

-- 流量检查配额
INSERT INTO user_quotas (user_id, quota_type, daily_limit, monthly_limit)
SELECT 
    u.id,
    'traffic_checker',
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 200
        ELSE 20  -- 普通用户每日20次
    END,
    CASE 
        WHEN ur.role = 'admin' THEN -1  -- 无限制
        WHEN ur.role = 'premium' THEN 6000
        ELSE 600  -- 普通用户每月600次
    END
FROM users u
JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
ON CONFLICT (user_id, quota_type) DO NOTHING;

-- 9. 创建权限检查函数
CREATE OR REPLACE FUNCTION check_user_permission(user_id_param UUID, permission_name_param VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role = rp.role
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id_param
          AND ur.is_active = true
          AND p.name = permission_name_param
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- 10. 创建获取用户角色函数
CREATE OR REPLACE FUNCTION get_user_role(user_id_param UUID)
RETURNS VARCHAR AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = user_id_param
      AND is_active = true
    LIMIT 1;
    
    RETURN COALESCE(user_role, 'free');
END;
$$ LANGUAGE plpgsql;

-- 11. 创建配额检查函数
CREATE OR REPLACE FUNCTION check_user_quota(user_id_param UUID, quota_type_param VARCHAR, usage_type VARCHAR DEFAULT 'daily')
RETURNS BOOLEAN AS $$
DECLARE
    quota_limit INTEGER;
    quota_used INTEGER;
    can_use BOOLEAN := false;
BEGIN
    IF usage_type = 'daily' THEN
        SELECT daily_limit, daily_used INTO quota_limit, quota_used
        FROM user_quotas
        WHERE user_id = user_id_param AND quota_type = quota_type_param;
    ELSE
        SELECT monthly_limit, monthly_used INTO quota_limit, quota_used
        FROM user_quotas
        WHERE user_id = user_id_param AND quota_type = quota_type_param;
    END IF;
    
    -- -1 表示无限制
    IF quota_limit = -1 THEN
        can_use := true;
    ELSE
        can_use := (quota_used < quota_limit);
    END IF;
    
    RETURN can_use;
END;
$$ LANGUAGE plpgsql;

-- 12. 设置RLS (Row Level Security) 策略
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的角色信息
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有角色信息
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
              AND ur.is_active = true
        )
    );

-- 用户只能查看自己的配额信息
CREATE POLICY "Users can view own quotas" ON user_quotas
    FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有配额信息
CREATE POLICY "Admins can view all quotas" ON user_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
              AND ur.is_active = true
        )
    );

-- 13. 授予必要的权限
GRANT SELECT ON permissions TO anon, authenticated;
GRANT SELECT ON role_permissions TO anon, authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON user_quotas TO authenticated;

-- 管理员可以管理角色和权限
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_quotas TO authenticated;

COMMIT;