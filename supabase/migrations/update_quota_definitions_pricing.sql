-- 更新配额定义以匹配价格页面设置
-- Free计划：10次各项检查 + 50个反链查看
-- Pro计划：1000次各项检查 + 无限反链查看
-- Super计划：5000次各项检查 + 无限反链查看
-- 注意：free和user角色配额相同，但user可以导出数据

-- 删除现有的配额定义
DELETE FROM quota_definitions;

-- 插入新的配额定义
-- Free计划配额
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('dr_check', 'free', 10, 'monthly'),
('traffic_check', 'free', 10, 'monthly'),
('backlink_check', 'free', 10, 'monthly'),
('backlink_view', 'free', 50, 'monthly'),
('data_export', 'free', 0, 'never');

-- User计划配额（与free相同，但可以导出数据）
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('dr_check', 'user', 10, 'monthly'),
('traffic_check', 'user', 10, 'monthly'),
('backlink_check', 'user', 10, 'monthly'),
('backlink_view', 'user', 50, 'monthly'),
('data_export', 'user', 999999, 'monthly');

-- Pro计划配额
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('dr_check', 'pro', 1000, 'monthly'),
('traffic_check', 'pro', 1000, 'monthly'),
('backlink_check', 'pro', 1000, 'monthly'),
('backlink_view', 'pro', 999999, 'never'),
('data_export', 'pro', 999999, 'monthly');

-- Super计划配额
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('dr_check', 'super', 5000, 'monthly'),
('traffic_check', 'super', 5000, 'monthly'),
('backlink_check', 'super', 5000, 'monthly'),
('backlink_view', 'super', 999999, 'never'),
('data_export', 'super', 999999, 'monthly');

-- Admin计划配额（无限制）
INSERT INTO quota_definitions (product_type, role, default_quota, reset_cycle) VALUES
('dr_check', 'admin', 999999, 'never'),
('traffic_check', 'admin', 999999, 'never'),
('backlink_check', 'admin', 999999, 'never'),
('backlink_view', 'admin', 999999, 'never'),
('data_export', 'admin', 999999, 'never');

-- 为现有用户重新初始化配额
-- 删除现有用户配额
DELETE FROM user_quotas;

-- 为所有用户重新创建配额记录
INSERT INTO user_quotas (user_id, quota_definition_id, current_usage, last_reset_at)
SELECT 
    ur.user_id,
    qd.id,
    0,
    NOW()
FROM user_roles ur
JOIN quota_definitions qd ON ur.role = qd.role
WHERE ur.is_active = true;

-- 确保权限正确设置
GRANT SELECT, INSERT, UPDATE ON quota_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_quotas TO authenticated;
GRANT ALL PRIVILEGES ON quota_definitions TO service_role;
GRANT ALL PRIVILEGES ON user_quotas TO service_role;