-- 创建用户额度表
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    quota_limit INTEGER NOT NULL,
    quota_used INTEGER DEFAULT 0,
    quota_remaining INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN quota_limit = -1 THEN -1
            ELSE quota_limit - quota_used
        END
    ) STORED,
    reset_cycle VARCHAR(20) NOT NULL CHECK (reset_cycle IN ('daily', 'monthly', 'yearly', 'never')),
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_reset_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_product_type ON user_quotas(product_type);
CREATE INDEX idx_user_quotas_next_reset_at ON user_quotas(next_reset_at);
CREATE UNIQUE INDEX idx_user_quotas_user_product ON user_quotas(user_id, product_type);

-- 设置表权限
GRANT SELECT ON user_quotas TO anon;
GRANT ALL PRIVILEGES ON user_quotas TO authenticated;

-- 为user_quotas表创建更新时间触发器
CREATE TRIGGER update_user_quotas_updated_at
    BEFORE UPDATE ON user_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：计算下次重置时间
CREATE OR REPLACE FUNCTION calculate_next_reset_time(reset_cycle VARCHAR, base_time TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    CASE reset_cycle
        WHEN 'daily' THEN
            RETURN date_trunc('day', base_time) + INTERVAL '1 day';
        WHEN 'monthly' THEN
            RETURN date_trunc('month', base_time) + INTERVAL '1 month';
        WHEN 'yearly' THEN
            RETURN date_trunc('year', base_time) + INTERVAL '1 year';
        WHEN 'never' THEN
            RETURN NULL;
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：初始化用户额度
CREATE OR REPLACE FUNCTION initialize_user_quotas(p_user_id UUID)
RETURNS void AS $$
DECLARE
    quota_def RECORD;
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
    
    -- 为用户初始化所有产品类型的额度
    FOR quota_def IN 
        SELECT qd.product_type, qd.default_quota, qd.reset_cycle
        FROM quota_definitions qd
        WHERE qd.role = user_role AND qd.is_active = true
    LOOP
        INSERT INTO user_quotas (
            user_id, 
            product_type, 
            quota_limit, 
            quota_used, 
            reset_cycle, 
            last_reset_at, 
            next_reset_at
        )
        VALUES (
            p_user_id,
            quota_def.product_type,
            quota_def.default_quota,
            0,
            quota_def.reset_cycle,
            NOW(),
            calculate_next_reset_time(quota_def.reset_cycle)
        )
        ON CONFLICT (user_id, product_type) DO UPDATE SET
            quota_limit = quota_def.default_quota,
            reset_cycle = quota_def.reset_cycle,
            next_reset_at = calculate_next_reset_time(quota_def.reset_cycle),
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：更新用户额度使用量
CREATE OR REPLACE FUNCTION update_user_quota_usage(
    p_user_id UUID,
    p_product_type VARCHAR,
    p_usage_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_quota RECORD;
    can_use BOOLEAN := false;
BEGIN
    -- 获取当前额度信息
    SELECT quota_limit, quota_used, quota_remaining
    INTO current_quota
    FROM user_quotas
    WHERE user_id = p_user_id AND product_type = p_product_type;
    
    -- 如果没有找到额度记录，先初始化
    IF NOT FOUND THEN
        PERFORM initialize_user_quotas(p_user_id);
        
        -- 重新获取额度信息
        SELECT quota_limit, quota_used, quota_remaining
        INTO current_quota
        FROM user_quotas
        WHERE user_id = p_user_id AND product_type = p_product_type;
    END IF;
    
    -- 检查是否可以使用（-1表示无限制）
    IF current_quota.quota_limit = -1 OR current_quota.quota_remaining >= p_usage_amount THEN
        can_use := true;
        
        -- 更新使用量（无限制时不更新使用量）
        IF current_quota.quota_limit != -1 THEN
            UPDATE user_quotas
            SET quota_used = quota_used + p_usage_amount,
                updated_at = NOW()
            WHERE user_id = p_user_id AND product_type = p_product_type;
        END IF;
    END IF;
    
    RETURN can_use;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：重置用户额度
CREATE OR REPLACE FUNCTION reset_user_quota(
    p_user_id UUID,
    p_product_type VARCHAR
)
RETURNS void AS $$
BEGIN
    UPDATE user_quotas
    SET quota_used = 0,
        last_reset_at = NOW(),
        next_reset_at = calculate_next_reset_time(reset_cycle),
        updated_at = NOW()
    WHERE user_id = p_user_id AND product_type = p_product_type;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：批量重置过期的额度
CREATE OR REPLACE FUNCTION reset_expired_quotas()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
BEGIN
    -- 重置所有需要重置的额度
    UPDATE user_quotas
    SET quota_used = 0,
        last_reset_at = NOW(),
        next_reset_at = calculate_next_reset_time(reset_cycle),
        updated_at = NOW()
    WHERE next_reset_at IS NOT NULL 
    AND next_reset_at <= NOW();
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取用户额度统计
CREATE OR REPLACE FUNCTION get_user_quota_stats(p_user_id UUID)
RETURNS TABLE(
    product_type VARCHAR,
    quota_limit INTEGER,
    quota_used INTEGER,
    quota_remaining INTEGER,
    usage_percentage NUMERIC,
    reset_cycle VARCHAR,
    next_reset_at TIMESTAMP WITH TIME ZONE,
    is_unlimited BOOLEAN
) AS $$
BEGIN
    -- 确保用户额度已初始化
    PERFORM initialize_user_quotas(p_user_id);
    
    RETURN QUERY
    SELECT 
        uq.product_type,
        uq.quota_limit,
        uq.quota_used,
        uq.quota_remaining,
        CASE 
            WHEN uq.quota_limit = -1 THEN 0::NUMERIC
            WHEN uq.quota_limit = 0 THEN 100::NUMERIC
            ELSE ROUND((uq.quota_used::NUMERIC / uq.quota_limit::NUMERIC) * 100, 2)
        END as usage_percentage,
        uq.reset_cycle,
        uq.next_reset_at,
        (uq.quota_limit = -1) as is_unlimited
    FROM user_quotas uq
    WHERE uq.user_id = p_user_id
    ORDER BY uq.product_type;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：用户角色变化时自动更新额度
CREATE OR REPLACE FUNCTION update_quotas_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 当用户角色变为激活状态时，重新初始化额度
    IF NEW.is_active = true AND (OLD.is_active = false OR OLD.role != NEW.role) THEN
        PERFORM initialize_user_quotas(NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quotas_on_role_change
    AFTER UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_quotas_on_role_change();

-- 创建触发器：新用户注册时自动初始化额度
CREATE OR REPLACE FUNCTION initialize_quotas_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 为新用户初始化额度（延迟执行以确保用户角色已设置）
    PERFORM pg_notify('initialize_user_quotas', NEW.user_id::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_initialize_quotas_for_new_user
    AFTER INSERT ON user_roles
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE FUNCTION initialize_quotas_for_new_user();