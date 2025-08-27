-- 为plans表授予权限
GRANT SELECT ON plans TO anon;
GRANT SELECT ON plans TO authenticated;

-- 为user_quotas表授予权限
GRANT SELECT, UPDATE ON user_quotas TO authenticated;
GRANT INSERT ON user_quotas TO authenticated;

-- 确保序列权限
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;