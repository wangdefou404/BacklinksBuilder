-- 创建订阅计划表
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('pro', 'super')),
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    price DECIMAL(10,2) NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_subscription_plans_role ON subscription_plans(role);
CREATE INDEX idx_subscription_plans_billing_cycle ON subscription_plans(billing_cycle);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE UNIQUE INDEX idx_subscription_plans_name ON subscription_plans(name);

-- 设置表权限
GRANT SELECT ON subscription_plans TO anon;
GRANT ALL PRIVILEGES ON subscription_plans TO authenticated;

-- 为subscription_plans表创建更新时间触发器
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入初始订阅计划数据
INSERT INTO subscription_plans (name, display_name, role, billing_cycle, price, features, description) VALUES
('pro_monthly', 'Pro月费会员', 'pro', 'monthly', 29.99, 
 '{
   "backlink_quota": 1000,
   "dr_checks": 500,
   "traffic_checks": 200,
   "priority_support": true,
   "advanced_analytics": true,
   "export_data": true
 }', 
 'Pro月费会员，适合中小型企业和专业用户'),

('pro_yearly', 'Pro年费会员', 'pro', 'yearly', 299.99, 
 '{
   "backlink_quota": 12000,
   "dr_checks": 6000,
   "traffic_checks": 2400,
   "priority_support": true,
   "advanced_analytics": true,
   "export_data": true,
   "discount": "2个月免费"
 }', 
 'Pro年费会员，享受2个月免费优惠'),

('super_monthly', 'Super月费会员', 'super', 'monthly', 99.99, 
 '{
   "backlink_quota": "unlimited",
   "dr_checks": "unlimited",
   "traffic_checks": "unlimited",
   "priority_support": true,
   "dedicated_support": true,
   "advanced_analytics": true,
   "export_data": true,
   "api_access": true,
   "white_label": true
 }', 
 'Super月费会员，无限制使用所有功能'),

('super_yearly', 'Super年费会员', 'super', 'yearly', 999.99, 
 '{
   "backlink_quota": "unlimited",
   "dr_checks": "unlimited",
   "traffic_checks": "unlimited",
   "priority_support": true,
   "dedicated_support": true,
   "advanced_analytics": true,
   "export_data": true,
   "api_access": true,
   "white_label": true,
   "discount": "2个月免费"
 }', 
 'Super年费会员，享受2个月免费优惠，企业级服务');