-- 修复 user_quotas 表结构以匹配 API 期望
-- 添加缺失的字段并处理约束问题

-- 首先，让 quota_definition_id 字段可为空
ALTER TABLE user_quotas ALTER COLUMN quota_definition_id DROP NOT NULL;

-- 添加新的字段到 user_quotas 表
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS quota_type quota_type,
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reset_monthly_at TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'),
ADD COLUMN IF NOT EXISTS reset_daily_at TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day');

-- 更新现有记录的默认值
UPDATE user_quotas 
SET 
    quota_type = 'dr_check'::quota_type,
    plan_type = 'free',
    monthly_limit = 5,
    daily_limit = 2,
    monthly_used = 0,
    daily_used = 0,
    reset_monthly_at = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
    reset_daily_at = DATE_TRUNC('day', CURRENT_DATE) + INTERVAL '1 day'
WHERE quota_type IS NULL;

-- 创建配额初始化函数
CREATE OR REPLACE FUNCTION initialize_user_quotas_v2(user_id_param UUID, plan_type_param TEXT DEFAULT 'free')
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
            updated_at,
            current_usage
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
            NOW(),
            0
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为现有用户初始化配额记录
DO $$
DECLARE
    user_record RECORD;
    user_role_record RECORD;
    plan_type_val TEXT;
BEGIN
    -- 遍历所有用户
    FOR user_record IN SELECT DISTINCT user_id FROM user_quotas
    LOOP
        -- 获取用户角色
        SELECT role INTO user_role_record FROM user_roles 
        WHERE user_id = user_record.user_id AND is_active = true 
        LIMIT 1;
        
        -- 映射角色到计划类型
        IF user_role_record.role IS NULL THEN
            plan_type_val := 'free';
        ELSIF user_role_record.role = 'admin' THEN
            plan_type_val := 'super';
        ELSIF user_role_record.role = 'pro' OR user_role_record.role = 'Pro' THEN
            plan_type_val := 'pro';
        ELSE
            plan_type_val := 'free';
        END IF;
        
        -- 初始化用户配额
        PERFORM initialize_user_quotas_v2(user_record.user_id, plan_type_val);
    END LOOP;
END
$$;