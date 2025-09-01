-- 暂时禁用user_roles的RLS来解决递归问题
-- 这是临时解决方案，用于调试

-- 禁用RLS
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- 确保所有角色都有访问权限
GRANT ALL PRIVILEGES ON user_roles TO anon;
GRANT ALL PRIVILEGES ON user_roles TO authenticated;
GRANT ALL PRIVILEGES ON user_roles TO service_role;