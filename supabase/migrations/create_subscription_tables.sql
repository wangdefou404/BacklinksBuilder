-- 创建订阅计划表
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_annual DECIMAL(10,2) NOT NULL,
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_annual VARCHAR(100),
    dr_checks_limit INTEGER NOT NULL DEFAULT 0,
    traffic_checks_limit INTEGER NOT NULL DEFAULT 0,
    backlink_checks_limit INTEGER NOT NULL DEFAULT 0,
    backlink_views_limit INTEGER NOT NULL DEFAULT 0,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户配额表
CREATE TABLE IF NOT EXISTS user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    dr_checks_used INTEGER DEFAULT 0,
    dr_checks_limit INTEGER DEFAULT 10,
    traffic_checks_used INTEGER DEFAULT 0,
    traffic_checks_limit INTEGER DEFAULT 10,
    backlink_checks_used INTEGER DEFAULT 0,
    backlink_checks_limit INTEGER DEFAULT 10,
    backlink_views_used INTEGER DEFAULT 0,
    backlink_views_limit INTEGER DEFAULT 50,
    reset_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 插入默认订阅计划
INSERT INTO plans (name, display_name, description, price_monthly, price_annual, dr_checks_limit, traffic_checks_limit, backlink_checks_limit, backlink_views_limit, features) VALUES
('free', 'Free Plan', '免费计划，适合个人用户试用', 0.00, 0.00, 10, 10, 10, 50, '["基础查询功能", "有限次数使用"]'),
('pro', 'Pro Plan', 'Pro计划，适合专业用户', 29.99, 299.99, 1000, 1000, 1000, 999999, '["无限反链查看", "数据导出功能", "优先支持"]'),
('super', 'SuperPro Plan', 'SuperPro计划，适合企业用户', 99.99, 999.99, 5000, 5000, 5000, 999999, '["无限反链查看", "数据导出功能", "优先支持", "早期功能访问", "API访问"]')
ON CONFLICT (name) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- 启用行级安全策略
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- Plans表：所有用户都可以读取计划信息
CREATE POLICY "Plans are viewable by everyone" ON plans
    FOR SELECT USING (true);

-- User_quotas表：用户只能查看和更新自己的配额
CREATE POLICY "Users can view own quotas" ON user_quotas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quotas" ON user_quotas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all quotas" ON user_quotas
    FOR ALL USING (auth.role() = 'service_role');

-- 创建触发器函数来自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为plans表创建触发器
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为user_quotas表创建触发器
CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON user_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数来初始化新用户的配额
CREATE OR REPLACE FUNCTION initialize_user_quota()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_quotas (user_id, plan_id)
    SELECT NEW.id, plans.id
    FROM plans
    WHERE plans.name = 'free'
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为auth.users表创建触发器，自动为新用户创建配额记录
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION initialize_user_quota();