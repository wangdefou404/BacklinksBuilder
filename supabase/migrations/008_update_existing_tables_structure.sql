-- 更新现有表结构以符合技术架构文档要求
-- 此迁移文件将调整现有表结构，使其与增强用户角色系统架构保持一致

-- 1. 更新 user_quotas 表结构
-- 添加缺失的字段并调整现有结构
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_quota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_quota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reset_cycle VARCHAR(20) DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS next_reset_at TIMESTAMP WITH TIME ZONE;

-- 创建新的索引
CREATE INDEX IF NOT EXISTS idx_user_quotas_product_type ON user_quotas(product_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quotas_user_product ON user_quotas(user_id, product_type) WHERE product_type IS NOT NULL;

-- 2. 更新 subscription_plans 表，添加缺失字段
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 subscription_plans 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. 更新 user_subscriptions 表，添加缺失字段
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 为 user_subscriptions 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. 为 user_roles 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. 为 user_quotas 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON user_quotas;
CREATE TRIGGER update_user_quotas_updated_at
    BEFORE UPDATE ON user_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 更新 subscription_plans 表的初始数据
-- 首先清空现有数据（如果需要）
TRUNCATE TABLE subscription_plans RESTART IDENTITY CASCADE;

-- 插入新的订阅计划数据
INSERT INTO subscription_plans (name, display_name, role, billing_cycle, price, features, description, is_active) VALUES
('pro_monthly', 'Pro月费会员', 'pro', 'monthly', 29.99, 
 '{"backlink_quota": 1000, "dr_checks": 500, "traffic_checks": 200, "priority_support": true}', 
 'Pro月费会员，享受更多额度和优先支持', true),
('pro_yearly', 'Pro年费会员', 'pro', 'yearly', 299.99, 
 '{"backlink_quota": 12000, "dr_checks": 6000, "traffic_checks": 2400, "priority_support": true, "discount": "2个月免费"}', 
 'Pro年费会员，享受更多额度、优先支持和2个月免费', true),
('super_monthly', 'Super月费会员', 'super', 'monthly', 99.99, 
 '{"backlink_quota": "unlimited", "dr_checks": "unlimited", "traffic_checks": "unlimited", "priority_support": true, "dedicated_support": true}', 
 'Super月费会员，无限额度和专属支持', true),
('super_yearly', 'Super年费会员', 'super', 'yearly', 999.99, 
 '{"backlink_quota": "unlimited", "dr_checks": "unlimited", "traffic_checks": "unlimited", "priority_support": true, "dedicated_support": true, "discount": "2个月免费"}', 
 'Super年费会员，无限额度、专属支持和2个月免费', true);

-- 7. 更新 quota_definitions 表的初始数据
-- 首先清空现有数据
TRUNCATE TABLE quota_definitions RESTART IDENTITY;

-- 插入新的额度定义数据
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
-- 外链生成额度
('backlink_generation', 'free', 5, 'daily'),
('backlink_generation', 'user', 50, 'monthly'),
('backlink_generation', 'pro', 1000, 'monthly'),
('backlink_generation', 'super', -1, 'never'),
('backlink_generation', 'admin', -1, 'never'),

-- DR检查额度
('dr_checker', 'free', 3, 'daily'),
('dr_checker', 'user', 30, 'monthly'),
('dr_checker', 'pro', 500, 'monthly'),
('dr_checker', 'super', -1, 'never'),
('dr_checker', 'admin', -1, 'never'),

-- 流量检查额度
('traffic_checker', 'free', 2, 'daily'),
('traffic_checker', 'user', 20, 'monthly'),
('traffic_checker', 'pro', 200, 'monthly'),
('traffic_checker', 'super', -1, 'never'),
('traffic_checker', 'admin', -1, 'never'),

-- 关键词分析额度
('keyword_analysis', 'free', 1, 'daily'),
('keyword_analysis', 'user', 10, 'monthly'),
('keyword_analysis', 'pro', 100, 'monthly'),
('keyword_analysis', 'super', -1, 'never'),
('keyword_analysis', 'admin', -1, 'never'),

-- 竞争对手分析额度
('competitor_analysis', 'free', 1, 'daily'),
('competitor_analysis', 'user', 5, 'monthly'),
('competitor_analysis', 'pro', 50, 'monthly'),
('competitor_analysis', 'super', -1, 'never'),
('competitor_analysis', 'admin', -1, 'never'),

-- API调用额度
('api_calls', 'free', 100, 'daily'),
('api_calls', 'user', 1000, 'monthly'),
('api_calls', 'pro', 10000, 'monthly'),
('api_calls', 'super', -1, 'never'),
('api_calls', 'admin', -1, 'never'),

-- 数据导出额度
('data_export', 'free', 1, 'daily'),
('data_export', 'user', 10, 'monthly'),
('data_export', 'pro', 100, 'monthly'),
('data_export', 'super', -1, 'never'),
('data_export', 'admin', -1, 'never');

-- 8. 创建辅助函数

-- 获取用户当前活跃角色
CREATE OR REPLACE FUNCTION get_user_active_role(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = p_user_id 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE role
            WHEN 'admin' THEN 5
            WHEN 'super' THEN 4
            WHEN 'pro' THEN 3
            WHEN 'user' THEN 2
            WHEN 'free' THEN 1
            ELSE 0
        END DESC
    LIMIT 1;
    
    RETURN COALESCE(user_role, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户特定产品的额度定义
CREATE OR REPLACE FUNCTION get_user_quota_definition(p_user_id UUID, p_product_type VARCHAR)
RETURNS TABLE(
    product_type VARCHAR,
    role VARCHAR,
    default_quota INTEGER,
    reset_cycle VARCHAR
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    -- 获取用户当前活跃角色
    user_role := get_user_active_role(p_user_id);
    
    -- 返回对应的额度定义
    RETURN QUERY
    SELECT qd.product_type, qd.role, qd.default_quota, qd.reset_cycle
    FROM quota_definitions qd
    WHERE qd.product_type = p_product_type 
      AND qd.role = user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户所有产品的额度定义
CREATE OR REPLACE FUNCTION get_user_all_quota_definitions(p_user_id UUID)
RETURNS TABLE(
    product_type VARCHAR,
    role VARCHAR,
    default_quota INTEGER,
    reset_cycle VARCHAR
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    -- 获取用户当前活跃角色
    user_role := get_user_active_role(p_user_id);
    
    -- 返回所有产品的额度定义
    RETURN QUERY
    SELECT qd.product_type, qd.role, qd.default_quota, qd.reset_cycle
    FROM quota_definitions qd
    WHERE qd.role = user_role
    ORDER BY qd.product_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 权限设置
-- 确保所有表都有正确的权限设置
GRANT SELECT ON user_roles TO anon;
GRANT ALL PRIVILEGES ON user_roles TO authenticated;

GRANT SELECT ON subscription_plans TO anon;
GRANT ALL PRIVILEGES ON subscription_plans TO authenticated;

GRANT SELECT ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;

GRANT SELECT ON user_quotas TO anon;
GRANT ALL PRIVILEGES ON user_quotas TO authenticated;

GRANT SELECT ON quota_definitions TO anon;
GRANT ALL PRIVILEGES ON quota_definitions TO authenticated;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_user_active_role(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_quota_definition(UUID, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_all_quota_definitions(UUID) TO anon, authenticated;

-- 10. 注释
COMMENT ON TABLE user_roles IS '用户角色表，支持五种角色：free, user, pro, super, admin';
COMMENT ON TABLE subscription_plans IS '订阅计划表，定义不同的付费计划';
COMMENT ON TABLE user_subscriptions IS '用户订阅表，记录用户的订阅状态';
COMMENT ON TABLE user_quotas IS '用户额度表，记录用户各产品的额度使用情况';
COMMENT ON TABLE quota_definitions IS '额度定义表，定义不同角色的默认额度';

COMMENT ON FUNCTION get_user_active_role(UUID) IS '获取用户当前活跃角色';
COMMENT ON FUNCTION get_user_quota_definition(UUID, VARCHAR) IS '获取用户特定产品的额度定义';
COMMENT ON FUNCTION get_user_all_quota_definitions(UUID) IS '获取用户所有产品的额度定义';