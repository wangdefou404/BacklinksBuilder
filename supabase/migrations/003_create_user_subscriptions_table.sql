-- 创建用户订阅表
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending', 'past_due')),
    payment_method VARCHAR(50),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);

-- 设置表权限
GRANT SELECT ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;

-- 为user_subscriptions表创建更新时间触发器
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：自动更新用户角色基于订阅状态
CREATE OR REPLACE FUNCTION update_user_role_from_subscription()
RETURNS TRIGGER AS $$
DECLARE
    plan_role VARCHAR(20);
BEGIN
    -- 获取订阅计划对应的角色
    SELECT role INTO plan_role
    FROM subscription_plans
    WHERE id = NEW.plan_id;
    
    -- 如果订阅激活，更新用户角色
    IF NEW.status = 'active' THEN
        -- 先将该用户的其他角色设为非激活
        UPDATE user_roles 
        SET is_active = false 
        WHERE user_id = NEW.user_id AND is_active = true;
        
        -- 插入或更新新角色
        INSERT INTO user_roles (user_id, role, is_active, granted_at, expires_at)
        VALUES (NEW.user_id, plan_role, true, NOW(), NEW.expires_at)
        ON CONFLICT (user_id) WHERE is_active = true
        DO UPDATE SET 
            role = plan_role,
            granted_at = NOW(),
            expires_at = NEW.expires_at,
            updated_at = NOW();
    
    -- 如果订阅取消或过期，降级到免费用户
    ELSIF NEW.status IN ('cancelled', 'expired') AND OLD.status = 'active' THEN
        -- 将当前角色设为非激活
        UPDATE user_roles 
        SET is_active = false 
        WHERE user_id = NEW.user_id AND is_active = true;
        
        -- 设置为免费用户
        INSERT INTO user_roles (user_id, role, is_active, granted_at)
        VALUES (NEW.user_id, 'free', true, NOW())
        ON CONFLICT (user_id) WHERE is_active = true
        DO UPDATE SET 
            role = 'free',
            granted_at = NOW(),
            expires_at = NULL,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：订阅状态变化时自动更新用户角色
CREATE TRIGGER trigger_update_user_role_from_subscription
    AFTER INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_role_from_subscription();

-- 创建函数：检查过期订阅
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void AS $$
BEGIN
    -- 将过期的订阅状态更新为expired
    UPDATE user_subscriptions 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;