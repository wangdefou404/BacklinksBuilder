-- 暂时禁用user_subscriptions的RLS来测试
-- 这是临时解决方案，用于调试

-- 禁用RLS
ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;

-- 确保所有角色都有访问权限
GRANT ALL PRIVILEGES ON user_subscriptions TO anon;
GRANT ALL PRIVILEGES ON user_subscriptions TO authenticated;
GRANT ALL PRIVILEGES ON user_subscriptions TO service_role;