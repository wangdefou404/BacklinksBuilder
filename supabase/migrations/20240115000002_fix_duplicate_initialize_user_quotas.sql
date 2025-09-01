-- 修复重复的 initialize_user_quotas 函数
-- 删除所有现有的 initialize_user_quotas 函数
DROP FUNCTION IF EXISTS initialize_user_quotas(uuid);
DROP FUNCTION IF EXISTS initialize_user_quotas(text);
DROP FUNCTION IF EXISTS initialize_user_quotas;

-- 重新创建唯一的 initialize_user_quotas 函数
CREATE OR REPLACE FUNCTION initialize_user_quotas(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 为用户初始化所有配额定义的配额记录
  INSERT INTO user_quotas (user_id, quota_definition_id, current_usage, last_reset_at)
  SELECT 
    p_user_id,
    qd.id,
    0,
    CURRENT_TIMESTAMP
  FROM quota_definitions qd
  WHERE NOT EXISTS (
    SELECT 1 
    FROM user_quotas uq 
    WHERE uq.user_id = p_user_id 
    AND uq.quota_definition_id = qd.id
  );
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION initialize_user_quotas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_quotas(uuid) TO anon;