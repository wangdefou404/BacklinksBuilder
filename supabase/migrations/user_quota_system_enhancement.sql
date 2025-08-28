-- 用户配额系统增强
-- 根据价格页面设置区分不同用户的产品使用额度

-- 1. 创建配额类型枚举
CREATE TYPE quota_type AS ENUM (
    'dr_check',
    'traffic_check', 
    'backlink_check',
    'backlink_view'
);

-- 2. 创建用户等级配额配置表
CREATE TABLE IF NOT EXISTS user_plan_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro', 'super')),
    quota_type quota_type NOT NULL,
    monthly_limit INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_type, quota_type)
);

-- 3. 插入各等级的配额配置
-- Free 等级配额
INSERT INTO user_plan_quotas (plan_type, quota_type, monthly_limit, daily_limit) VALUES
('free', 'dr_check', 10, 2),
('free', 'traffic_check', 10, 2),
('free', 'backlink_check', 10, 2),
('free', 'backlink_view', 50, 10);

-- Pro 等级配额
INSERT INTO user_plan_quotas (plan_type, quota_type, monthly_limit, daily_limit) VALUES
('pro', 'dr_check', 1000, 50),
('pro', 'traffic_check', 1000, 50),
('pro', 'backlink_check', 1000, 50),
('pro', 'backlink_view', 5000, 200);

-- Super 等级配额
INSERT INTO user_plan_quotas (plan_type, quota_type, monthly_limit, daily_limit) VALUES
('super', 'dr_check', 5000, 200),
('super', 'traffic_check', 5000, 200),
('super', 'backlink_check', 5000, 200),
('super', 'backlink_view', 20000, 800);

-- 4. 更新用户配额表结构
-- 首先删除唯一约束，因为我们需要支持多行记录
ALTER TABLE user_quotas DROP CONSTRAINT IF EXISTS user_quotas_user_id_key;

-- 添加新列
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS quota_type_new quota_type,
ADD COLUMN IF NOT EXISTS monthly_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 更新现有的quota_type列为新的枚举类型
UPDATE user_quotas SET quota_type_new = 'dr_check'::quota_type WHERE quota_type = 'general' OR quota_type IS NULL;

-- 删除旧的quota_type列并重命名新列
ALTER TABLE user_quotas DROP COLUMN IF EXISTS quota_type;
ALTER TABLE user_quotas RENAME COLUMN quota_type_new TO quota_type;

-- 5. 创建配额初始化函数
CREATE OR REPLACE FUNCTION initialize_user_quotas(user_id_param UUID, plan_type_param TEXT DEFAULT 'free')
RETURNS VOID AS $$
DECLARE
    quota_config RECORD;
