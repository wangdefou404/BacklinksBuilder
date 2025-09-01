-- 更新增强用户角色系统数据库结构
-- 此迁移文件将创建缺失的表并更新现有表结构

-- 1. 更新user_roles表的角色约束，支持新的五种角色
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('free', 'user', 'pro', 'super', 'admin'));

-- 2. 创建订阅计划表（subscription_plans）
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('pro', 'super')),
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    price DECIMAL(10,2) NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入订阅计划初始数据
INSERT INTO subscription_plans (name, role, billing_cycle, price, features) VALUES
('Pro月费会员', 'pro', 'monthly', 29.99, '{"backlink_quota": 1000, "dr_checks": 500, "priority_support": true}'),
('Pro年费会员', 'pro', 'yearly', 299.99, '{"backlink_quota": 12000, "dr_checks": 6000, "priority_support": true, "discount": "2个月免费"}'),
('Super月费会员', 'super', 'monthly', 99.99, '{"backlink_quota": "unlimited", "dr_checks": "unlimited", "priority_support": true, "dedicated_support": true}'),
('Super年费会员', 'super', 'yearly', 999.99, '{"backlink_quota": "unlimited", "dr_checks": "unlimited", "priority_support": true, "dedicated_support": true, "discount": "2个月免费"}')
ON CONFLICT DO NOTHING;

-- 3. 创建用户订阅表（user_subscriptions）
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    payment_method VARCHAR(50),
    stripe_subscription_id VARCHAR(255),
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建额度定义表（quota_definitions）
CREATE TABLE IF NOT EXISTS quota_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('free', 'user', 'pro', 'super', 'admin')),
    default_quota INTEGER NOT NULL,
    reset_cycle VARCHAR(20) NOT NULL CHECK (reset_cycle IN ('daily', 'monthly', 'yearly', 'never')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入额度定义初始数据
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('backlink_generation', 'free', 5, 'daily'),
('backlink_generation', 'user', 50, 'monthly'),
('backlink_generation', 'pro', 1000, 'monthly'),
('backlink_generation', 'super', -1, 'never'),
('dr_checker', 'free', 3, 'daily'),
('dr_checker', 'user', 30, 'monthly'),
('dr_checker', 'pro', 500, 'monthly'),
('dr_checker', 'super', -1, 'never'),
('traffic_checker', 'free', 2, 'daily'),
('traffic_checker', 'user', 20, 'monthly'),
('traffic_checker', 'pro', 200, 'monthly'),
('traffic_checker', 'super', -1, 'never')
ON CONFLICT DO NOTHING;

-- 5. 创建索引
-- subscription_plans索引
CREATE INDEX IF NOT EXISTS idx_subscription_plans_role ON subscription_plans(role);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_billing_cycle ON subscription_plans(billing_cycle);

-- user_subscriptions索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- quota_definitions索引
CREATE INDEX IF NOT EXISTS idx_quota_definitions_role ON quota_definitions(role);
CREATE INDEX IF NOT EXISTS idx_quota_definitions_product_type ON quota_definitions(product_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_definitions_product_role ON quota_definitions(product_type, role);

-- 6. 创建updated_at触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为新表创建updated_at触发器
CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 设置行级安全（RLS）
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_definitions ENABLE ROW LEVEL SECURITY;

-- 8. 创建RLS策略
-- subscription_plans策略（所有人可读，只有管理员可写）
CREATE POLICY "subscription_plans_select_policy" ON subscription_plans
    FOR SELECT USING (true);

CREATE POLICY "subscription_plans_admin_policy" ON subscription_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.is_active = true
        )
    );

-- user_subscriptions策略（用户只能访问自己的订阅）
CREATE POLICY "user_subscriptions_user_policy" ON user_subscriptions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_subscriptions_admin_policy" ON user_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.is_active = true
        )
    );

-- quota_definitions策略（所有人可读，只有管理员可写）
CREATE POLICY "quota_definitions_select_policy" ON quota_definitions
    FOR SELECT USING (true);

CREATE POLICY "quota_definitions_admin_policy" ON quota_definitions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin' 
            AND ur.is_active = true
        )
    );

-- 9. 设置表权限
GRANT SELECT ON subscription_plans TO anon;
GRANT ALL PRIVILEGES ON subscription_plans TO authenticated;

GRANT SELECT ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;

GRANT SELECT ON quota_definitions TO anon;
GRANT ALL PRIVILEGES ON quota_definitions TO authenticated;

-- 10. 为现有用户创建默认角色（如果没有角色记录）
-- 注意：只为确实存在于users表中的用户创建角色
INSERT INTO user_roles (user_id, role, is_active, granted_at)
SELECT 
    u.id,
    'free' as role,
    true as is_active,
    NOW() as granted_at
FROM users u  -- 使用public.users表而不是auth.users
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
WHERE ur.id IS NULL
ON CONFLICT DO NOTHING;

COMMIT;