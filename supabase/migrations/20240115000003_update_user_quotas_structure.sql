-- 更新 user_quotas 表结构以匹配新的设计

-- 首先备份现有数据（如果需要的话）
-- CREATE TABLE user_quotas_backup AS SELECT * FROM user_quotas;

-- 删除现有的 user_quotas 表
DROP TABLE IF EXISTS user_quotas CASCADE;

-- 重新创建 user_quotas 表，使用新的结构
CREATE TABLE user_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_definition_id uuid NOT NULL REFERENCES quota_definitions(id) ON DELETE CASCADE,
    current_usage integer NOT NULL DEFAULT 0,
    last_reset_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quota_definition_id)
);

-- 创建索引
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_quota_definition_id ON user_quotas(quota_definition_id);
CREATE INDEX idx_user_quotas_user_quota ON user_quotas(user_id, quota_definition_id);

-- 添加注释
COMMENT ON TABLE user_quotas IS '用户配额使用记录表';
COMMENT ON COLUMN user_quotas.user_id IS '用户ID';
COMMENT ON COLUMN user_quotas.quota_definition_id IS '配额定义ID';
COMMENT ON COLUMN user_quotas.current_usage IS '当前使用量';
COMMENT ON COLUMN user_quotas.last_reset_at IS '上次重置时间';

-- 创建 updated_at 触发器
CREATE OR REPLACE FUNCTION update_user_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_quotas_updated_at
    BEFORE UPDATE ON user_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_user_quotas_updated_at();

-- 启用 RLS
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own quotas" ON user_quotas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotas" ON user_quotas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can manage all quotas" ON user_quotas
    FOR ALL USING (true);

-- 授予权限
GRANT SELECT, INSERT, UPDATE ON user_quotas TO authenticated;
GRANT SELECT ON user_quotas TO anon;

-- 为现有用户初始化配额记录
INSERT INTO user_quotas (user_id, quota_definition_id, current_usage, last_reset_at)
SELECT 
    u.id as user_id,
    qd.id as quota_definition_id,
    0 as current_usage,
    CURRENT_TIMESTAMP as last_reset_at
FROM users u
CROSS JOIN quota_definitions qd
ON CONFLICT (user_id, quota_definition_id) DO NOTHING;