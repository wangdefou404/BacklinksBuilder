-- Enhanced User Role System Migration
-- Creates tables for user roles, subscription plans, user subscriptions, user quotas, and quota definitions

-- 1. 创建用户角色表（user_roles）
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('free', 'user', 'pro', 'super', 'admin')),
    is_active BOOLEAN DEFAULT true,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户角色表索引
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE UNIQUE INDEX idx_user_roles_active_unique ON user_roles(user_id) WHERE is_active = true;

-- 2. 创建订阅计划表（subscription_plans）
CREATE TABLE subscription_plans (
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
('Super年费会员', 'super', 'yearly', 999.99, '{"backlink_quota": "unlimited", "dr_checks": "unlimited", "priority_support": true, "dedicated_support": true, "discount": "2个月免费"}');

-- 3. 创建用户订阅表（user_subscriptions）
CREATE TABLE user_subscriptions (
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

-- 创建用户订阅表索引
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- 4. 创建用户额度表（user_quotas）
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    total_quota INTEGER NOT NULL DEFAULT 0,
    used_quota INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户额度表索引
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_product_type ON user_quotas(product_type);
CREATE UNIQUE INDEX idx_user_quotas_user_product ON user_quotas(user_id, product_type);

-- 5. 创建额度定义表（quota_definitions）
CREATE TABLE quota_definitions (
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
('traffic_checker', 'super', -1, 'never');

-- 创建额度定义表索引
CREATE INDEX idx_quota_definitions_role ON quota_definitions(role);
CREATE INDEX idx_quota_definitions_product_type ON quota_definitions(product_type);
CREATE UNIQUE INDEX idx_quota_definitions_product_role ON quota_definitions(product_type, role);

-- 6. 设置表权限
-- 用户角色表权限
GRANT SELECT ON user_roles TO anon;
GRANT ALL PRIVILEGES ON user_roles TO authenticated;

-- 订阅计划表权限
GRANT SELECT ON subscription_plans TO anon;
GRANT ALL PRIVILEGES ON subscription_plans TO authenticated;

-- 用户订阅表权限
GRANT SELECT ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;

-- 用户额度表权限
GRANT SELECT ON user_quotas TO anon;
GRANT ALL PRIVILEGES ON user_quotas TO authenticated;

-- 额度定义表权限
GRANT SELECT ON quota_definitions TO anon;
GRANT ALL PRIVILEGES ON quota_definitions TO authenticated;

-- 7. 创建触发器函数用于自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表创建触发器
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON user_quotas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 创建RLS策略
-- 启用RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_definitions ENABLE ROW LEVEL SECURITY;

-- 用户角色表RLS策略
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own roles" ON user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own roles" ON user_roles FOR UPDATE USING (auth.uid() = user_id);

-- 订阅计划表RLS策略（所有人可查看）
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans FOR SELECT USING (true);

-- 用户订阅表RLS策略
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions" ON user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions" ON user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- 用户额度表RLS策略
CREATE POLICY "Users can view their own quotas" ON user_quotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own quotas" ON user_quotas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own quotas" ON user_quotas FOR UPDATE USING (auth.uid() = user_id);

-- 额度定义表RLS策略（所有人可查看）
CREATE POLICY "Anyone can view quota definitions" ON quota_definitions FOR SELECT USING (true);