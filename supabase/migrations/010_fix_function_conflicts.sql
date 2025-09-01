-- 修复函数冲突问题
-- 删除现有函数并重新创建

-- 1. 删除可能存在冲突的函数
DROP FUNCTION IF EXISTS reset_user_quota(UUID, VARCHAR);
DROP FUNCTION IF EXISTS calculate_next_reset_time(VARCHAR);
DROP FUNCTION IF EXISTS initialize_user_quotas(UUID);
DROP FUNCTION IF EXISTS update_user_quota_usage(UUID, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS reset_expired_quotas();
DROP FUNCTION IF EXISTS get_user_quota_stats(UUID);
DROP FUNCTION IF EXISTS update_quotas_on_role_change();
DROP FUNCTION IF EXISTS initialize_quotas_for_new_user();
DROP FUNCTION IF EXISTS update_user_role_on_subscription_change();
DROP FUNCTION IF EXISTS check_expired_subscriptions();

-- 2. 删除可能存在的触发器
DROP TRIGGER IF EXISTS update_quotas_on_role_change ON user_roles;
DROP TRIGGER IF EXISTS initialize_quotas_for_new_user ON auth.users;
DROP TRIGGER IF EXISTS update_user_role_on_subscription_change ON user_subscriptions;

-- 3. 重新创建计算下次重置时间的函数
CREATE OR REPLACE FUNCTION calculate_next_reset_time(reset_cycle VARCHAR)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    CASE reset_cycle
        WHEN 'daily' THEN
            RETURN (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE;
        WHEN 'monthly' THEN
            RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::TIMESTAMP WITH TIME ZONE;
        WHEN 'yearly' THEN
            RETURN (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year')::TIMESTAMP WITH TIME ZONE;
        WHEN 'never' THEN
            RETURN NULL;
        ELSE
            RETURN (CURRENT_DATE + INTERVAL '1 month')::TIMESTAMP WITH TIME ZONE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 4. 重新创建初始化用户额度的函数
CREATE OR REPLACE FUNCTION initialize_user_quotas(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    quota_def RECORD;
    user_role VARCHAR(20);
BEGIN
    -- 获取用户当前角色
    user_role := get_user_active_role(p_user_id);
    
    -- 为用户初始化所有产品类型的额度
    FOR quota_def IN 
        SELECT product_type, default_quota, reset_cycle
        FROM quota_definitions
        WHERE role = user_role
    LOOP
        -- 插入或更新用户额度
        INSERT INTO user_quotas (
            user_id, 
            product_type, 
            total_quota, 
            used_quota, 
            reset_cycle,
            next_reset_at
        ) VALUES (
            p_user_id,
            quota_def.product_type,
            quota_def.default_quota,
            0,
            quota_def.reset_cycle,
            calculate_next_reset_time(quota_def.reset_cycle)
        )
        ON CONFLICT (user_id, product_type) 
        DO UPDATE SET
            total_quota = quota_def.default_quota,
            reset_cycle = quota_def.reset_cycle,
            next_reset_at = calculate_next_reset_time(quota_def.reset_cycle),
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 重新创建更新用户额度使用量的函数
CREATE OR REPLACE FUNCTION update_user_quota_usage(
    p_user_id UUID,
    p_product_type VARCHAR,
    p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_quota RECORD;
    remaining_quota INTEGER;
BEGIN
    -- 获取当前额度信息
    SELECT total_quota, used_quota, next_reset_at
    INTO current_quota
    FROM user_quotas
    WHERE user_id = p_user_id AND product_type = p_product_type;
    
    -- 如果没有找到额度记录，先初始化
    IF NOT FOUND THEN
        PERFORM initialize_user_quotas(p_user_id);
        
        -- 重新获取额度信息
        SELECT total_quota, used_quota, next_reset_at
        INTO current_quota
        FROM user_quotas
        WHERE user_id = p_user_id AND product_type = p_product_type;
    END IF;
    
    -- 检查是否需要重置额度
    IF current_quota.next_reset_at IS NOT NULL AND current_quota.next_reset_at <= NOW() THEN
        PERFORM reset_user_quota(p_user_id, p_product_type);
        
        -- 重新获取重置后的额度信息
        SELECT total_quota, used_quota
        INTO current_quota
        FROM user_quotas
        WHERE user_id = p_user_id AND product_type = p_product_type;
    END IF;
    
    -- 计算剩余额度（-1表示无限额度）
    IF current_quota.total_quota = -1 THEN
        remaining_quota := p_amount; -- 无限额度，总是可用
    ELSE
        remaining_quota := current_quota.total_quota - current_quota.used_quota;
    END IF;
    
    -- 检查额度是否足够
    IF remaining_quota < p_amount THEN
        RETURN FALSE; -- 额度不足
    END IF;
    
    -- 更新使用量（只有在非无限额度时才更新）
    IF current_quota.total_quota != -1 THEN
        UPDATE user_quotas
        SET used_quota = used_quota + p_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id AND product_type = p_product_type;
    END IF;
    
    RETURN TRUE; -- 额度足够，使用成功
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 重新创建重置用户特定产品额度的函数
CREATE OR REPLACE FUNCTION reset_user_quota(
    p_user_id UUID,
    p_product_type VARCHAR
)
RETURNS VOID AS $$
DECLARE
    quota_info RECORD;
BEGIN
    -- 获取额度信息
    SELECT uq.reset_cycle, qd.default_quota
    INTO quota_info
    FROM user_quotas uq
    JOIN quota_definitions qd ON qd.product_type = uq.product_type
    WHERE uq.user_id = p_user_id 
      AND uq.product_type = p_product_type
      AND qd.role = get_user_active_role(p_user_id);
    
    IF FOUND THEN
        UPDATE user_quotas
        SET used_quota = 0,
            total_quota = quota_info.default_quota,
            next_reset_at = calculate_next_reset_time(quota_info.reset_cycle),
            updated_at = NOW()
        WHERE user_id = p_user_id AND product_type = p_product_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 重新创建批量重置过期额度的函数
CREATE OR REPLACE FUNCTION reset_expired_quotas()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
    quota_record RECORD;
BEGIN
    -- 查找所有需要重置的额度
    FOR quota_record IN
        SELECT user_id, product_type
        FROM user_quotas
        WHERE next_reset_at IS NOT NULL 
          AND next_reset_at <= NOW()
    LOOP
        PERFORM reset_user_quota(quota_record.user_id, quota_record.product_type);
        reset_count := reset_count + 1;
    END LOOP;
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 重新创建获取用户额度统计的函数
CREATE OR REPLACE FUNCTION get_user_quota_stats(p_user_id UUID)
RETURNS TABLE(
    product_type VARCHAR,
    total_quota INTEGER,
    used_quota INTEGER,
    remaining_quota INTEGER,
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
        uq.total_quota,
        uq.used_quota,
        CASE 
            WHEN uq.total_quota = -1 THEN -1
            ELSE uq.total_quota - uq.used_quota
        END as remaining_quota,
        CASE 
            WHEN uq.total_quota = -1 THEN 0
            WHEN uq.total_quota = 0 THEN 100
            ELSE ROUND((uq.used_quota::NUMERIC / uq.total_quota::NUMERIC) * 100, 2)
        END as usage_percentage,
        uq.reset_cycle,
        uq.next_reset_at,
        (uq.total_quota = -1) as is_unlimited
    FROM user_quotas uq
    WHERE uq.user_id = p_user_id
    ORDER BY uq.product_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 重新创建用户角色变化时自动更新额度的触发器函数
CREATE OR REPLACE FUNCTION update_quotas_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 当用户角色变化时，重新初始化额度
    IF TG_OP = 'UPDATE' AND (OLD.role != NEW.role OR OLD.is_active != NEW.is_active) THEN
        PERFORM initialize_user_quotas(NEW.user_id);
    ELSIF TG_OP = 'INSERT' THEN
        PERFORM initialize_user_quotas(NEW.user_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 10. 重新创建新用户注册时自动初始化额度的触发器函数
CREATE OR REPLACE FUNCTION initialize_quotas_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 为新用户创建默认的free角色
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'free', true)
    ON CONFLICT DO NOTHING;
    
    -- 初始化用户额度
    PERFORM initialize_user_quotas(NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. 重新创建订阅状态变化时自动更新用户角色的函数
CREATE OR REPLACE FUNCTION update_user_role_on_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
    plan_role VARCHAR(20);
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- 获取订阅计划对应的角色
        SELECT sp.role INTO plan_role
        FROM subscription_plans sp
        WHERE sp.id = NEW.plan_id;
        
        IF NEW.status = 'active' THEN
            -- 激活订阅时，更新用户角色
            INSERT INTO user_roles (user_id, role, is_active, expires_at)
            VALUES (NEW.user_id, plan_role, true, NEW.expires_at)
            ON CONFLICT (user_id) WHERE is_active = true
            DO UPDATE SET
                role = plan_role,
                expires_at = NEW.expires_at,
                updated_at = NOW();
        ELSIF NEW.status IN ('cancelled', 'expired') THEN
            -- 取消或过期订阅时，将用户角色降级为user或free
            UPDATE user_roles
            SET role = 'user',
                expires_at = NULL,
                updated_at = NOW()
            WHERE user_id = NEW.user_id AND is_active = true;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 12. 重新创建定期检查过期订阅的函数
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- 更新过期的订阅状态
    UPDATE user_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
      AND expires_at <= NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- 更新过期订阅用户的角色
    UPDATE user_roles
    SET role = 'user',
        expires_at = NULL,
        updated_at = NOW()
    WHERE user_id IN (
        SELECT user_id
        FROM user_subscriptions
        WHERE status = 'expired'
          AND expires_at <= NOW()
    ) AND is_active = true;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. 重新创建触发器
CREATE TRIGGER update_quotas_on_role_change
    AFTER INSERT OR UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_quotas_on_role_change();

CREATE TRIGGER initialize_quotas_for_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_quotas_for_new_user();

CREATE TRIGGER update_user_role_on_subscription_change
    AFTER INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_role_on_subscription_change();

-- 14. 权限设置
GRANT EXECUTE ON FUNCTION calculate_next_reset_time(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_quotas(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_quota_usage(UUID, VARCHAR, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quota(UUID, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_expired_quotas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_quota_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_expired_subscriptions() TO anon, authenticated;

-- 15. 函数注释
COMMENT ON FUNCTION calculate_next_reset_time(VARCHAR) IS '计算下次额度重置时间';
COMMENT ON FUNCTION initialize_user_quotas(UUID) IS '初始化用户所有产品类型的额度';
COMMENT ON FUNCTION update_user_quota_usage(UUID, VARCHAR, INTEGER) IS '更新用户额度使用量，返回是否成功';
COMMENT ON FUNCTION reset_user_quota(UUID, VARCHAR) IS '重置用户特定产品的额度';
COMMENT ON FUNCTION reset_expired_quotas() IS '批量重置所有过期的额度';
COMMENT ON FUNCTION get_user_quota_stats(UUID) IS '获取用户额度统计信息';
COMMENT ON FUNCTION check_expired_subscriptions() IS '检查并处理过期的订阅';