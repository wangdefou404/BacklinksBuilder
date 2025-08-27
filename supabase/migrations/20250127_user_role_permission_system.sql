-- 用户角色权限系统数据库迁移文件
-- 创建日期: 2025-01-27
-- 描述: 实现基于角色的用户权限系统，适配现有表结构

-- 1. 创建用户角色表（新增）
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

-- 2. 插入基础权限数据（适配现有permissions表结构，包含display_name）
INSERT INTO permissions (name, display_name, description, module, action) VALUES
('admin.backlinks.manage', '管理外链数据', '管理外链数据', 'backlinks', 'manage'),
('admin.users.manage', '管理用户', '管理用户', 'users', 'manage'),
('admin.analytics.view', '查看系统分析', '查看系统分析', 'analytics', 'view'),
('tools.backlink_generator.use', '使用外链生成器', '使用外链生成器', 'tools', 'use'),
('tools.backlink_generator.advanced', '使用高级外链生成功能', '使用高级外链生成功能', 'tools', 'advanced'),
('tools.traffic_checker.use', '使用流量检查器', '使用流量检查器', 'tools', 'use'),
('tools.traffic_checker.advanced', '使用高级流量分析', '使用高级流量分析', 'tools', 'advanced'),
('tools.dr_checker.use', '使用DR检查器', '使用DR检查器', 'tools', 'use'),
('tools.dr_checker.batch', '批量DR检查', '批量DR检查', 'tools', 'batch'),
('data.export', '导出数据', '导出数据', 'data', 'export'),
('api.access', 'API访问', 'API访问', 'api', 'access'),
('premium.features.access', '访问付费功能', '访问付费功能', 'premium', 'access')
ON CONFLICT (name) DO NOTHING;

-- 3. 设置角色权限关联（适配现有role_permissions表结构）
-- 管理员权限（拥有所有权限）
INSERT INTO role_permissions (role, permission_id, is_granted)
SELECT 'admin', id, true FROM permissions
ON CONFLICT DO NOTHING;

-- 付费用户权限
INSERT INTO role_permissions (role, permission_id, is_granted)
SELECT 'premium', id, true FROM permissions 
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
ON CONFLICT DO NOTHING;

-- 普通用户权限
INSERT INTO role_permissions (role, permission_id, is_granted)
SELECT 'free', id, true FROM permissions 
WHERE name IN (
    'tools.backlink_generator.use',
    'tools.traffic_checker.use',
    'tools.dr_checker.use'
)
ON CONFLICT DO NOTHING;

-- 4. 为现有用户分配默认角色
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

-- 5. 更新现有user_quotas表，添加新的配额类型字段
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS quota_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 0;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS daily_used INTEGER DEFAULT 0;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS reset_daily_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day');
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS reset_monthly_at TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month');

-- 6. 创建权限检查函数
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
          AND rp.is_granted = true
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建获取用户角色函数
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

-- 8. 创建配额检查函数（适配现有user_quotas表结构）
CREATE OR REPLACE FUNCTION check_user_quota(user_id_param UUID, quota_type_param VARCHAR, usage_type VARCHAR DEFAULT 'daily')
RETURNS BOOLEAN AS $$
DECLARE
    quota_limit INTEGER;
    quota_used INTEGER;
    can_use BOOLEAN := false;
BEGIN
    -- 根据配额类型检查不同的字段
    IF quota_type_param = 'dr_checker' THEN
        IF usage_type = 'daily' THEN
            SELECT dr_checks_limit, dr_checks_used INTO quota_limit, quota_used
            FROM user_quotas WHERE user_id = user_id_param;
        ELSE
            SELECT monthly_limit, dr_checks_used INTO quota_limit, quota_used
            FROM user_quotas WHERE user_id = user_id_param;
        END IF;
    ELSIF quota_type_param = 'traffic_checker' THEN
        SELECT traffic_checks_limit, traffic_checks_used INTO quota_limit, quota_used
        FROM user_quotas WHERE user_id = user_id_param;
    ELSIF quota_type_param = 'backlink_generator' THEN
        SELECT backlink_checks_limit, backlink_checks_used INTO quota_limit, quota_used
        FROM user_quotas WHERE user_id = user_id_param;
    END IF;
    
    -- -1 表示无限制
    IF quota_limit = -1 THEN
        can_use := true;
    ELSE
        can_use := (quota_used < quota_limit);
    END IF;
    
    RETURN COALESCE(can_use, false);
END;
$$ LANGUAGE plpgsql;

-- 9. 设置RLS (Row Level Security) 策略
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的角色信息
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有角色信息
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
              AND ur.is_active = true
        )
    );

-- 10. 授予必要的权限
GRANT SELECT ON permissions TO anon, authenticated;
GRANT SELECT ON role_permissions TO anon, authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON user_quotas TO authenticated;

-- 管理员可以管理角色和权限
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_quotas TO authenticated;

COMMIT;