-- 重新创建配额相关的数据库函数，使用新的表结构（修复版本）

-- 删除旧的函数（如果存在）
DROP FUNCTION IF EXISTS get_user_quota_stats(uuid);
DROP FUNCTION IF EXISTS update_user_quota_usage(uuid, varchar, integer);
DROP FUNCTION IF EXISTS reset_user_quotas();
DROP FUNCTION IF EXISTS get_user_active_role(uuid);

-- 1. 获取用户活跃角色函数
CREATE OR REPLACE FUNCTION get_user_active_role(p_user_id uuid)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role varchar;
BEGIN
    -- 从用户表获取角色
    SELECT role INTO user_role
    FROM users
    WHERE id = p_user_id;
    
    -- 如果没有找到用户，返回 'free'
    IF user_role IS NULL THEN
        RETURN 'free';
    END IF;
    
    RETURN user_role;
END;
$$;

-- 2. 获取用户配额统计函数
CREATE OR REPLACE FUNCTION get_user_quota_stats(p_user_id uuid)
RETURNS TABLE(
    product_type varchar,
    total_quota integer,
    used_quota integer,
    remaining_quota integer,
    is_unlimited boolean,
    usage_percentage numeric,
    reset_cycle varchar,
    next_reset_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qd.product_type,
        qd.default_quota as total_quota,
        COALESCE(uq.current_usage, 0) as used_quota,
        GREATEST(0, qd.default_quota - COALESCE(uq.current_usage, 0)) as remaining_quota,
        (qd.default_quota = -1) as is_unlimited,
        CASE 
            WHEN qd.default_quota = -1 THEN 0::numeric
            WHEN qd.default_quota = 0 THEN 100::numeric
            ELSE ROUND((COALESCE(uq.current_usage, 0)::numeric / qd.default_quota::numeric) * 100, 2)
        END as usage_percentage,
        qd.reset_cycle,
        CASE qd.reset_cycle
            WHEN 'daily' THEN (CURRENT_DATE + INTERVAL '1 day')::timestamp with time zone
            WHEN 'monthly' THEN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp with time zone
            WHEN 'yearly' THEN (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year')::timestamp with time zone
            ELSE NULL
        END as next_reset_at
    FROM quota_definitions qd
    LEFT JOIN user_quotas uq ON qd.id = uq.quota_definition_id AND uq.user_id = p_user_id
    LEFT JOIN users u ON u.id = p_user_id
    WHERE qd.role = COALESCE(u.role, 'free')
    ORDER BY qd.product_type;
END;
$$;

-- 3. 更新用户配额使用量函数
CREATE OR REPLACE FUNCTION update_user_quota_usage(
    p_user_id uuid,
    p_product_type varchar,
    p_usage_amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    quota_def_id uuid;
    current_usage_val integer;
    quota_limit integer;
BEGIN
    -- 获取用户角色对应的配额定义ID
    SELECT qd.id, qd.default_quota INTO quota_def_id, quota_limit
    FROM quota_definitions qd
    JOIN users u ON u.role = qd.role
    WHERE u.id = p_user_id AND qd.product_type = p_product_type;
    
    IF quota_def_id IS NULL THEN
        RAISE EXCEPTION 'Quota definition not found for user % and product type %', p_user_id, p_product_type;
    END IF;
    
    -- 检查是否超出限制（-1表示无限制）
    IF quota_limit != -1 THEN
        SELECT COALESCE(current_usage, 0) INTO current_usage_val
        FROM user_quotas
        WHERE user_id = p_user_id AND quota_definition_id = quota_def_id;
        
        IF (COALESCE(current_usage_val, 0) + p_usage_amount) > quota_limit THEN
            RAISE EXCEPTION 'Quota limit exceeded. Current: %, Limit: %, Requested: %', 
                COALESCE(current_usage_val, 0), quota_limit, p_usage_amount;
        END IF;
    END IF;
    
    -- 更新或插入配额使用记录
    INSERT INTO user_quotas (user_id, quota_definition_id, current_usage, last_reset_at)
    VALUES (p_user_id, quota_def_id, p_usage_amount, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, quota_definition_id)
    DO UPDATE SET 
        current_usage = user_quotas.current_usage + p_usage_amount,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN true;
END;
$$;

-- 4. 重置用户配额函数（定时任务使用）
CREATE OR REPLACE FUNCTION reset_user_quotas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    daily_count integer;
    monthly_count integer;
    yearly_count integer;
    total_count integer;
BEGIN
    -- 重置日配额
    UPDATE user_quotas 
    SET current_usage = 0, 
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    FROM quota_definitions qd
    WHERE user_quotas.quota_definition_id = qd.id
    AND qd.reset_cycle = 'daily'
    AND DATE(user_quotas.last_reset_at) < CURRENT_DATE;
    
    GET DIAGNOSTICS daily_count = ROW_COUNT;
    
    -- 重置月配额
    UPDATE user_quotas 
    SET current_usage = 0, 
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    FROM quota_definitions qd
    WHERE user_quotas.quota_definition_id = qd.id
    AND qd.reset_cycle = 'monthly'
    AND DATE_TRUNC('month', user_quotas.last_reset_at) < DATE_TRUNC('month', CURRENT_DATE);
    
    GET DIAGNOSTICS monthly_count = ROW_COUNT;
    
    -- 重置年配额
    UPDATE user_quotas 
    SET current_usage = 0, 
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    FROM quota_definitions qd
    WHERE user_quotas.quota_definition_id = qd.id
    AND qd.reset_cycle = 'yearly'
    AND DATE_TRUNC('year', user_quotas.last_reset_at) < DATE_TRUNC('year', CURRENT_DATE);
    
    GET DIAGNOSTICS yearly_count = ROW_COUNT;
    
    total_count := daily_count + monthly_count + yearly_count;
    
    RETURN total_count;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_user_active_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_quota_stats(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_user_quota_usage(uuid, varchar, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_quotas() TO authenticated;