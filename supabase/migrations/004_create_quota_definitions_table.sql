-- 创建额度定义表
CREATE TABLE quota_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('free', 'user', 'pro', 'super', 'admin')),
    default_quota INTEGER NOT NULL,
    reset_cycle VARCHAR(20) NOT NULL CHECK (reset_cycle IN ('daily', 'monthly', 'yearly', 'never')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_quota_definitions_role ON quota_definitions(role);
CREATE INDEX idx_quota_definitions_product_type ON quota_definitions(product_type);
CREATE INDEX idx_quota_definitions_is_active ON quota_definitions(is_active);
CREATE UNIQUE INDEX idx_quota_definitions_product_role ON quota_definitions(product_type, role) WHERE is_active = true;

-- 设置表权限
GRANT SELECT ON quota_definitions TO anon;
GRANT ALL PRIVILEGES ON quota_definitions TO authenticated;

-- 为quota_definitions表创建更新时间触发器
CREATE TRIGGER update_quota_definitions_updated_at
    BEFORE UPDATE ON quota_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入初始额度定义数据
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle, description) VALUES
-- 外链生成额度
('backlink_generation', 'free', 5, 'daily', '免费用户每日可生成5个外链'),
('backlink_generation', 'user', 50, 'monthly', '普通用户每月可生成50个外链'),
('backlink_generation', 'pro', 1000, 'monthly', 'Pro用户每月可生成1000个外链'),
('backlink_generation', 'super', -1, 'never', 'Super用户无限制生成外链'),
('backlink_generation', 'admin', -1, 'never', '管理员无限制生成外链'),

-- DR检查额度
('dr_checker', 'free', 3, 'daily', '免费用户每日可检查3个域名DR'),
('dr_checker', 'user', 30, 'monthly', '普通用户每月可检查30个域名DR'),
('dr_checker', 'pro', 500, 'monthly', 'Pro用户每月可检查500个域名DR'),
('dr_checker', 'super', -1, 'never', 'Super用户无限制检查域名DR'),
('dr_checker', 'admin', -1, 'never', '管理员无限制检查域名DR'),

-- 流量检查额度
('traffic_checker', 'free', 2, 'daily', '免费用户每日可检查2个网站流量'),
('traffic_checker', 'user', 20, 'monthly', '普通用户每月可检查20个网站流量'),
('traffic_checker', 'pro', 200, 'monthly', 'Pro用户每月可检查200个网站流量'),
('traffic_checker', 'super', -1, 'never', 'Super用户无限制检查网站流量'),
('traffic_checker', 'admin', -1, 'never', '管理员无限制检查网站流量'),

-- 关键词分析额度
('keyword_analysis', 'free', 1, 'daily', '免费用户每日可分析1个关键词'),
('keyword_analysis', 'user', 10, 'monthly', '普通用户每月可分析10个关键词'),
('keyword_analysis', 'pro', 100, 'monthly', 'Pro用户每月可分析100个关键词'),
('keyword_analysis', 'super', -1, 'never', 'Super用户无限制分析关键词'),
('keyword_analysis', 'admin', -1, 'never', '管理员无限制分析关键词'),

-- 竞争对手分析额度
('competitor_analysis', 'free', 0, 'daily', '免费用户无法使用竞争对手分析'),
('competitor_analysis', 'user', 5, 'monthly', '普通用户每月可分析5个竞争对手'),
('competitor_analysis', 'pro', 50, 'monthly', 'Pro用户每月可分析50个竞争对手'),
('competitor_analysis', 'super', -1, 'never', 'Super用户无限制分析竞争对手'),
('competitor_analysis', 'admin', -1, 'never', '管理员无限制分析竞争对手'),

-- API调用额度
('api_calls', 'free', 0, 'daily', '免费用户无API访问权限'),
('api_calls', 'user', 0, 'daily', '普通用户无API访问权限'),
('api_calls', 'pro', 1000, 'monthly', 'Pro用户每月1000次API调用'),
('api_calls', 'super', 10000, 'monthly', 'Super用户每月10000次API调用'),
('api_calls', 'admin', -1, 'never', '管理员无限制API调用'),

-- 数据导出额度
('data_export', 'free', 0, 'monthly', '免费用户无法导出数据'),
('data_export', 'user', 1, 'monthly', '普通用户每月可导出1次数据'),
('data_export', 'pro', 10, 'monthly', 'Pro用户每月可导出10次数据'),
('data_export', 'super', -1, 'never', 'Super用户无限制导出数据'),
('data_export', 'admin', -1, 'never', '管理员无限制导出数据');

-- 创建函数：获取用户特定产品的额度定义
CREATE OR REPLACE FUNCTION get_user_quota_definition(p_user_id UUID, p_product_type VARCHAR)
RETURNS TABLE(
    product_type VARCHAR,
    role VARCHAR,
    default_quota INTEGER,
    reset_cycle VARCHAR,
    description TEXT
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    -- 获取用户当前角色
    SELECT ur.role INTO user_role
    FROM user_roles ur
    WHERE ur.user_id = p_user_id AND ur.is_active = true
    LIMIT 1;
    
    -- 如果没有找到角色，默认为free
    IF user_role IS NULL THEN
        user_role := 'free';
    END IF;
    
    -- 返回对应的额度定义
    RETURN QUERY
    SELECT qd.product_type, qd.role, qd.default_quota, qd.reset_cycle, qd.description
    FROM quota_definitions qd
    WHERE qd.product_type = p_product_type 
    AND qd.role = user_role 
    AND qd.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取用户所有产品的额度定义
CREATE OR REPLACE FUNCTION get_user_all_quota_definitions(p_user_id UUID)
RETURNS TABLE(
    product_type VARCHAR,
    role VARCHAR,
    default_quota INTEGER,
    reset_cycle VARCHAR,
    description TEXT
) AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    -- 获取用户当前角色
    SELECT ur.role INTO user_role
    FROM user_roles ur
    WHERE ur.user_id = p_user_id AND ur.is_active = true
    LIMIT 1;
    
    -- 如果没有找到角色，默认为free
    IF user_role IS NULL THEN
        user_role := 'free';
    END IF;
    
    -- 返回该角色的所有额度定义
    RETURN QUERY
    SELECT qd.product_type, qd.role, qd.default_quota, qd.reset_cycle, qd.description
    FROM quota_definitions qd
    WHERE qd.role = user_role 
    AND qd.is_active = true
    ORDER BY qd.product_type;
END;
$$ LANGUAGE plpgsql;