BEGIN
    -- 删除用户现有配额记录
    DELETE FROM user_quotas WHERE user_id = user_id_param;
    
    -- 为用户创建所有类型的配额记录
    FOR quota_config IN 
        SELECT * FROM user_plan_quotas WHERE plan_type = plan_type_param
    LOOP
        INSERT INTO user_quotas (
            user_id, 
            quota_type, 
            plan_type,
            monthly_limit, 
            daily_limit, 
            monthly_used, 
            daily_used,
            last_reset_at,
            reset_monthly_at,
            reset_daily_at,
            created_at,
            updated_at
        ) VALUES (
            user_id_param,
            quota_config.quota_type,
            plan_type_param,
            quota_config.monthly_limit,
            quota_config.daily_limit,
            0,
            0,
            NOW(),
            DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
            DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
            NOW(),
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建配额更新函数
CREATE OR REPLACE FUNCTION update_user_plan_quotas(user_id_param UUID, new_plan_type TEXT)
RETURNS VOID AS $$
DECLARE
    quota_config RECORD;
BEGIN
    -- 更新用户配额限制，保留已使用量
    FOR quota_config IN 
        SELECT * FROM user_plan_quotas WHERE plan_type = new_plan_type
    LOOP
        UPDATE user_quotas 
        SET 
            plan_type = new_plan_type,
            monthly_limit = quota_config.monthly_limit,
            daily_limit = quota_config.daily_limit,
            updated_at = NOW()
        WHERE user_id = user_id_param AND quota_type = quota_config.quota_type;
        
        -- 如果记录不存在，则创建新记录
        IF NOT FOUND THEN
            INSERT INTO user_quotas (
                user_id, 
                quota_type, 
                plan_type,
                monthly_limit, 
                daily_limit, 
                monthly_used, 
                daily_used,
                last_reset_at,
                reset_monthly_at,
                reset_daily_at,
                created_at,
                updated_at
            ) VALUES (
                user_id_param,
                quota_config.quota_type,
                new_plan_type,
                quota_config.monthly_limit,
                quota_config.daily_limit,
                0,
                0,
                NOW(),
                DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
                DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
                NOW(),
                NOW()
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建配额重置函数
CREATE OR REPLACE FUNCTION reset_user_quotas()
RETURNS VOID AS $$
BEGIN
    -- 重置月度配额
    UPDATE user_quotas 
    SET 
        monthly_used = 0,
        reset_monthly_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE reset_monthly_at <= NOW();
    
    -- 重置日度配额
    UPDATE user_quotas 
    SET 
        daily_used = 0,
        reset_daily_at = DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
        updated_at = NOW()
    WHERE reset_daily_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 创建用户角色变更触发器函数
CREATE OR REPLACE FUNCTION handle_user_role_change()
RETURNS TRIGGER AS $$
DECLARE
    plan_type_mapping TEXT;
BEGIN
    -- 将角色映射到计划类型
    CASE NEW.role
        WHEN 'free' THEN plan_type_mapping := 'free';
        WHEN 'premium' THEN plan_type_mapping := 'pro';
        WHEN 'admin' THEN plan_type_mapping := 'super';
        ELSE plan_type_mapping := 'free';
    END CASE;
    
    -- 更新用户配额
    PERFORM update_user_plan_quotas(NEW.user_id, plan_type_mapping);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 创建用户角色变更触发器
DROP TRIGGER IF EXISTS trigger_user_role_quota_update ON user_roles;
CREATE TRIGGER trigger_user_role_quota_update
    AFTER INSERT OR UPDATE OF role ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_role_change();

-- 10. 更新配额检查函数
CREATE OR REPLACE FUNCTION check_user_quota_enhanced(
    user_id_param UUID, 
    quota_type_param quota_type,
    check_type TEXT DEFAULT 'both' -- 'daily', 'monthly', 'both'
)
RETURNS JSONB AS $$
DECLARE
    quota_record RECORD;
    result JSONB;
BEGIN
    -- 首先重置过期的配额
    PERFORM reset_user_quotas();
    
    -- 获取用户配额信息
    SELECT * INTO quota_record
    FROM user_quotas 
    WHERE user_id = user_id_param AND quota_type = quota_type_param;
    
    IF NOT FOUND THEN
        -- 如果没有配额记录，尝试初始化
        PERFORM initialize_user_quotas(user_id_param, 'free');
        
        -- 重新获取配额信息
        SELECT * INTO quota_record
        FROM user_quotas 
        WHERE user_id = user_id_param AND quota_type = quota_type_param;
    END IF;
    
    -- 构建返回结果
    result := jsonb_build_object(
        'allowed', true,
        'quota_type', quota_type_param,
        'plan_type', quota_record.plan_type,
        'monthly_limit', quota_record.monthly_limit,
        'monthly_used', quota_record.monthly_used,
        'monthly_remaining', quota_record.monthly_limit - quota_record.monthly_used,
        'daily_limit', quota_record.daily_limit,
        'daily_used', quota_record.daily_used,
        'daily_remaining', COALESCE(quota_record.daily_limit - quota_record.daily_used, 999999),
        'reset_monthly_at', quota_record.reset_monthly_at,
        'reset_daily_at', quota_record.reset_daily_at
    );
    
    -- 检查配额限制
    IF check_type IN ('monthly', 'both') AND quota_record.monthly_used >= quota_record.monthly_limit THEN
        result := jsonb_set(result, '{allowed}', 'false'::jsonb);
        result := jsonb_set(result, '{reason}', '"Monthly quota exceeded"'::jsonb);
        RETURN result;
    END IF;
    
    IF check_type IN ('daily', 'both') AND quota_record.daily_limit IS NOT NULL AND quota_record.daily_used >= quota_record.daily_limit THEN
        result := jsonb_set(result, '{allowed}', 'false'::jsonb);
        result := jsonb_set(result, '{reason}', '"Daily quota exceeded"'::jsonb);
        RETURN result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 创建配额使用记录函数
CREATE OR REPLACE FUNCTION use_user_quota(
    user_id_param UUID, 
    quota_type_param quota_type,
    usage_amount INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    quota_check JSONB;
    updated_rows INTEGER;
BEGIN
    -- 检查配额是否允许使用
    quota_check := check_user_quota_enhanced(user_id_param, quota_type_param);
    
    IF (quota_check->>'allowed')::boolean = false THEN
        RETURN quota_check;
    END IF;
    
    -- 更新使用量
    UPDATE user_quotas 
    SET 
        monthly_used = monthly_used + usage_amount,
        daily_used = daily_used + usage_amount,
        updated_at = NOW()
    WHERE user_id = user_id_param AND quota_type = quota_type_param;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    IF updated_rows = 0 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Quota record not found'
        );
    END IF;
    
    -- 返回更新后的配额信息
    RETURN check_user_quota_enhanced(user_id_param, quota_type_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. 为现有用户初始化配额
DO $$
DECLARE
    user_record RECORD;
    user_plan TEXT;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT u.id as user_id, COALESCE(ur.role, 'free') as role
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
    LOOP
        -- 将角色映射到计划类型
        CASE user_record.role
            WHEN 'free' THEN user_plan := 'free';
            WHEN 'premium' THEN user_plan := 'pro';
            WHEN 'admin' THEN user_plan := 'super';
            ELSE user_plan := 'free';
        END CASE;
        
        -- 初始化用户配额
        PERFORM initialize_user_quotas(user_record.user_id, user_plan);
    END LOOP;
END
$$;

-- 13. 设置表权限
-- 启用 RLS
ALTER TABLE user_plan_quotas ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view plan quotas" ON user_plan_quotas
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage plan quotas" ON user_plan_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    );

-- 授予权限
GRANT SELECT ON user_plan_quotas TO anon, authenticated;
GRANT ALL ON user_plan_quotas TO service_role;

-- 更新 user_quotas 表的 RLS 策略
DROP POLICY IF EXISTS "Users can view own quotas" ON user_quotas;
CREATE POLICY "Users can view own quotas" ON user_quotas
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all quotas" ON user_quotas;
CREATE POLICY "Admins can manage all quotas" ON user_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    );

-- 14. 创建配额统计视图
CREATE OR REPLACE VIEW user_quota_summary AS
SELECT 
    uq.user_id,
    uq.plan_type,
    jsonb_object_agg(
        uq.quota_type,
        jsonb_build_object(
            'monthly_limit', uq.monthly_limit,
            'monthly_used', uq.monthly_used,
            'monthly_remaining', uq.monthly_limit - uq.monthly_used,
            'daily_limit', uq.daily_limit,
            'daily_used', uq.daily_used,
            'daily_remaining', COALESCE(uq.daily_limit - uq.daily_used, 999999),
            'reset_monthly_at', uq.reset_monthly_at,
            'reset_daily_at', uq.reset_daily_at
        )
    ) as quotas
FROM user_quotas uq
GROUP BY uq.user_id, uq.plan_type;

-- 设置视图权限
GRANT SELECT ON user_quota_summary TO authenticated;

-- 15. 创建定时任务重置配额的函数（需要 pg_cron 扩展）
-- 注意：这需要在 Supabase 中手动设置 cron job
-- SELECT cron.schedule('reset-quotas', '0 0 * * *', 'SELECT reset_user_quotas();');

COMMIT;