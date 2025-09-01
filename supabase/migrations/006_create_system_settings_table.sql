-- 创建系统设置表
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_is_public ON system_settings(is_public);
CREATE UNIQUE INDEX idx_system_settings_category_key ON system_settings(category, key);

-- 设置表权限
GRANT SELECT ON system_settings TO anon;
GRANT ALL PRIVILEGES ON system_settings TO authenticated;

-- 为system_settings表创建更新时间触发器
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入初始系统设置
INSERT INTO system_settings (category, key, value, description, data_type, is_public) VALUES
-- 系统配置
('system', 'site_name', 'BacklinksBuilder', '网站名称', 'string', true),
('system', 'site_description', '专业的外链建设工具平台', '网站描述', 'string', true),
('system', 'maintenance_mode', 'false', '维护模式开关', 'boolean', true),
('system', 'allow_registration', 'true', '允许新用户注册', 'boolean', true),
('system', 'default_user_role', 'free', '新用户默认角色', 'string', false),
('system', 'system_version', '1.0.0', '系统版本', 'string', true),
('system', 'last_backup_time', '', '最后备份时间', 'string', false),

-- 邮件设置
('email', 'smtp_host', '', 'SMTP服务器地址', 'string', false),
('email', 'smtp_port', '587', 'SMTP端口', 'number', false),
('email', 'smtp_secure', 'true', '启用SSL/TLS', 'boolean', false),
('email', 'smtp_user', '', 'SMTP用户名', 'string', false),
('email', 'smtp_password', '', 'SMTP密码', 'string', false),
('email', 'from_email', '', '发件人邮箱', 'string', false),
('email', 'from_name', 'BacklinksBuilder', '发件人名称', 'string', false),

-- 安全设置
('security', 'password_min_length', '8', '密码最小长度', 'number', false),
('security', 'session_timeout', '7200', '会话超时时间（秒）', 'number', false),
('security', 'max_login_attempts', '5', '最大登录失败次数', 'number', false),
('security', 'lockout_duration', '900', '账户锁定时间（秒）', 'number', false),
('security', 'require_2fa', 'false', '强制启用双因子认证', 'boolean', false),
('security', 'jwt_secret', '', 'JWT密钥', 'string', false),

-- 备份设置
('backup', 'auto_backup', 'true', '自动备份开关', 'boolean', false),
('backup', 'backup_frequency', 'daily', '备份频率', 'string', false),
('backup', 'backup_retention_days', '30', '备份保留天数', 'number', false),
('backup', 'backup_location', 'local', '备份存储位置', 'string', false),

-- 支付设置
('payment', 'stripe_publishable_key', '', 'Stripe公钥', 'string', false),
('payment', 'stripe_secret_key', '', 'Stripe私钥', 'string', false),
('payment', 'stripe_webhook_secret', '', 'Stripe Webhook密钥', 'string', false),
('payment', 'currency', 'USD', '默认货币', 'string', true),

-- API设置
('api', 'rate_limit_per_minute', '60', 'API每分钟请求限制', 'number', false),
('api', 'rate_limit_per_hour', '1000', 'API每小时请求限制', 'number', false),
('api', 'enable_api_key_auth', 'true', '启用API密钥认证', 'boolean', false),

-- 功能开关
('features', 'enable_dr_checker', 'true', '启用DR检查功能', 'boolean', true),
('features', 'enable_traffic_checker', 'true', '启用流量检查功能', 'boolean', true),
('features', 'enable_keyword_analysis', 'true', '启用关键词分析功能', 'boolean', true),
('features', 'enable_competitor_analysis', 'true', '启用竞争对手分析功能', 'boolean', true),
('features', 'enable_data_export', 'true', '启用数据导出功能', 'boolean', true);

-- 创建函数：获取系统设置
CREATE OR REPLACE FUNCTION get_system_setting(p_category VARCHAR, p_key VARCHAR)
RETURNS TEXT AS $$
DECLARE
    setting_value TEXT;
BEGIN
    SELECT value INTO setting_value
    FROM system_settings
    WHERE category = p_category AND key = p_key;
    
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：设置系统设置
CREATE OR REPLACE FUNCTION set_system_setting(
    p_category VARCHAR,
    p_key VARCHAR,
    p_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_data_type VARCHAR DEFAULT 'string',
    p_is_public BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
    INSERT INTO system_settings (category, key, value, description, data_type, is_public)
    VALUES (p_category, p_key, p_value, p_description, p_data_type, p_is_public)
    ON CONFLICT (category, key) DO UPDATE SET
        value = p_value,
        description = COALESCE(p_description, system_settings.description),
        data_type = p_data_type,
        is_public = p_is_public,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取分类下的所有设置
CREATE OR REPLACE FUNCTION get_settings_by_category(p_category VARCHAR)
RETURNS TABLE(
    key VARCHAR,
    value TEXT,
    description TEXT,
    data_type VARCHAR,
    is_public BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.key, s.value, s.description, s.data_type, s.is_public
    FROM system_settings s
    WHERE s.category = p_category
    ORDER BY s.key;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取公开设置
CREATE OR REPLACE FUNCTION get_public_settings()
RETURNS TABLE(
    category VARCHAR,
    key VARCHAR,
    value TEXT,
    data_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.category, s.key, s.value, s.data_type
    FROM system_settings s
    WHERE s.is_public = true
    ORDER BY s.category, s.key;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：批量更新设置
CREATE OR REPLACE FUNCTION update_settings_batch(
    p_category VARCHAR,
    p_settings JSONB
)
RETURNS INTEGER AS $$
DECLARE
    setting_record RECORD;
    update_count INTEGER := 0;
BEGIN
    -- 遍历JSON中的每个设置
    FOR setting_record IN
        SELECT key, value
        FROM jsonb_each_text(p_settings)
    LOOP
        -- 更新设置
        UPDATE system_settings
        SET value = setting_record.value,
            updated_at = NOW()
        WHERE category = p_category AND key = setting_record.key;
        
        -- 如果更新成功，计数器加1
        IF FOUND THEN
            update_count := update_count + 1;
        END IF;
    END LOOP;
    
    RETURN update_count;
END;
$$ LANGUAGE plpgsql;