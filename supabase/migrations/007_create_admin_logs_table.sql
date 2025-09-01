-- 创建管理员操作日志表
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_resource_type ON admin_logs(resource_type);
CREATE INDEX idx_admin_logs_status ON admin_logs(status);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_resource_id ON admin_logs(resource_id);

-- 设置表权限
GRANT SELECT ON admin_logs TO authenticated;
GRANT INSERT ON admin_logs TO authenticated;

-- 创建备份历史表
CREATE TABLE backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    backup_type VARCHAR(20) DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
    tables_backed_up TEXT[],
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建备份历史表索引
CREATE INDEX idx_backup_history_status ON backup_history(status);
CREATE INDEX idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX idx_backup_history_created_by ON backup_history(created_by);

-- 设置备份历史表权限
GRANT SELECT ON backup_history TO authenticated;
GRANT INSERT, UPDATE ON backup_history TO authenticated;

-- 创建恢复历史表
CREATE TABLE restore_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID REFERENCES backup_history(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    restore_point TIMESTAMP WITH TIME ZONE,
    tables_restored TEXT[],
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建恢复历史表索引
CREATE INDEX idx_restore_history_backup_id ON restore_history(backup_id);
CREATE INDEX idx_restore_history_status ON restore_history(status);
CREATE INDEX idx_restore_history_created_at ON restore_history(created_at DESC);
CREATE INDEX idx_restore_history_created_by ON restore_history(created_by);

-- 设置恢复历史表权限
GRANT SELECT ON restore_history TO authenticated;
GRANT INSERT, UPDATE ON restore_history TO authenticated;

-- 创建函数：记录管理员操作日志
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id VARCHAR DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_status VARCHAR DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_logs (
        admin_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        status,
        error_message
    )
    VALUES (
        p_admin_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent,
        p_status,
        p_error_message
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取管理员操作日志
CREATE OR REPLACE FUNCTION get_admin_logs(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_admin_id UUID DEFAULT NULL,
    p_action VARCHAR DEFAULT NULL,
    p_resource_type VARCHAR DEFAULT NULL,
    p_status VARCHAR DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    admin_id UUID,
    admin_email TEXT,
    action VARCHAR,
    resource_type VARCHAR,
    resource_id VARCHAR,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.admin_id,
        au.email as admin_email,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.status,
        al.error_message,
        al.created_at
    FROM admin_logs al
    LEFT JOIN auth.users au ON al.admin_id = au.id
    WHERE 
        (p_admin_id IS NULL OR al.admin_id = p_admin_id)
        AND (p_action IS NULL OR al.action ILIKE '%' || p_action || '%')
        AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
        AND (p_status IS NULL OR al.status = p_status)
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：清理旧的日志记录
CREATE OR REPLACE FUNCTION cleanup_old_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除超过指定天数的日志记录
    DELETE FROM admin_logs
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 记录清理操作
    INSERT INTO admin_logs (admin_id, action, details, status)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID, -- 系统操作
        'cleanup_logs',
        jsonb_build_object(
            'days_to_keep', p_days_to_keep,
            'deleted_count', deleted_count
        ),
        'success'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取操作统计
CREATE OR REPLACE FUNCTION get_admin_action_stats(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    action VARCHAR,
    total_count BIGINT,
    success_count BIGINT,
    failed_count BIGINT,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.action,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE al.status = 'success') as success_count,
        COUNT(*) FILTER (WHERE al.status = 'failed') as failed_count,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100,
            2
        ) as success_rate
    FROM admin_logs al
    WHERE al.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY al.action
    ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取最活跃的管理员
CREATE OR REPLACE FUNCTION get_most_active_admins(
    p_limit INTEGER DEFAULT 10,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    admin_id UUID,
    admin_email TEXT,
    action_count BIGINT,
    last_action_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.admin_id,
        au.email as admin_email,
        COUNT(*) as action_count,
        MAX(al.created_at) as last_action_at
    FROM admin_logs al
    LEFT JOIN auth.users au ON al.admin_id = au.id
    WHERE al.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY al.admin_id, au.email
    ORDER BY action_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;